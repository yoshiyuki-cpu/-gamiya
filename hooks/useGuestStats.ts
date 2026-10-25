'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { businessDayRange, recentBusinessDayKeys, todayKey } from '@/lib/checklist'
import { summarizeGuests } from '@/lib/guestStats'
import type { StatRow } from '@/lib/guestStats'

export type StatsPeriod = 'today' | '7' | '30'

export const PERIODS: StatsPeriod[] = ['today', '7', '30']

export const PERIOD_LABEL: Record<StatsPeriod, string> = { today: '本日', '7': '直近7日', '30': '直近30日' }

const PERIOD_DAYS: Record<StatsPeriod, number> = { today: 1, '7': 7, '30': 30 }

/**
 * 組数と常連さんの割合を出すための集計。
 * 画面の一覧と同じ営業日(昼12時区切り)で期間を切る。
 * refreshKey が変わる(=誰かが保存した)たびに取り直す。
 */
export function useGuestStats(period: StatsPeriod, refreshKey: string) {
  const [rows, setRows] = useState<StatRow[]>([])
  const [loaded, setLoaded] = useState<string | null>(null)
  // 常連さんの列がまだ無い(SQL未実行)ときは false。
  const [available, setAvailable] = useState(true)

  const requestKey = `${period}|${refreshKey}`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const days = PERIOD_DAYS[period]
      const since = recentBusinessDayKeys(days)[0]
      const { start } = businessDayRange(since)
      const { end } = businessDayRange(todayKey())
      const { data, error } = await supabase
        .from('guest_satisfaction_records')
        .select('reservation_time, is_regular')
        .gte('created_at', start)
        .lt('created_at', end)
        .limit(5000)
      if (cancelled) return
      if (error) {
        setAvailable(false)
        const fallback = await supabase
          .from('guest_satisfaction_records')
          .select('reservation_time')
          .gte('created_at', start)
          .lt('created_at', end)
          .limit(5000)
        if (cancelled) return
        setRows((fallback.data ?? []) as StatRow[])
      } else {
        setAvailable(true)
        setRows((data ?? []) as StatRow[])
      }
      setLoaded(requestKey)
    })()
    return () => {
      cancelled = true
    }
  }, [period, requestKey])

  const stats = useMemo(() => summarizeGuests(rows), [rows])
  return { loading: loaded === null, available, stats }
}
