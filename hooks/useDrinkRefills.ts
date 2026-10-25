'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'
import { tallyRefills } from '@/lib/refills'
import type { RefillEntry } from '@/lib/refills'

/**
 * 今日(営業日)の、ドリンクおかわりの杯数。退勤のときに入れたものを人ごとに足す。
 * 列がまだ無い(SQL未実行)ときは available が false のまま。
 */
export function useDrinkRefills() {
  const [entries, setEntries] = useState<RefillEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select('staff_name, drink_refills')
      .eq('work_date', todayKey())
    if (error) {
      setAvailable(false)
      return
    }
    setAvailable(true)
    setEntries((data ?? []) as RefillEntry[])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('drink-refills')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => void reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const tally = useMemo(() => tallyRefills(entries), [entries])
  return { loading, available, ...tally }
}
