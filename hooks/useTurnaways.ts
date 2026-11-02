'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { TurnawayCount } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'
import { monthRange } from '@/lib/timecard'

export type TurnawayResult = { ok: true } | { ok: false; error: string }

type DbError = { code?: string; message?: string } | null

function isMissingTable(error: DbError): boolean {
  return error?.code === '42P01' || /does not exist|Could not find the table/i.test(error?.message ?? '')
}

function describeError(error: DbError): string {
  const message = error?.message ?? ''
  if (isMissingTable(error)) {
    return '断った組数の表がデータベースにまだありません。Supabaseで supabase-migration-turnaways.sql を実行してください。'
  }
  if (error?.code === '42501' || /permission denied/i.test(message)) {
    return 'データベースの権限が足りません。supabase-migration-turnaways.sql の grant の行を実行してください。'
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return '通信できませんでした。電波を確かめて、もう一度押してください。'
  }
  return `保存できませんでした${message ? `(${message})` : ''}。もう一度押してください。`
}

/**
 * 今日(営業日)の「断った組数」。店長・赤木のどちらが入れても1日1つ。
 * 表がまだ無い(SQL未実行)ときは available が false になり、退勤を止めない。
 */
export function useTurnaways() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [today, setToday] = useState<TurnawayCount | null>(null)
  const [available, setAvailable] = useState(true)
  const date = todayKey()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('turnaway_counts').select('*').eq('count_date', date).maybeSingle()
      if (cancelled) return
      if (error) setAvailable(false)
      else {
        setAvailable(true)
        setToday((data as TurnawayCount) ?? null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  useEffect(() => {
    const channel = supabase
      .channel('turnaway-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnaway_counts' },
        (payload: RealtimePostgresChangesPayload<TurnawayCount>) => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<TurnawayCount>
          if (row.count_date !== date) return
          setToday(payload.eventType === 'DELETE' ? null : (payload.new as TurnawayCount))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [date])

  const save = useCallback(
    async (groups: number, staffName: string): Promise<TurnawayResult> => {
      setSaving(true)
      try {
        const { data, error } = await supabase
          .from('turnaway_counts')
          .upsert({ count_date: date, groups, staff_name: staffName.trim() || null }, { onConflict: 'count_date' })
          .select()
          .single()
        if (error) return { ok: false, error: describeError(error) }
        if (data) setToday(data as TurnawayCount)
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [date],
  )

  return { loading, saving, today, available, save }
}

/** 管理画面用。1か月ぶんの「日ごとの断った組数」。 */
export function useTurnawayMonth(monthKey: string) {
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
  const [rows, setRows] = useState<TurnawayCount[]>([])
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { start, end } = monthRange(monthKey)
      const { data, error } = await supabase
        .from('turnaway_counts')
        .select('*')
        .gte('count_date', start)
        .lte('count_date', end)
        .order('count_date', { ascending: false })
      if (cancelled) return
      setAvailable(!error)
      setRows(error ? [] : ((data ?? []) as TurnawayCount[]))
      setLoadedMonth(monthKey)
    })()
    return () => {
      cancelled = true
    }
  }, [monthKey])

  const total = useMemo(() => rows.reduce((sum, r) => sum + r.groups, 0), [rows])
  return { loading: loadedMonth !== monthKey, available, rows, total }
}
