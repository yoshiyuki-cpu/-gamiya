import type { DailyRecord, Item } from './supabase'

// The business day rolls over at 5am, not midnight, since the store operates
// past midnight — a 2am check-in still belongs to the previous calendar day's sheet.
const RESET_HOUR = 5

function businessDate(): Date {
  const d = new Date()
  if (d.getHours() < RESET_HOUR) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

function dateKeyFor(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return dateKeyFor(businessDate())
}

export function todayLabelText(): string {
  return businessDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
}

// The [start, end) instant range for the business day identified by dateKey
// (a 'YYYY-MM-DD' string from todayKey), used to scope timestamp-column queries
// (e.g. wall_orders.created_at) to the same 5am-to-5am window.
export function businessDayRange(dateKey: string): { start: string; end: string } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const start = new Date(y, m - 1, d, RESET_HOUR, 0, 0, 0)
  const end = new Date(y, m - 1, d + 1, RESET_HOUR, 0, 0, 0)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function currentTimeLabel(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function timerElapsedMs(accumulatedMs: number, startedAt: string | null): number {
  return accumulatedMs + (startedAt ? Date.now() - new Date(startedAt).getTime() : 0)
}

export function isDone(item: Item, record: DailyRecord | undefined): boolean {
  if (item.has_quantity) {
    const v = record?.quantity_value
    return !!(v && v.trim() !== '')
  }
  return !!record?.checked
}
