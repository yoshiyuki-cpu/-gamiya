import type { SupabaseClient } from '@supabase/supabase-js'
import {
  dayStatus,
  periodDates,
  periodKey,
  requirementFor,
  type DayStatus,
  type Requirement,
  type ShiftPeriod,
  type StaffMember,
} from './shifts'
import type {
  ShiftAssignment,
  ShiftRequest,
  ShiftRequirement,
  ShiftRequirementOverride,
  ShiftSubmission,
  StaffName,
} from './supabase'

export type PeriodSnapshot = {
  members: StaffMember[]
  statuses: DayStatus[]
  notSubmitted: StaffMember[]
}

/** 通知に必要なぶんだけ、その期間のシフトを読み出して過不足まで出す。 */
export async function loadPeriod(supabase: SupabaseClient, period: ShiftPeriod): Promise<PeriodSnapshot> {
  const dates = periodDates(period)
  const from = dates[0]
  const to = dates[dates.length - 1]

  const [staffRes, reqRes, asgRes, subRes, needRes, ovrRes] = await Promise.all([
    supabase.from('staff_names').select('*'),
    supabase.from('shift_requests').select('*').gte('work_date', from).lte('work_date', to),
    supabase.from('shift_assignments').select('*').gte('work_date', from).lte('work_date', to),
    supabase.from('shift_submissions').select('*').eq('period_key', periodKey(period)),
    supabase.from('shift_requirements').select('*'),
    supabase.from('shift_requirement_overrides').select('*').gte('work_date', from).lte('work_date', to),
  ])

  const staff = (staffRes.data ?? []) as StaffName[]
  const requests = (reqRes.data ?? []) as ShiftRequest[]
  const assignments = (asgRes.data ?? []) as ShiftAssignment[]
  const submissions = (subRes.data ?? []) as ShiftSubmission[]
  const requirements = (needRes.data ?? []) as ShiftRequirement[]
  const overrides = (ovrRes.data ?? []) as ShiftRequirementOverride[]

  const members: StaffMember[] = staff
    .filter((s) => s.active !== false)
    .map((s) => ({ name: s.name, role: s.role, position: s.position }))
  const byName = new Map(members.map((m) => [m.name, m]))

  const needByWeekday: Record<number, Requirement> = {}
  for (const r of requirements) {
    needByWeekday[r.weekday] = {
      total_needed: r.total_needed,
      hall_needed: r.hall_needed,
      kitchen_needed: r.kitchen_needed,
      staff_needed: r.staff_needed,
    }
  }
  const overrideMap: Record<string, Requirement> = {}
  for (const o of overrides) {
    overrideMap[o.work_date] = {
      total_needed: o.total_needed,
      hall_needed: o.hall_needed,
      kitchen_needed: o.kitchen_needed,
      staff_needed: o.staff_needed,
    }
  }

  const statuses = dates.map((date) => {
    const dayRequests = requests.filter((r) => r.work_date === date)
    const offNames = new Set(dayRequests.filter((r) => r.kind === 'off').map((r) => r.staff_name))
    const wantNames = new Set(dayRequests.filter((r) => r.kind === 'want').map((r) => r.staff_name))
    const assigned = assignments
      .filter((a) => a.work_date === date)
      .map((a) => byName.get(a.staff_name))
      .filter((m): m is StaffMember => m != null)
    return dayStatus(
      date,
      requirementFor(date, needByWeekday, overrideMap),
      assigned,
      members.filter((m) => !offNames.has(m.name)),
      members.filter((m) => wantNames.has(m.name)),
    )
  })

  const submitted = new Set(submissions.map((s) => s.staff_name))
  return { members, statuses, notSubmitted: members.filter((m) => !submitted.has(m.name)) }
}
