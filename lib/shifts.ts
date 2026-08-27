// シフトの決まりごと。
// 月を2つに割って組む。1日〜15日を「前半」、16日〜末日を「後半」と呼ぶ。
// 日付は 'YYYY-MM-DD' の文字列で持つ。Dateを持ち回すとタイムゾーンで
// ずれるため、予約表と同じく素直な文字列で扱う。

export type HalfId = 'first' | 'second'

export type ShiftPeriod = {
  year: number
  month: number // 1〜12
  half: HalfId
}

export type StaffRole = 'staff' | 'parttime'
export type StaffPosition = 'hall' | 'kitchen' | 'both'

export const ROLE_LABEL: Record<StaffRole, string> = { staff: '社員', parttime: 'アルバイト' }
export const POSITION_LABEL: Record<StaffPosition, string> = {
  hall: 'ホール',
  kitchen: 'キッチン',
  both: '両方',
}

/** 休み希望の状態。何も出していない日は「出られる」とみなす。 */
export type RequestKind = 'off' | 'want'

const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土']

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

/** 0=日曜 … 6=土曜。 */
export function weekdayOf(key: string): number {
  const { year, month, day } = parseDateKey(key)
  return new Date(year, month - 1, day).getDay()
}

export function weekdayLabel(key: string): string {
  return WEEKDAY_LABEL[weekdayOf(key)]
}

/** 「9/20(金)」。シフト表は日付が主役なので月日と曜日だけ出す。 */
export function dayLabel(key: string): string {
  const { month, day } = parseDateKey(key)
  return `${month}/${day}(${weekdayLabel(key)})`
}

export function periodOf(key: string): ShiftPeriod {
  const { year, month, day } = parseDateKey(key)
  return { year, month, half: day <= 15 ? 'first' : 'second' }
}

