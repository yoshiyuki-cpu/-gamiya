import type { TimeBreak, TimeEntry } from './supabase'

// 営業日の切り替え時刻。lib/checklist.ts と揃えている。
const RESET_HOUR = 5

export type StaffState = 'off' | 'working' | 'onBreak'

/** 「HH:MM」表記。深夜1時なども素直に 01:00 と出す。 */
export function timeLabel(iso: string | null): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 労働時間の表示。「6:30」のように時:分で出す(秒は使わない)。 */
export function durationLabel(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`
}

/** Excelでそのまま足し算できるよう、小数の時間(6.5 = 6時間30分)も出す。 */
export function durationHours(ms: number): string {
  return (Math.max(0, Math.round(ms / 60000)) / 60).toFixed(2)
}

export function breakMs(breaks: TimeBreak[], now = Date.now()): number {
  return breaks.reduce((sum, b) => {
    const start = new Date(b.break_start).getTime()
    const end = b.break_end ? new Date(b.break_end).getTime() : now
    return sum + Math.max(0, end - start)
  }, 0)
}

/** 実労働時間 = 退勤 - 出勤 - 休憩。勤務中・休憩中は「今この瞬間まで」で計算する。 */
export function workedMs(entry: TimeEntry, breaks: TimeBreak[], now = Date.now()): number {
  if (!entry.clock_in) return 0
  const start = new Date(entry.clock_in).getTime()
  const end = entry.clock_out ? new Date(entry.clock_out).getTime() : now
  return Math.max(0, end - start - breakMs(breaks, now))
}

export function stateOf(entry: TimeEntry | undefined, breaks: TimeBreak[]): StaffState {
  if (!entry || entry.clock_out) return 'off'
  return breaks.some((b) => !b.break_end) ? 'onBreak' : 'working'
}

/**
 * 営業日と「HH:MM」から実際の日時を組み立てる。
 * 5時より前の時刻は翌日の出来事として扱う(17:00〜翌1:00の勤務があるため)。
 * これがないと、退勤を 01:00 に直したときに出勤より前になってしまう。
 */
export function composeAt(workDate: string, hhmm: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDate)
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!dm || !tm) return null
  const [, y, mo, d] = dm
  const hh = Number(tm[1])
  const mi = Number(tm[2])
  if (hh > 23 || mi > 59) return null
  const dayOffset = hh < RESET_HOUR ? 1 : 0
  return new Date(Number(y), Number(mo) - 1, Number(d) + dayOffset, hh, mi, 0, 0).toISOString()
}

/**
 * 打刻を別の勤務日へ付け替える。時刻(HH:MM)はそのままに、日付だけを動かす。
 * 勤務日を直すとき、出勤・退勤・休憩の時刻はすべて work_date から
 * 組み立てられているため、日付だけ変えると時刻が前の日に取り残される。
 * 深夜1時の退勤は移した先でも「翌日の1時」になる(composeAt の決まりどおり)。
 */
export function reanchorTo(iso: string | null, newWorkDate: string): string | null {
  if (!iso) return null
  return composeAt(newWorkDate, timeLabel(iso))
}

// 月の扱いは予約表のカレンダーと同じものを使う。2か所に書くと片方だけ直る。
export { currentMonthKey, monthLabel, monthRange, shiftMonth } from './months'
