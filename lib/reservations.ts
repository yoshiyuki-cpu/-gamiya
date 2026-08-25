// 予約表の時間とお席の決まりごと。
// 時間は「17:00から15分刻みで何コマ目か」という整数で持つ。
// 日付や時刻の型を持たせるより、重なりの判定も前後のずらしも単純になる。

export const OPEN_HOUR = 17
export const CLOSE_HOUR = 26 // 深夜2時。焼肉店の慣習どおり26時と表記する
export const SLOT_MINUTES = 15
export const TOTAL_SLOTS = ((CLOSE_HOUR - OPEN_HOUR) * 60) / SLOT_MINUTES // 36

/** 90分 = 6コマ。基本はこれ。 */
export const DEFAULT_DURATION_SLOTS = 6

export const DURATION_CHOICES = [
  { slots: 4, label: '60分' },
  { slots: 6, label: '90分' },
  { slots: 8, label: '120分' },
  { slots: 12, label: '180分' },
]

export type SeatKind = 'table' | 'zashiki'
export type Seat = { id: string; kind: SeatKind }

// テーブルは1〜4、座敷は5〜8。
export const SEATS: Seat[] = [
  { id: 'T1', kind: 'table' },
  { id: 'T2', kind: 'table' },
  { id: 'T3', kind: 'table' },
  { id: 'T4', kind: 'table' },
  { id: 'Z5', kind: 'zashiki' },
  { id: 'Z6', kind: 'zashiki' },
  { id: 'Z7', kind: 'zashiki' },
  { id: 'Z8', kind: 'zashiki' },
]

/** コマ番号 → 「17:00」「25:30」のような表示。26時制のまま出す。 */
export function slotLabel(slot: number): string {
  const total = OPEN_HOUR * 60 + slot * SLOT_MINUTES
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** 「17:00〜18:30」のような範囲表示。 */
export function rangeLabel(startSlot: number, durationSlots: number): string {
  return `${slotLabel(startSlot)}〜${slotLabel(startSlot + durationSlots)}`
}

export function durationLabel(durationSlots: number): string {
  const min = durationSlots * SLOT_MINUTES
  return min % 60 === 0 ? `${min / 60}時間` : `${Math.floor(min / 60)}時間${min % 60}分`
}

/** 同じ席で時間が重なっているか。片方の終わりと他方の始まりが同じなら重ならない。 */
export function overlaps(
  a: { start_slot: number; duration_slots: number },
  b: { start_slot: number; duration_slots: number },
): boolean {
  return a.start_slot < b.start_slot + b.duration_slots && b.start_slot < a.start_slot + a.duration_slots
}

/** 営業時間からはみ出さないか。 */
export function fitsInDay(startSlot: number, durationSlots: number): boolean {
  return startSlot >= 0 && startSlot + durationSlots <= TOTAL_SLOTS
}

/** 日付キー(YYYY-MM-DD)を前後に動かす。 */
export function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function dateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
}