/** '2026-09-first'。提出状況の記録などに使う。 */
export function periodKey(p: ShiftPeriod): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}-${p.half}`
}

export function periodLabel(p: ShiftPeriod): string {
  return p.half === 'first' ? `${p.month}月前半(1日〜15日)` : `${p.month}月後半(16日〜${lastDayOfMonth(p.year, p.month)}日)`
}

export function periodDates(p: ShiftPeriod): string[] {
  const from = p.half === 'first' ? 1 : 16
  const to = p.half === 'first' ? 15 : lastDayOfMonth(p.year, p.month)
  const days: string[] = []
  for (let d = from; d <= to; d++) days.push(dateKey(p.year, p.month, d))
  return days
}

export function nextPeriod(p: ShiftPeriod): ShiftPeriod {
  if (p.half === 'first') return { ...p, half: 'second' }
  return p.month === 12 ? { year: p.year + 1, month: 1, half: 'first' } : { year: p.year, month: p.month + 1, half: 'first' }
}

export function prevPeriod(p: ShiftPeriod): ShiftPeriod {
  if (p.half === 'second') return { ...p, half: 'first' }
  return p.month === 1 ? { year: p.year - 1, month: 12, half: 'second' } : { year: p.year, month: p.month - 1, half: 'second' }
}

export function samePeriod(a: ShiftPeriod, b: ShiftPeriod): boolean {
  return a.year === b.year && a.month === b.month && a.half === b.half
}

/**
 * 希望提出の締め切り。
 * 前半(1日〜15日)は前の月の指定日、後半(16日〜末日)は同じ月の指定日。
 * 既定は前半=前月20日 / 後半=当月5日。設定画面で変えられる。
 */
export function deadlineOf(p: ShiftPeriod, firstHalfDay: number, secondHalfDay: number): string {
  if (p.half === 'second') {
    return dateKey(p.year, p.month, Math.min(secondHalfDay, lastDayOfMonth(p.year, p.month)))
  }
  const year = p.month === 1 ? p.year - 1 : p.year
  const month = p.month === 1 ? 12 : p.month - 1
  return dateKey(year, month, Math.min(firstHalfDay, lastDayOfMonth(year, month)))
}

/** その日に何人必要か。日ごとの上書きがあればそちらを優先する。 */
export type Requirement = {
  total_needed: number
  hall_needed: number
  kitchen_needed: number
  staff_needed: number
}

export const DEFAULT_REQUIREMENT: Requirement = {
  total_needed: 3,
  hall_needed: 2,
  kitchen_needed: 1,
  staff_needed: 1,
}

export function requirementFor(
  key: string,
  byWeekday: Record<number, Requirement>,
  overrides: Record<string, Requirement>,
): Requirement {
  return overrides[key] ?? byWeekday[weekdayOf(key)] ?? DEFAULT_REQUIREMENT
}

export type StaffMember = {
  name: string
  role: StaffRole
  position: StaffPosition
}

/** 1日ぶんの過不足。 */
export type DayStatus = {
  date: string
  need: Requirement
  /** 確定した人。 */
  assigned: StaffMember[]
  /** 休み希望を出していない＝出られる人。 */
  available: StaffMember[]
  /** 「入りたい」と出している人。 */
  wants: StaffMember[]
  shortage: number
  surplus: number
  hallShortage: number
  kitchenShortage: number
  staffShortage: number
}

function countPosition(members: StaffMember[], position: 'hall' | 'kitchen'): number {
  // 「両方」の人はどちらにも数える。実際にどちらへ回すかは当日の判断なので、
  // ここでは「回せる人がいるか」だけを見る。
  return members.filter((m) => m.position === position || m.position === 'both').length
}

export function dayStatus(
  date: string,
  need: Requirement,
  assigned: StaffMember[],
  available: StaffMember[],
  wants: StaffMember[],
): DayStatus {
  const staffCount = assigned.filter((m) => m.role === 'staff').length
  return {
    date,
    need,
    assigned,
    available,
    wants,
    shortage: Math.max(0, need.total_needed - assigned.length),
    surplus: Math.max(0, assigned.length - need.total_needed),
    hallShortage: Math.max(0, need.hall_needed - countPosition(assigned, 'hall')),
    kitchenShortage: Math.max(0, need.kitchen_needed - countPosition(assigned, 'kitchen')),
    staffShortage: Math.max(0, need.staff_needed - staffCount),
  }
}

/**
 * シフト案を自動で組む。
 * 「入りたい」を先に、次に出勤数の少ない人から埋める。
 * 埋まらない日は埋まらないまま返す。足りないことを隠さないのが目的。
 */
export function draftAssignments(
  dates: string[],
  needs: Record<string, Requirement>,
  members: StaffMember[],
  offBy: Record<string, Set<string>>, // date -> 休みの人の名前
  wantBy: Record<string, Set<string>>, // date -> 入りたい人の名前
  alreadyAssigned: Record<string, string[]> = {},
): Record<string, string[]> {
  const counts = new Map<string, number>(members.map((m) => [m.name, 0]))
  for (const names of Object.values(alreadyAssigned)) {
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  }

  const result: Record<string, string[]> = {}

  for (const date of dates) {
    const need = needs[date] ?? DEFAULT_REQUIREMENT
    const fixed = alreadyAssigned[date] ?? []
    const picked = [...fixed]

    const off = offBy[date] ?? new Set<string>()
    const want = wantBy[date] ?? new Set<string>()
    const pool = members.filter((m) => !off.has(m.name) && !picked.includes(m.name))

    // 社員の最低人数を先に満たす。ホールとキッチンも同じ考え方で先に埋める。
    const pickBy = (test: (m: StaffMember) => boolean, until: () => boolean) => {
      const candidates = pool
        .filter((m) => !picked.includes(m.name) && test(m))
        .sort((a, b) => {
          const wa = want.has(a.name) ? 0 : 1
          const wb = want.has(b.name) ? 0 : 1
          if (wa !== wb) return wa - wb
          const ca = counts.get(a.name) ?? 0
          const cb = counts.get(b.name) ?? 0
          if (ca !== cb) return ca - cb
          return a.name < b.name ? -1 : 1
        })
      for (const m of candidates) {
        if (until()) break
        picked.push(m.name)
        counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
      }
    }

    const staffCount = () => picked.filter((n) => members.find((m) => m.name === n)?.role === 'staff').length
    const posCount = (p: 'hall' | 'kitchen') =>
      picked.filter((n) => {
        const m = members.find((x) => x.name === n)
        return m ? m.position === p || m.position === 'both' : false
      }).length

    pickBy((m) => m.role === 'staff', () => staffCount() >= need.staff_needed || picked.length >= need.total_needed)
    pickBy(
      (m) => m.position === 'hall' || m.position === 'both',
      () => posCount('hall') >= need.hall_needed || picked.length >= need.total_needed,
    )
    pickBy(
      (m) => m.position === 'kitchen' || m.position === 'both',
      () => posCount('kitchen') >= need.kitchen_needed || picked.length >= need.total_needed,
    )
    pickBy(() => true, () => picked.length >= need.total_needed)

    result[date] = picked
  }

  return result
}
