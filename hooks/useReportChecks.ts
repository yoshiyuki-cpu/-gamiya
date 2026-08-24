'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ReportCheck } from '@/lib/supabase'
import { recentBusinessDayKeys, todayKey } from '@/lib/checklist'

export const STREAK_DAYS = 14
const HISTORY_DAYS = 62

export function useReportChecks() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checks, setChecks] = useState<ReportCheck[]>([])

  const applyCheck = useCallback((row: ReportCheck) => {
    setChecks((prev) => {
      const idx = prev.findIndex((c) => c.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((c) => (c.id === row.id ? row : c))
      return next.slice().sort((a, b) => (a.check_date < b.check_date ? 1 : a.check_date > b.check_date ? -1 : 0))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const since = recentBusinessDayKeys(HISTORY_DAYS)[0]
      const { data } = await supabase
        .from('report_checks')
        .select('*')
        .gte('check_date', since)
        .order('check_date', { ascending: false })
      if (cancelled) return
      setChecks((data ?? []) as ReportCheck[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('report-checks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_checks' },
        (payload: RealtimePostgresChangesPayload<ReportCheck>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyCheck(payload.new as ReportCheck)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<ReportCheck>).id
            if (oldId != null) setChecks((prev) => prev.filter((c) => c.id !== oldId))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyCheck])

  const today = todayKey()
  const todayCheck = checks.find((c) => c.check_date === today) ?? null

  const doneDates = useMemo(() => new Set(checks.map((c) => c.check_date)), [checks])
  const streak = useMemo(
    () => recentBusinessDayKeys(STREAK_DAYS).map((key) => ({ key, done: doneDates.has(key) })),
    [doneDates],
  )

  const monthCount = useMemo(() => {
    const prefix = today.slice(0, 7)
    return checks.filter((c) => c.check_date.startsWith(prefix)).length
  }, [checks, today])

  /** 報告業務を済ませた記録。presidentNote が空なら「社長への報告は特になし」。 */
  const markDone = useCallback(
    async (staffName: string, presidentNote: string) => {
      setSaving(true)
      try {
        const row = {
          check_date: today,
          staff_name: staffName.trim() || null,
          president_note: presidentNote.trim() || null,
        }
        const { data } = await supabase.from('report_checks').upsert(row, { onConflict: 'check_date' }).select().single()
        if (data) applyCheck(data as ReportCheck)
      } finally {
        setSaving(false)
      }
    },
    [today, applyCheck],
  )

  const undo = useCallback(async () => {
    setSaving(true)
    try {
      setChecks((prev) => prev.filter((c) => c.check_date !== today))
      await supabase.from('report_checks').delete().eq('check_date', today)
    } finally {
      setSaving(false)
    }
  }, [today])

  // 社長への報告が残っている日。まとめて見返せるようにしておく。
  const pendingNotes = useMemo(
    () => checks.filter((c) => c.president_note && c.president_note.trim() !== '').slice(0, 10),
    [checks],
  )

  return { loading, saving, todayCheck, streak, monthCount, pendingNotes, markDone, undo }
}
