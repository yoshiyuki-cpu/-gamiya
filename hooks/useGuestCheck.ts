'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { GuestCheckItem, GuestSatisfactionRecord, SatisfactionRank } from '@/lib/supabase'

const HISTORY_LIMIT = 20

export function useGuestCheck() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<GuestCheckItem[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [history, setHistory] = useState<GuestSatisfactionRecord[]>([])

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
      const [{ data: itemsData }, { data: historyData }] = await Promise.all([
        supabase.from('guest_check_items').select('*').order('sort_order'),
        supabase.from('guest_satisfaction_records').select('*').order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
      ])
      if (cancelled) return
      setItems(itemsData ?? [])
      setHistory(historyData ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
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
              setChecked((prev) => {
                const next = new Set(prev)
                next.delete(oldId)
                return next
              })
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyItem])

  const toggleCheck = useCallback((itemId: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const nextGuest = useCallback(() => {
    setChecked(new Set())
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

  const submitSatisfaction = useCallback(async (rank: SatisfactionRank, visitReason: string, impression: string) => {
    const row = {
      rank,
      visit_reason: visitReason.trim() || null,
      impression: impression.trim() || null,
    }
    const { data } = await supabase.from('guest_satisfaction_records').insert(row).select().single()
    if (data) setHistory((prev) => [data as GuestSatisfactionRecord, ...prev].slice(0, HISTORY_LIMIT))
  }, [])

  const total = items.length
  const doneCount = items.filter((i) => checked.has(i.id)).length

  return {
    loading,
    items,
    checked,
    editMode,
    setEditMode,
    total,
    doneCount,
    toggleCheck,
    nextGuest,
    moveItem,
    history,
    submitSatisfaction,
  }
}
