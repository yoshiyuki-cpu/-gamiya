'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Category, DailyRecord, Item } from '@/lib/supabase'
import { currentTimeLabel, todayKey } from '@/lib/checklist'

const STAFF_STORAGE_KEY = 'gamiya:current-staff'
const QUANTITY_DEBOUNCE_MS = 500

function emptyRecord(itemId: number, recordDate: string): DailyRecord {
  return {
    id: 0,
    item_id: itemId,
    record_date: recordDate,
    checked: false,
    quantity_value: null,
    checked_time: null,
    staff_name: null,
    timer_started_at: null,
    timer_accumulated_ms: 0,
    updated_at: '',
  }
}

export function useChecklist() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [dailyRecords, setDailyRecords] = useState<Map<number, DailyRecord>>(new Map())
  const [staffList, setStaffList] = useState<string[]>([])
  const [currentStaff, setCurrentStaffState] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [dailyKey, setDailyKey] = useState(todayKey)

  const dailyKeyRef = useRef(dailyKey)
  const currentStaffRef = useRef(currentStaff)
  const quantityTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    dailyKeyRef.current = dailyKey
  }, [dailyKey])
  useEffect(() => {
    currentStaffRef.current = currentStaff
  }, [currentStaff])

  // ---- local helpers -------------------------------------------------

  const mergeRecord = useCallback((itemId: number, patch: Partial<DailyRecord>) => {
    setDailyRecords((prev) => {
      const next = new Map(prev)
      const existing = next.get(itemId) ?? emptyRecord(itemId, dailyKeyRef.current)
      next.set(itemId, { ...existing, ...patch })
      return next
    })
  }, [])

  const applyDailyRecord = useCallback((row: DailyRecord) => {
    setDailyRecords((prev) => {
      const existing = prev.get(row.item_id)
      if (existing && existing.updated_at && row.updated_at < existing.updated_at) {
        return prev // stale event, ignore
      }
      const next = new Map(prev)
      next.set(row.item_id, row)
      return next
    })
  }, [])

  const applyItem = useCallback((row: Item) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === row.id)
      if (idx === -1) return [...prev, row]
      if (prev[idx].updated_at && row.updated_at < prev[idx].updated_at) return prev
      const next = prev.slice()
      next[idx] = row
      return next
    })
  }, [])

  // ---- initial load: categories + items + staff list (once) ---------

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: categoriesData }, { data: itemsData }, { data: staffData }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('items').select('*').order('sort_order'),
        supabase.from('staff_names').select('*').order('name'),
      ])
      if (cancelled) return
      setCategories(categoriesData ?? [])
      setItems(itemsData ?? [])
      setStaffList((staffData ?? []).map((s) => s.name))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- current staff: device-local, persisted to localStorage --------

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STAFF_STORAGE_KEY)
      // One-time hydration from a per-device external store on mount, not a
      // subscription — safe despite the generic set-state-in-effect lint rule.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCurrentStaffState(saved)
    } catch {
      // ignore
    }
  }, [])

  const setCurrentStaff = useCallback((name: string) => {
    setCurrentStaffState(name)
    try {
      window.localStorage.setItem(STAFF_STORAGE_KEY, name)
    } catch {
      // ignore
    }
  }, [])

  const commitCurrentStaff = useCallback(async () => {
    const trimmed = currentStaffRef.current.trim()
    if (!trimmed) return
    setStaffList((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()))
    await supabase.from('staff_names').upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
  }, [])

  // ---- local-midnight rollover: recompute dailyKey every 60s ---------

  useEffect(() => {
    const interval = setInterval(() => {
      const key = todayKey()
      setDailyKey((prev) => (prev !== key ? key : prev))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // ---- today's daily_records: load + realtime, re-subscribed on dailyKey change ----

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { data } = await supabase.from('daily_records').select('*').eq('record_date', dailyKey)
      if (cancelled) return
      setDailyRecords(new Map((data ?? []).map((r) => [r.item_id, r as DailyRecord])))
    })()

    const channel = supabase
      .channel(`daily-records-${dailyKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_records', filter: `record_date=eq.${dailyKey}` },
        (payload: RealtimePostgresChangesPayload<DailyRecord>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyDailyRecord(payload.new as DailyRecord)
          } else if (payload.eventType === 'DELETE') {
            const itemId = (payload.old as Partial<DailyRecord>).item_id
            if (itemId != null) {
              setDailyRecords((prev) => {
                const next = new Map(prev)
                next.delete(itemId)
                return next
              })
            }
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [dailyKey, applyDailyRecord])

  // ---- items + staff_names realtime (mount-scoped, no date filter) ---

  useEffect(() => {
    const itemsChannel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        (payload: RealtimePostgresChangesPayload<Item>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyItem(payload.new as Item)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<Item>).id
            if (oldId != null) {
              setItems((prev) => prev.filter((i) => i.id !== oldId))
            }
          }
        },
      )
      .subscribe()

    const staffChannel = supabase
      .channel('staff-names-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staff_names' },
        (payload: RealtimePostgresChangesPayload<{ name: string }>) => {
          const name = (payload.new as { name?: string }).name
          if (name) {
            setStaffList((prev) => (prev.includes(name) ? prev : [...prev, name].sort()))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(staffChannel)
    }
  }, [applyItem])

  // ---- item interactions ----------------------------------------------

  const setItemStaff = useCallback(
    async (itemId: number, name: string) => {
      const trimmed = name.trim()
      const staffName = trimmed || null
      mergeRecord(itemId, { staff_name: staffName })
      const { data } = await supabase
        .from('daily_records')
        .upsert({ item_id: itemId, record_date: dailyKeyRef.current, staff_name: staffName }, { onConflict: 'item_id,record_date' })
        .select()
        .single()
      if (data) applyDailyRecord(data as DailyRecord)
    },
    [mergeRecord, applyDailyRecord],
  )

  const toggleCheck = useCallback(
    async (itemId: number) => {
      const record = dailyRecords.get(itemId)
      const nowChecked = !record?.checked
      const patch: Partial<DailyRecord> = nowChecked
        ? { checked: true, checked_time: currentTimeLabel(), staff_name: currentStaffRef.current.trim() || null }
        : { checked: false, checked_time: null, staff_name: null }
      mergeRecord(itemId, patch)
      const { data } = await supabase
        .from('daily_records')
        .upsert({ item_id: itemId, record_date: dailyKeyRef.current, ...patch }, { onConflict: 'item_id,record_date' })
        .select()
        .single()
      if (data) applyDailyRecord(data as DailyRecord)
    },
    [dailyRecords, mergeRecord, applyDailyRecord],
  )

  const setQuantity = useCallback(
    (itemId: number, value: string) => {
      const staffName = value.trim() ? currentStaffRef.current.trim() || null : null
      mergeRecord(itemId, { quantity_value: value, staff_name: staffName })

      const timers = quantityTimers.current
      const prevTimer = timers.get(itemId)
      if (prevTimer) clearTimeout(prevTimer)
      timers.set(
        itemId,
        setTimeout(async () => {
          timers.delete(itemId)
          const { data } = await supabase
            .from('daily_records')
            .upsert(
              { item_id: itemId, record_date: dailyKeyRef.current, quantity_value: value, staff_name: staffName },
              { onConflict: 'item_id,record_date' },
            )
            .select()
            .single()
          if (data) applyDailyRecord(data as DailyRecord)
        }, QUANTITY_DEBOUNCE_MS),
      )
    },
    [mergeRecord, applyDailyRecord],
  )

  const toggleTimer = useCallback(
    async (itemId: number) => {
      const record = dailyRecords.get(itemId)
      const running = !!record?.timer_started_at
      if (running) {
        const elapsed =
          (record?.timer_accumulated_ms ?? 0) + (Date.now() - new Date(record!.timer_started_at as string).getTime())
        mergeRecord(itemId, { timer_accumulated_ms: elapsed, timer_started_at: null })
        const { data } = await supabase
          .from('daily_records')
          .upsert(
            { item_id: itemId, record_date: dailyKeyRef.current, timer_accumulated_ms: elapsed, timer_started_at: null },
            { onConflict: 'item_id,record_date' },
          )
          .select()
          .single()
        if (data) applyDailyRecord(data as DailyRecord)
      } else {
        const startedAtIso = new Date().toISOString()
        mergeRecord(itemId, { timer_started_at: startedAtIso })
        const { data } = await supabase
          .from('daily_records')
          .upsert(
            {
              item_id: itemId,
              record_date: dailyKeyRef.current,
              timer_started_at: startedAtIso,
              timer_accumulated_ms: record?.timer_accumulated_ms ?? 0,
            },
            { onConflict: 'item_id,record_date' },
          )
          .select()
          .single()
        if (data) applyDailyRecord(data as DailyRecord)
      }
    },
    [dailyRecords, mergeRecord, applyDailyRecord],
  )

  const resetTimer = useCallback(
    async (itemId: number) => {
      mergeRecord(itemId, { timer_accumulated_ms: 0, timer_started_at: null })
      const { data } = await supabase
        .from('daily_records')
        .upsert(
          { item_id: itemId, record_date: dailyKeyRef.current, timer_accumulated_ms: 0, timer_started_at: null },
          { onConflict: 'item_id,record_date' },
        )
        .select()
        .single()
      if (data) applyDailyRecord(data as DailyRecord)
    },
    [mergeRecord, applyDailyRecord],
  )

  // ---- edit-mode: structural item changes -----------------------------

  const addItemsBulk = useCallback(
    async (categoryId: string, rawText: string) => {
      const lines = rawText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (lines.length === 0) return
      const categoryItems = items.filter((i) => i.category_id === categoryId)
      const base = categoryItems.length ? Math.max(...categoryItems.map((i) => i.sort_order)) : 0
      const rows = lines.map((text, idx) => ({
        category_id: categoryId,
        text,
        has_quantity: false,
        sort_order: base + (idx + 1) * 100,
      }))
      const { data } = await supabase.from('items').insert(rows).select()
      if (data) setItems((prev) => [...prev, ...(data as Item[])])
    },
    [items],
  )

  const deleteItem = useCallback(async (itemId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    setDailyRecords((prev) => {
      const next = new Map(prev)
      next.delete(itemId)
      return next
    })
    await supabase.from('items').delete().eq('id', itemId)
  }, [])

  const moveItem = useCallback(
    async (categoryId: string, itemId: number, direction: 1 | -1) => {
      const categoryItems = items.filter((i) => i.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order)
      const idx = categoryItems.findIndex((i) => i.id === itemId)
      const targetIdx = idx + direction
      if (idx === -1 || targetIdx < 0 || targetIdx >= categoryItems.length) return
      const target = categoryItems[targetIdx]
      let newSortOrder: number
      if (direction === -1) {
        const before = categoryItems[targetIdx - 1]
        newSortOrder = before ? (before.sort_order + target.sort_order) / 2 : target.sort_order - 100
      } else {
        const after = categoryItems[targetIdx + 1]
        newSortOrder = after ? (target.sort_order + after.sort_order) / 2 : target.sort_order + 100
      }
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, sort_order: newSortOrder } : i)))
      const { data } = await supabase.from('items').update({ sort_order: newSortOrder }).eq('id', itemId).select().single()
      if (data) applyItem(data as Item)
    },
    [items, applyItem],
  )

  const toggleQuantityMode = useCallback(
    async (itemId: number) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return
      const newHasQuantity = !item.has_quantity
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, has_quantity: newHasQuantity } : i)))
      setDailyRecords((prev) => {
        const next = new Map(prev)
        next.delete(itemId)
        return next
      })
      await Promise.all([
        supabase.from('items').update({ has_quantity: newHasQuantity }).eq('id', itemId),
        supabase.from('daily_records').delete().eq('item_id', itemId).eq('record_date', dailyKeyRef.current),
      ])
    },
    [items],
  )

  // ---- footer actions ---------------------------------------------------

  const resetDailyChecks = useCallback(async () => {
    if (!window.confirm('本日のチェック・個数・作業時間の記録をすべてリセットします。よろしいですか?')) return
    setDailyRecords(new Map())
    await supabase.from('daily_records').delete().eq('record_date', dailyKeyRef.current)
  }, [])

  const restoreDefaults = useCallback(async () => {
    if (!window.confirm('チェックリストの内容を最初の状態に戻します。追加・削除・数量設定は失われます。よろしいですか?')) return
    await supabase.rpc('restore_default_checklist')
    const { data } = await supabase.from('items').select('*').order('sort_order')
    setItems(data ?? [])
    setDailyRecords(new Map())
  }, [])

  // ---- derived progress ---------------------------------------------

  const total = items.length
  const doneCount = items.filter((it) => {
    const record = dailyRecords.get(it.id)
    if (it.has_quantity) return !!(record?.quantity_value && record.quantity_value.trim() !== '')
    return !!record?.checked
  }).length

  return {
    loading,
    categories,
    items,
    dailyRecords,
    staffList,
    currentStaff,
    setCurrentStaff,
    commitCurrentStaff,
    editMode,
    setEditMode,
    dailyKey,
    total,
    doneCount,
    toggleCheck,
    setQuantity,
    setItemStaff,
    toggleTimer,
    resetTimer,
    addItemsBulk,
    deleteItem,
    moveItem,
    toggleQuantityMode,
    resetDailyChecks,
    restoreDefaults,
  }
}
