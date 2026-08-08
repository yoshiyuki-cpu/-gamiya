'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { GuestSatisfactionRecord, SatisfactionRank } from '@/lib/supabase'
import { businessDayRange, todayKey } from '@/lib/checklist'

// Safety cap only — the list is scoped to today's business day (5am-to-5am),
// so a busy day with 30-40 groups still shows every one.
const VISITS_SAFETY_LIMIT = 300

export type VisitPatch = {
  rank?: SatisfactionRank | null
  reservation_name?: string | null
  reservation_time?: string | null
  table_number?: string | null
  visit_reason?: string | null
  impression?: string | null
}

function sortVisits(rows: GuestSatisfactionRecord[]): GuestSatisfactionRecord[] {
  // Reservation time first (HH:MM strings compare correctly), walk-ins
  // without a time go last, ties resolved by registration order.
  return rows.slice().sort((a, b) => {
    const ta = a.reservation_time ?? '99:99'
    const tb = b.reservation_time ?? '99:99'
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
  })
}

export function useGuestVisits() {
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<GuestSatisfactionRecord[]>([])

  const applyVisit = useCallback((row: GuestSatisfactionRecord) => {
    setVisits((prev) => {
      const existing = prev.find((v) => v.id === row.id)
      if (existing && existing.updated_at && row.updated_at < existing.updated_at) return prev
      const next = existing ? prev.map((v) => (v.id === row.id ? row : v)) : [...prev, row]
      return sortVisits(next)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { start, end } = businessDayRange(todayKey())
      const { data } = await supabase
        .from('guest_satisfaction_records')
        .select('*')
        .gte('created_at', start)
        .lt('created_at', end)
        .limit(VISITS_SAFETY_LIMIT)
      if (cancelled) return
      setVisits(sortVisits((data ?? []) as GuestSatisfactionRecord[]))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('guest-visits-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_satisfaction_records' },
        (payload: RealtimePostgresChangesPayload<GuestSatisfactionRecord>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as GuestSatisfactionRecord
            const { start, end } = businessDayRange(todayKey())
            if (row.created_at >= start && row.created_at < end) applyVisit(row)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<GuestSatisfactionRecord>).id
            if (oldId != null) setVisits((prev) => prev.filter((v) => v.id !== oldId))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyVisit])

  const addVisit = useCallback(
    async (reservationName: string, reservationTime: string, tableNumber: string) => {
      const row = {
        rank: null,
        reservation_name: reservationName.trim() || null,
        reservation_time: reservationTime.trim() || null,
        table_number: tableNumber.trim() || null,
        visit_reason: null,
        impression: null,
      }
      if (!row.reservation_name && !row.reservation_time && !row.table_number) return
      const { data } = await supabase.from('guest_satisfaction_records').insert(row).select().single()
      if (data) applyVisit(data as GuestSatisfactionRecord)
    },
    [applyVisit],
  )

  const updateVisit = useCallback(
    async (id: number, patch: VisitPatch) => {
      setVisits((prev) => sortVisits(prev.map((v) => (v.id === id ? { ...v, ...patch } : v))))
      const { data } = await supabase.from('guest_satisfaction_records').update(patch).eq('id', id).select().single()
      if (data) applyVisit(data as GuestSatisfactionRecord)
    },
    [applyVisit],
  )

  const deleteVisit = useCallback(async (id: number) => {
    setVisits((prev) => prev.filter((v) => v.id !== id))
    await supabase.from('guest_satisfaction_records').delete().eq('id', id)
  }, [])

  const totalCount = visits.length
  const ratedCount = visits.filter((v) => v.rank != null).length

  return {
    loading,
    visits,
    totalCount,
    ratedCount,
    addVisit,
    updateVisit,
    deleteVisit,
  }
}
