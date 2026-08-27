'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  ShiftAssignment,
  ShiftRequest,
  ShiftRequirement,
  ShiftRequirementOverride,
  ShiftSettings,
  ShiftSubmission,
  StaffName,
} from '@/lib/supabase'
import {
  DEFAULT_REQUIREMENT,
  dayStatus,
  deadlineOf,
  draftAssignments,
  periodDates,
  periodKey,
  requirementFor,
  type DayStatus,
  type Requirement,
  type ShiftPeriod,
  type StaffMember,
} from '@/lib/shifts'

export function useShifts(period: ShiftPeriod) {
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffName[]>([])
  const [requests, setRequests] = useState<ShiftRequest[]>([])
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [submissions, setSubmissions] = useState<ShiftSubmission[]>([])
  const [requirements, setRequirements] = useState<ShiftRequirement[]>([])
  const [overrides, setOverrides] = useState<ShiftRequirementOverride[]>([])
  const [settings, setSettings] = useState<ShiftSettings | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  const key = periodKey(period)
  const dates = useMemo(() => periodDates(period), [period])
  const from = dates[0]
  const to = dates[dates.length - 1]

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [staffRes, reqRes, asgRes, subRes, needRes, ovrRes, setRes] = await Promise.all([
        supabase.from('staff_names').select('*').order('name'),
        supabase.from('shift_requests').select('*').gte('work_date', from).lte('work_date', to),
        supabase.from('shift_assignments').select('*').gte('work_date', from).lte('work_date', to),
        supabase.from('shift_submissions').select('*').eq('period_key', key),
        supabase.from('shift_requirements').select('*').order('weekday'),
        supabase.from('shift_requirement_overrides').select('*').gte('work_date', from).lte('work_date', to),
        supabase.from('shift_settings').select('*').eq('id', 1).maybeSingle(),
      ])
      if (cancelled) return
      setStaff((staffRes.data ?? []) as StaffName[])
      setRequests((reqRes.data ?? []) as ShiftRequest[])
      setAssignments((asgRes.data ?? []) as ShiftAssignment[])
      setSubmissions((subRes.data ?? []) as ShiftSubmission[])
      setRequirements((needRes.data ?? []) as ShiftRequirement[])
      setOverrides((ovrRes.data ?? []) as ShiftRequirementOverride[])
      setSettings((setRes.data ?? null) as ShiftSettings | null)
      setLoadedKey(key)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [key, from, to])

  // 期間を切り替えた直後は古い期間の中身が残っているため、読み込み中として扱う。
  const stale = loadedKey !== key

  useEffect(() => {
    const channel = supabase
      .channel('shift-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_requests' }, () => reload('requests'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, () => reload('assignments'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_submissions' }, () => reload('submissions'))
      .subscribe()

    async function reload(what: 'requests' | 'assignments' | 'submissions') {
      if (what === 'requests') {
        const { data } = await supabase.from('shift_requests').select('*').gte('work_date', from).lte('work_date', to)
        setRequests((data ?? []) as ShiftRequest[])
      } else if (what === 'assignments') {
        const { data } = await supabase.from('shift_assignments').select('*').gte('work_date', from).lte('work_date', to)
        setAssignments((data ?? []) as ShiftAssignment[])
      } else {
        const { data } = await supabase.from('shift_submissions').select('*').eq('period_key', key)
        setSubmissions((data ?? []) as ShiftSubmission[])
      }
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [key, from, to])

  const members: StaffMember[] = useMemo(
    () => staff.filter((s) => s.active !== false).map((s) => ({ name: s.name, role: s.role, position: s.position })),
    [staff],
  )

  const needByWeekday = useMemo(() => {
    const map: Record<number, Requirement> = {}
    for (const r of requirements) {
      map[r.weekday] = {
        total_needed: r.total_needed,
        hall_needed: r.hall_needed,
        kitchen_needed: r.kitchen_needed,
        staff_needed: r.staff_needed,
      }
    }
    return map
  }, [requirements])

  const overrideMap = useMemo(() => {
    const map: Record<string, Requirement> = {}
    for (const o of overrides) {
      map[o.work_date] = {
        total_needed: o.total_needed,
        hall_needed: o.hall_needed,
        kitchen_needed: o.kitchen_needed,
        staff_needed: o.staff_needed,
      }
    }
    return map
  }, [overrides])

  const statuses: DayStatus[] = useMemo(() => {
    const byName = new Map(members.map((m) => [m.name, m]))
    return dates.map((date) => {
      const need = requirementFor(date, needByWeekday, overrideMap)
      const dayRequests = requests.filter((r) => r.work_date === date)
      const offNames = new Set(dayRequests.filter((r) => r.kind === 'off').map((r) => r.staff_name))
      const wantNames = new Set(dayRequests.filter((r) => r.kind === 'want').map((r) => r.staff_name))
      const assigned = assignments
        .filter((a) => a.work_date === date)
        .map((a) => byName.get(a.staff_name))
        .filter((m): m is StaffMember => m != null)
      const available = members.filter((m) => !offNames.has(m.name))
      const wants = members.filter((m) => wantNames.has(m.name))
      return dayStatus(date, need, assigned, available, wants)
    })
  }, [dates, members, requests, assignments, needByWeekday, overrideMap])

  const deadline = useMemo(
    () => deadlineOf(period, settings?.first_half_deadline_day ?? 20, settings?.second_half_deadline_day ?? 5),
    [period, settings],
  )

  const submittedNames = useMemo(() => new Set(submissions.map((s) => s.staff_name)), [submissions])
  const notSubmitted = useMemo(() => members.filter((m) => !submittedNames.has(m.name)), [members, submittedNames])

  // 人数そのものが足りない日と、人数は足りているが役割が偏っている日は分けて数える。
  // 同じ「足りない」でも打つ手が違うため。
  const shortageDays = useMemo(() => statuses.filter((s) => s.shortage > 0), [statuses])
  const biasDays = useMemo(
    () => statuses.filter((s) => s.shortage === 0 && (s.staffShortage > 0 || s.hallShortage > 0 || s.kitchenShortage > 0)),
    [statuses],
  )
  const surplusDays = useMemo(() => statuses.filter((s) => s.surplus > 0), [statuses])

  /** 休み希望・出勤希望を1日ぶん切り替える。同じものをもう一度押すと取り消し。 */
  const setRequest = useCallback(
    async (staffName: string, date: string, kind: 'off' | 'want' | null) => {
      const existing = requests.find((r) => r.staff_name === staffName && r.work_date === date)
      if (kind === null) {
        if (!existing) return
        setRequests((prev) => prev.filter((r) => r.id !== existing.id))
        await supabase.from('shift_requests').delete().eq('id', existing.id)
        return
      }
      const { data } = await supabase
        .from('shift_requests')
        .upsert({ staff_name: staffName, work_date: date, kind }, { onConflict: 'staff_name,work_date' })
        .select()
        .single()
      if (data) {
        const row = data as ShiftRequest
        setRequests((prev) => [...prev.filter((r) => r.id !== row.id && !(r.staff_name === staffName && r.work_date === date)), row])
      }
    },
    [requests],
  )

  /** 「この期間の希望は出し終えた」と記録する。未提出の人にだけ声をかけるために要る。 */
  const submit = useCallback(
    async (staffName: string) => {
      const { data } = await supabase
        .from('shift_submissions')
        .upsert({ staff_name: staffName, period_key: key }, { onConflict: 'staff_name,period_key' })
        .select()
        .single()
      if (data) setSubmissions((prev) => [...prev.filter((s) => s.staff_name !== staffName), data as ShiftSubmission])
    },
    [key],
  )

  const toggleAssignment = useCallback(
    async (staffName: string, date: string) => {
      const existing = assignments.find((a) => a.staff_name === staffName && a.work_date === date)
      if (existing) {
        setAssignments((prev) => prev.filter((a) => a.id !== existing.id))
        await supabase.from('shift_assignments').delete().eq('id', existing.id)
        return
      }
      const { data } = await supabase
        .from('shift_assignments')
        .insert({ staff_name: staffName, work_date: date })
        .select()
        .single()
      if (data) setAssignments((prev) => [...prev, data as ShiftAssignment])
    },
    [assignments],
  )

  /** 空いているところをまとめて埋める。既に確定している人は動かさない。 */
  const autoFill = useCallback(async () => {
    const offBy: Record<string, Set<string>> = {}
    const wantBy: Record<string, Set<string>> = {}
    for (const r of requests) {
      const bucket = r.kind === 'off' ? offBy : wantBy
      ;(bucket[r.work_date] ??= new Set()).add(r.staff_name)
    }
    const already: Record<string, string[]> = {}
    for (const a of assignments) (already[a.work_date] ??= []).push(a.staff_name)

    const needs: Record<string, Requirement> = {}
    for (const d of dates) needs[d] = requirementFor(d, needByWeekday, overrideMap)

    const draft = draftAssignments(dates, needs, members, offBy, wantBy, already)
    const rows: { staff_name: string; work_date: string }[] = []
    for (const d of dates) {
      for (const name of draft[d] ?? []) {
        if (!(already[d] ?? []).includes(name)) rows.push({ staff_name: name, work_date: d })
      }
    }
    if (rows.length === 0) return 0

    const { data } = await supabase.from('shift_assignments').insert(rows).select()
    if (data) setAssignments((prev) => [...prev, ...(data as ShiftAssignment[])])
    return rows.length
  }, [requests, assignments, dates, members, needByWeekday, overrideMap])

  const clearAssignments = useCallback(async () => {
    setAssignments([])
    await supabase.from('shift_assignments').delete().gte('work_date', from).lte('work_date', to)
  }, [from, to])

  const saveRequirement = useCallback(async (weekday: number, patch: Partial<Requirement>) => {
    const { data } = await supabase
      .from('shift_requirements')
      .upsert({ weekday, ...DEFAULT_REQUIREMENT, ...patch }, { onConflict: 'weekday' })
      .select()
      .single()
    if (data) {
      const row = data as ShiftRequirement
      setRequirements((prev) => [...prev.filter((r) => r.weekday !== weekday), row].sort((a, b) => a.weekday - b.weekday))
    }
  }, [])

  const saveSettings = useCallback(async (patch: Partial<Pick<ShiftSettings, 'first_half_deadline_day' | 'second_half_deadline_day'>>) => {
    const { data } = await supabase.from('shift_settings').update(patch).eq('id', 1).select().single()
    if (data) setSettings(data as ShiftSettings)
  }, [])

  const saveStaff = useCallback(async (name: string, patch: Partial<Pick<StaffName, 'role' | 'position' | 'active'>>) => {
    setStaff((prev) => prev.map((s) => (s.name === name ? { ...s, ...patch } : s)))
    await supabase.from('staff_names').update(patch).eq('name', name)
  }, [])

  return {
    loading: loading || stale,
    dates,
    staff,
    members,
    requests,
    assignments,
    statuses,
    deadline,
    settings,
    requirements,
    notSubmitted,
    submittedNames,
    shortageDays,
    biasDays,
    surplusDays,
    setRequest,
    submit,
    toggleAssignment,
    autoFill,
    clearAssignments,
    saveRequirement,
    saveSettings,
    saveStaff,
  }
}
