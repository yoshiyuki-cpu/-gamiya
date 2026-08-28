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

// テーブルは1〜4、座敷は5〜8。1組が複数の卓を使うこともある(座敷を繋ぐ大人数)。
// 人数(party_size)は記録するだけで、卓の数は消費しない。
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

export const SEAT_IDS = SEATS.map((s) => s.id)

export function seatIndex(id: string): number {
  return SEAT_IDS.indexOf(id)
}

/** 卓を並び順にそろえる。表示も判定も、いつも同じ順で見えるように。 */
export function sortSeats(seats: string[]): string[] {
  return seats.slice().sort((a, b) => seatIndex(a) - seatIndex(b))
}

export function seatsLabel(seats: string[]): string {
  return sortSeats(seats).join('・')
}

/**
 * 並びが続いている卓のかたまりに分ける。
 * 座敷を2つ繋いだ予約は1つの帯で描きたいが、離れた卓を使う場合もあるため。
 */
export function seatRuns(seats: string[]): string[][] {
  const sorted = sortSeats(seats.filter((s) => seatIndex(s) >= 0))
  const runs: string[][] = []
  for (const id of sorted) {
    const last = runs[runs.length - 1]
    if (last && seatIndex(id) === seatIndex(last[last.length - 1]) + 1) last.push(id)
    else runs.push([id])
  }
  return runs
}

/** 時間が重なっているか。片方の終わりと他方の始まりが同じなら重ならない。 */
export function overlaps(
  a: { start_slot: number; duration_slots: number },
  b: { start_slot: number; duration_slots: number },
): boolean {
  return a.start_slot < b.start_slot + b.duration_slots && b.start_slot < a.start_slot + a.duration_slots
}

// ---- 来店の状態 ----
// 予約表が当日に役立つかどうかは、ここが全部です。
// 「入っている」だけでなく「来ているか」が見えないと、空いた卓に
// 飛び込みのお客様を入れる判断ができません。
export type ReservationStatus = 'booked' | 'seated' | 'done' | 'cancelled' | 'noshow'

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  booked: '未来店',
  seated: '来店中',
  done: '退店',
  cancelled: 'キャンセル',
  noshow: '無断キャンセル',
}

/** 卓を空けて数える状態。キャンセルと無断キャンセルは席を押さえない。 */
export function holdsSeat(status: ReservationStatus): boolean {
  return status === 'booked' || status === 'seated' || status === 'done'
}

/** 予約として数える状態。キャンセル分を売上見込みに入れないため。 */
export function countsAsGuest(status: ReservationStatus): boolean {
  return status === 'booked' || status === 'seated' || status === 'done'
}

/** 予約時刻からこれだけ過ぎても未来店なら、遅れているとみなす。 */
export const LATE_AFTER_SLOTS = 1 // 15分

/** 今が何コマ目か。営業時間の外なら null。 */
export function currentSlot(now = new Date()): number | null {
  // 深夜は前日の営業として数える(26時制)。
  const hour = now.getHours() < OPEN_HOUR - 12 ? now.getHours() + 24 : now.getHours()
  const minutes = (hour - OPEN_HOUR) * 60 + now.getMinutes()
  const slot = Math.floor(minutes / SLOT_MINUTES)
  return slot >= 0 && slot < TOTAL_SLOTS ? slot : null
}

export function isLate(
  r: { start_slot: number; status: ReservationStatus },
  nowSlot: number | null,
): boolean {
  if (r.status !== 'booked' || nowSlot === null) return false
  return nowSlot >= r.start_slot + LATE_AFTER_SLOTS
}

// ---- 予約経路 ----
// どこから来たお客様かを残す。広報や広告にかけた手間が
// 実際に組数になっているかを、あとから数えられるようにする。
export const SOURCES = [
  '電話',
  'Google',
  '食べログ',
  'ぐるなび',
  'Instagram',
  'X',
  'TikTok',
  'LINE',
  'AI検索',
  '当日来店',
  'その他',
] as const

export type ReservationSource = (typeof SOURCES)[number]

// ---- 空き状況 ----
// 「今日の19時台、あと何卓空いているか」を出す。電話を受けながら
// 表を目で数えるのは無理があるため。
export type SeatHold = {
  seats: string[]
  start_slot: number
  duration_slots: number
  status: ReservationStatus
}

export function occupiedSeatsAt(list: SeatHold[], slot: number): Set<string> {
  const used = new Set<string>()
  for (const r of list) {
    if (!holdsSeat(r.status)) continue
    if (slot < r.start_slot || slot >= r.start_slot + r.duration_slots) continue
    for (const s of r.seats) used.add(s)
  }
  return used
}

/** 1時間ごとの空き卓数。その時間のどこかで埋まる卓は、埋まっている扱い。 */
export function freeSeatsByHour(list: SeatHold[]): { hour: number; free: number }[] {
  const out: { hour: number; free: number }[] = []
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    const base = (hour - OPEN_HOUR) * (60 / SLOT_MINUTES)
    const used = new Set<string>()
    for (let i = 0; i < 60 / SLOT_MINUTES; i++) {
      for (const s of occupiedSeatsAt(list, base + i)) used.add(s)
    }
    out.push({ hour, free: SEATS.length - used.size })
  }
  return out
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
