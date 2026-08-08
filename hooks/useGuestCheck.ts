'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { GuestCheckItem, GuestCheckSession } from '@/lib/supabase'

function buildSessionMap(rows: GuestCheckSession[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  for (const row of rows) {
    const set = map.get(row.table_number) ?? new Set<number>()
    set.add(row.item_id)
    map.set(row.table_number, set)
  }
  return map
}

export function useGuestCheck() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<GuestCheckItem[]>([])
  // table_number -> set of checked item ids. Shared via Supabase so any
  // device can pick up a table that another device started, and multiple
  // tables can be in progress at once without their checks mixing.
  const [sessions, setSessions] = useState<Map<string, Set<number>>>(new Map())
  const [currentTable, setCurrentTable] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  const applyItem = useCallback((row: GuestCheckItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((i) => (i.id === row.id ? row : i))
      return next.slice().sort((a, b) => a.sort_order - b.sort_order)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: itemsData }, { data: sessionsData }] = await Promise.all([
        supabase.from('guest_check_items').select('*').order('sort_order'),
        supabase.from('guest_check_sessions').select('*'),
      ])
      if (cancelled) return
      setItems(itemsData ?? [])
      setSessions(buildSessionMap((sessionsData ?? []) as GuestCheckSession[]))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const itemsChannel = supabase
      .channel('guest-check-items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_check_items' },
        (payload: RealtimePostgresChangesPayload<GuestCheckItem>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyItem(payload.new as GuestCheckItem)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<GuestCheckItem>).id
            if (oldId != null) {
              setItems((prev) => prev.filter((i) => i.id !== oldId))
            }
          }
        },
      )
      .subscribe()

    const sessionsChannel = supabase
      .channel('guest-check-sessions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_check_sessions' },
        (payload: RealtimePostgresChangesPayload<GuestCheckSession>) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as GuestCheckSession
            setSessions((prev) => {
              const next = new Map(prev)
              const set = new Set(next.get(row.table_number) ?? [])
              set.add(row.item_id)
              next.set(row.table_number, set)
              return next
            })
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as Partial<GuestCheckSession>
            if (row.table_number != null && row.item_id != null) {
              const tableNumber = row.table_number
              const itemId = row.item_id
              setSessions((prev) => {
                const next = new Map(prev)
                const set = new Set(next.get(tableNumber) ?? [])
                set.delete(itemId)
                if (set.size === 0) next.delete(tableNumber)
                else next.set(tableNumber, set)
                return next
              })
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(sessionsChannel)
    }
  }, [applyItem])

  const selectTable = useCallback((tableNumber: string) => {
    const trimmed = tableNumber.trim()
    if (!trimmed) return
    setCurrentTable(trimmed)
  }, [])

  const backToTableSelect = useCallback(() => {
    setCurrentTable(null)
  }, [])

  const toggleCheck = useCallback(
    async (itemId: number) => {
      const table = currentTable
      if (!table) return
      const isChecked = (sessions.get(table) ?? new Set<number>()).has(itemId)
      setSessions((prev) => {
        const next = new Map(prev)
        const set = new Set(next.get(table) ?? [])
        if (isChecked) {
          set.delete(itemId)
          if (set.size === 0) next.delete(table)
          else next.set(table, set)
        } else {
          set.add(itemId)
          next.set(table, set)
        }
        return next
      })
      if (isChecked) {
        await supabase.from('guest_check_sessions').delete().eq('table_number', table).eq('item_id', itemId)
      } else {
        await supabase
          .from('guest_check_sessions')
          .upsert({ table_number: table, item_id: itemId }, { onConflict: 'table_number,item_id' })
      }
    },
    [currentTable, sessions],
  )

  const finishTable = useCallback(async (tableNumber: string) => {
    setSessions((prev) => {
      const next = new Map(prev)
      next.delete(tableNumber)
      return next
    })
    setCurrentTable((prev) => (prev === tableNumber ? null : prev))
    await supabase.from('guest_check_sessions').delete().eq('table_number', tableNumber)
  }, [])

  const moveItem = useCallback(
    async (itemId: number, direction: 1 | -1) => {
      const sorted = items.slice().sort((a, b) => a.sort_order - b.sort_order)
      const idx = sorted.findIndex((i) => i.id === itemId)
      const targetIdx = idx + direction
      if (idx === -1 || targetIdx < 0 || targetIdx >= sorted.length) return
      const target = sorted[targetIdx]
      let newSortOrder: number
      if (direction === -1) {
        const before = sorted[targetIdx - 1]
        newSortOrder = before ? (before.sort_order + target.sort_order) / 2 : target.sort_order - 100
      } else {
        const after = sorted[targetIdx + 1]
        newSortOrder = after ? (target.sort_order + after.sort_order) / 2 : target.sort_order + 100
      }
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, sort_order: newSortOrder } : i)))
      const { data } = await supabase.from('guest_check_items').update({ sort_order: newSortOrder }).eq('id', itemId).select().single()
      if (data) applyItem(data as GuestCheckItem)
    },
    [items, applyItem],
  )

  const activeTables = Array.from(sessions.keys()).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }))
  const checked = currentTable ? sessions.get(currentTable) ?? new Set<number>() : new Set<number>()
  const total = items.length
  const doneCount = items.filter((i) => checked.has(i.id)).length

  return {
    loading,
    items,
    activeTables,
    currentTable,
    selectTable,
    backToTableSelect,
    checked,
    editMode,
    setEditMode,
    total,
    doneCount,
    toggleCheck,
    finishTable,
    moveItem,
  }
}
