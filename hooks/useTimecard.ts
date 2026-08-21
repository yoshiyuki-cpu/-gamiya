'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TimeBreak, TimeEntry } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'
import { monthRange, stateOf } from '@/lib/timecard'
import type { StaffState } from '@/lib/timecard'

export type StaffRow = {
  name: string
  entry: TimeEntry | undefined
  breaks: TimeBreak[]
  state: StaffState
}

async function fetchBreaksFor(entries: TimeEntry[]): Promise<TimeBreak[]> {
  if (entries.length === 0) return []
  const { data } = await supabase
    .from('time_breaks')
    .select('*')
    .in('entry_id', entries.map((e) => e.id))
  return (data ?? []) as TimeBreak[]
}

/** 打刻画面用。今日(営業日)の勤務だけを見る。 */
export function useTimecard() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<string[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [breaks, setBreaks] = useState<TimeBreak[]>([])
  const [workDate] = useState(todayKey)

  const reload = useCallback(async () => {
    const [{ data: staffData }, { data: entryData }] = await Promise.all([
      supabase.from('staff_names').select('name').order('name'),
      supabase.from('time_entries').select('*').eq('work_date', workDate).order('id'),
    ])
    const list = (entryData ?? []) as TimeEntry[]
    setStaffList((staffData ?? []).map((s) => s.name))
    setEntries(list)
    setBreaks(await fetchBreaksFor(list))
  }, [workDate])

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

  // 共有端末を複数人が同時に触るので、他端末の打刻もすぐ反映されるようにする。
  useEffect(() => {
    const channel = supabase
      .channel(`timecard-${workDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_breaks' }, () => void reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [workDate, reload])

  const rows: StaffRow[] = useMemo(() => {
    return staffList.map((name) => {
      // 分割勤務に備え、その日の最後の勤務を「今の状態」とみなす。
      const mine = entries.filter((e) => e.staff_name === name)
      const entry = mine[mine.length - 1]
      const myBreaks = entry ? breaks.filter((b) => b.entry_id === entry.id) : []
      return { name, entry, breaks: myBreaks, state: stateOf(entry, myBreaks) }
    })
  }, [staffList, entries, breaks])

  const clockIn = useCallback(
    async (name: string) => {
      setBusy(name)
      try {
        await supabase
          .from('time_entries')
          .insert({ staff_name: name, work_date: workDate, clock_in: new Date().toISOString() })
        await reload()
      } finally {
        setBusy(null)
      }
    },
    [workDate, reload],
  )

  const clockOut = useCallback(
    async (row: StaffRow) => {
      if (!row.entry) return
      setBusy(row.name)
      try {
        // 休憩に入ったまま退勤した場合に休憩が開きっぱなしにならないよう、先に閉じる。
        const open = row.breaks.find((b) => !b.break_end)
        const now = new Date().toISOString()
        if (open) await supabase.from('time_breaks').update({ break_end: now }).eq('id', open.id)
        await supabase.from('time_entries').update({ clock_out: now }).eq('id', row.entry.id)
        await reload()
      } finally {
        setBusy(null)
      }
    },
    [reload],
  )

  const startBreak = useCallback(
    async (row: StaffRow) => {
      if (!row.entry) return
      setBusy(row.name)
      try {
        await supabase.from('time_breaks').insert({ entry_id: row.entry.id, break_start: new Date().toISOString() })
        await reload()
      } finally {
        setBusy(null)
      }
    },
    [reload],
  )

  const endBreak = useCallback(
    async (row: StaffRow) => {
      const open = row.breaks.find((b) => !b.break_end)
      if (!open) return
      setBusy(row.name)
      try {
        await supabase.from('time_breaks').update({ break_end: new Date().toISOString() }).eq('id', open.id)
        await reload()
      } finally {
        setBusy(null)
      }
    },
    [reload],
  )

  const addStaff = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      await supabase.from('staff_names').upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
      await reload()
    },
    [reload],
  )

  return { loading, busy, workDate, rows, clockIn, clockOut, startBreak, endBreak, addStaff }
}

export type MonthEntry = { entry: TimeEntry; breaks: TimeBreak[] }

/** 管理画面用。月をまたいだ集計と、打刻の修正に使う。 */
export function useTimecardMonth(monthKey: string) {
  // 読み込み済みの月を持っておき、表示したい月と違えば「読み込み中」とみなす。
  // 月を切り替えた瞬間に前の月の数字が残らない。
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [breaks, setBreaks] = useState<TimeBreak[]>([])

  const reload = useCallback(async () => {
    const { start, end } = monthRange(monthKey)
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date')
      .order('staff_name')
    const list = (data ?? []) as TimeEntry[]
    setEntries(list)
    setBreaks(await fetchBreaksFor(list))
  }, [monthKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      if (!cancelled) setLoadedMonth(monthKey)
    })()
    return () => {
      cancelled = true
    }
  }, [reload, monthKey])

  const loading = loadedMonth !== monthKey

  const items: MonthEntry[] = useMemo(
    () => entries.map((entry) => ({ entry, breaks: breaks.filter((b) => b.entry_id === entry.id) })),
    [entries, breaks],
  )

  const updateEntry = useCallback(
    async (id: number, patch: Partial<Pick<TimeEntry, 'clock_in' | 'clock_out' | 'note'>>) => {
      await supabase.from('time_entries').update(patch).eq('id', id)
      await reload()
    },
    [reload],
  )

  const updateBreak = useCallback(
    async (id: number, patch: Partial<Pick<TimeBreak, 'break_start' | 'break_end'>>) => {
      await supabase.from('time_breaks').update(patch).eq('id', id)
      await reload()
    },
    [reload],
  )

  const deleteBreak = useCallback(
    async (id: number) => {
      await supabase.from('time_breaks').delete().eq('id', id)
      await reload()
    },
    [reload],
  )

  const deleteEntry = useCallback(
    async (id: number) => {
      await supabase.from('time_entries').delete().eq('id', id)
      await reload()
    },
    [reload],
  )

  return { loading, items, updateEntry, updateBreak, deleteBreak, deleteEntry, reload }
}
