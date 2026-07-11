import type { DailyRecord, Item } from './supabase'

export function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLabelText(): string {
  const d = new Date()
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
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
