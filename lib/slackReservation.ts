// Slackに書かれた1行(例:「9/5 19時 田中様 4名」)を予約に読み替える。
// ここは純粋な関数だけ。Slackとの通信は lib/slack.ts、DBは route 側。

import {
  DEFAULT_DURATION_SLOTS,
  OPEN_HOUR,
  SEATS,
  SLOT_MINUTES,
  SOURCES,
  TOTAL_SLOTS,
  overlaps,
  rangeLabel,
  seatsLabel,
  shiftDate,
  sortSeats,
  type SeatHold,
} from './reservations'

const RESET_HOUR = 5

export type ParsedReservation = {
  reserve_date: string
  start_slot: number
  duration_slots: number
  name: string | null
  party_size: number | null
  child_size: number | null
  phone: string | null
  course: string | null
  source: string | null
}

/** 読み取った材料。ルールで抜いてもAIで抜いても、ここに揃えてから予約にする。 */
export type ReservationFields = {
  date?: string | null // 'YYYY-MM-DD'
  time?: string | null // 'HH:MM'(26時制可)
  name?: string | null
  party_size?: number | null
  child_size?: number | null
  phone?: string | null
  course?: string | null
  source?: string | null
}

// ---- 日本時間 ----

type JstNow = { y: number; m: number; d: number; hour: number }

/** サーバーはUTCなので、日本時間の「今」を組み立てる。 */
export function jstNow(now = new Date()): JstNow {
  const t = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hour: t.getUTCHours() }
}

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 営業日(朝5時区切り)の今日。深夜1時の「今日」は前日の営業。 */
export function businessTodayKey(now = new Date()): string {
  const j = jstNow(now)
  const key = keyOf(j.y, j.m, j.d)
  return j.hour < RESET_HOUR ? shiftDate(key, -1) : key
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

// ---- 文字の整え ----

function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[／]/g, '/')
    .replace(/[〜～]/g, '~')
    .replace(/[－‐]/g, '-')
}

/** Slackのメンションやリンクの飾りを外し、空白を1つにそろえる。 */
export function normalizeText(raw: string): string {
  return toHalfWidth(raw)
    .replace(/<@[A-Z0-9]+>/g, ' ')
    .replace(/<#[A-Z0-9]+\|[^>]*>/g, ' ')
    .replace(/<([^>|]+)(\|[^>]*)?>/g, '$1')
    .replace(/[ \t　]+/g, ' ')
    .trim()
}

// ---- 日付・時刻 ----

/** 「9/5」「9月5日」「5日」「今日」「明日」「あさって」を 'YYYY-MM-DD' に。 */
export function parseDate(text: string, now = new Date()): string | null {
  const today = businessTodayKey(now)
  if (/明後日|あさって/.test(text)) return shiftDate(today, 2)
  if (/明日|あした|あす/.test(text)) return shiftDate(today, 1)
  if (/今日|本日|きょう/.test(text)) return today

  const [ty, tm] = today.split('-').map(Number)

  const md = text.match(/(?<![\d:])(\d{1,2})\s*[/月]\s*(\d{1,2})\s*日?(?![\d:分])/)
  if (md) {
    const m = Number(md[1])
    const d = Number(md[2])
    if (!validDate(ty, m, d)) return null
    let key = keyOf(ty, m, d)
    // 12月に「1/10」と書けば来年。ただし数日前の日付は今年のまま(遅れて入れることがある)。
    if (daysBetween(today, key) < -60) key = keyOf(ty + 1, m, d)
    return key
  }

  const dOnly = text.match(/(?<![\d/月:])(\d{1,2})\s*日(?![\d分])/)
  if (dOnly) {
    const d = Number(dOnly[1])
    if (!validDate(ty, tm, d)) return null
    let key = keyOf(ty, tm, d)
    // 「5日」と書いて今月の5日が過ぎていれば来月の5日。
    if (daysBetween(today, key) < -1) {
      const ny = tm === 12 ? ty + 1 : ty
      const nm = tm === 12 ? 1 : tm + 1
      if (!validDate(ny, nm, d)) return null
      key = keyOf(ny, nm, d)
    }
    return key
  }
  return null
}

/** 「19時」「19:30」「19時半」「7時」(→19時) を 'HH:MM' に。26時制。 */
export function parseTime(text: string): string | null {
  const m = text.match(/(?<![\d/])(\d{1,2})\s*(?::|時)\s*(半|\d{2})?\s*(?:分)?/)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] === '半' ? 30 : m[2] ? Number(m[2]) : 0
  if (minute > 59) return null
  // 焼肉屋の予約は夕方以降。「7時」は19時のこと。
  if (hour < 12) hour += 12
  // 深夜0〜2時は24〜26時に読み替える(hour<12で+12されて12〜14になる)。
  if (hour >= 12 && hour <= 14 && Number(m[1]) <= 2) hour += 12
  return `${hour}:${String(minute).padStart(2, '0')}`
}

/** 'HH:MM' → コマ番号。営業時間の外なら null。15分刻みでなければ近い方に寄せる。 */
export function slotOf(time: string): number | null {
  const [h, mi] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null
  const minutes = h * 60 + mi - OPEN_HOUR * 60
  const slot = Math.round(minutes / SLOT_MINUTES)
  return slot >= 0 && slot < TOTAL_SLOTS ? slot : null
}

// ---- 人数・名前・その他 ----

function parseParty(text: string): { party: number | null; child: number | null } {
  const adults = text.match(/大人\s*(\d{1,2})/)
  const child = text.match(/(?:子供|子ども|こども|お子様|お子さま|小人|小学生|幼児)\s*(\d{1,2})/) ?? text.match(/(\d{1,2})\s*(?:子供|子ども|こども|お子様|お子さま|小人)/)
  const childN = child ? Number(child[1]) : null
  if (adults) {
    return { party: Number(adults[1]) + (childN ?? 0), child: childN }
  }
  // 「子供2名」の「2名」を大人の人数と取り違えないよう、子供の部分を消してから探す。
  const stripped = text.replace(/(?:子供|子ども|こども|お子様|お子さま|小人|小学生|幼児)\s*\d{1,2}\s*(?:名|人)?/g, ' ')
  const total = stripped.match(/(\d{1,2})\s*(?:名|人|めい)(?:様|さま)?/)
  if (total) return { party: Number(total[1]), child: childN }
  return { party: null, child: childN }
}

function parseName(text: string): string | null {
  const cleaned = text.replace(/お子様|お子さま/g, ' ')
  const m = cleaned.match(/([^\s\d/:~,、。()（）]{1,12}?)\s*(?:様|さま|さん)/)
  if (!m) return null
  const name = m[1].replace(/^(予約|ご予約|名前|お名前)/, '').trim()
  return name || null
}

function parsePhone(text: string): string | null {
  const m = text.match(/0\d{1,4}-?\d{1,4}-?\d{3,4}/)
  return m ? m[0] : null
}

function parseCourse(text: string): string | null {
  const m = text.match(/([^\s、。,]{1,12}コース)/)
  return m ? m[1] : null
}

const SOURCE_ALIASES: [RegExp, string][] = [
  [/電話|でんわ|TEL/i, '電話'],
  [/google|グーグル|ぐーぐる/i, 'Google'],
  [/食べログ|たべろぐ/, '食べログ'],
  [/ぐるなび/, 'ぐるなび'],
  [/instagram|インスタ/i, 'Instagram'],
  [/tiktok|ティックトック/i, 'TikTok'],
  [/\bLINE\b|ライン/i, 'LINE'],
  [/AI検索|ChatGPT|チャットGPT/i, 'AI検索'],
  [/当日来店|飛び込み|ウォークイン/, '当日来店'],
  [/\bX\b.*(から|経由)|旧twitter|twitter/i, 'X'],
]

function parseSource(text: string): string | null {
  for (const [re, label] of SOURCE_ALIASES) {
    if (re.test(text)) return label
  }
  return null
}

/** 材料が揃っていれば予約に。日付と時刻が無ければ null。 */
export function buildReservation(f: ReservationFields): ParsedReservation | null {
  if (!f.date || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return null
  const [y, m, d] = f.date.split('-').map(Number)
  if (!validDate(y, m, d)) return null
  if (!f.time) return null
  const start = slotOf(f.time)
  if (start === null) return null
  const party = f.party_size != null && f.party_size > 0 && f.party_size < 100 ? Math.floor(f.party_size) : null
  const child = f.child_size != null && f.child_size >= 0 && f.child_size < 100 ? Math.floor(f.child_size) : null
  const source = f.source && (SOURCES as readonly string[]).includes(f.source) ? f.source : null
  return {
    reserve_date: f.date,
    start_slot: start,
    duration_slots: DEFAULT_DURATION_SLOTS,
    name: f.name?.trim() || null,
    party_size: party,
    child_size: child,
    phone: f.phone?.trim() || null,
    course: f.course?.trim() || null,
    source,
  }
}

/** ルールで読む。読めなければ null(そのときはAIに回す)。 */
export function parseReservationMessage(raw: string, now = new Date()): ParsedReservation | null {
  const text = normalizeText(raw)
  if (!text) return null
  const date = parseDate(text, now)
  // 日付の部分を消してから時刻を探す(「9/5」の 5 を 5時と読まないため)。
  const withoutDate = text
    .replace(/(?<![\d:])\d{1,2}\s*[/月]\s*\d{1,2}\s*日?/, ' ')
    .replace(/(?<![\d/月:])\d{1,2}\s*日(?![\d分])/, ' ')
  const time = parseTime(withoutDate)
  const { party, child } = parseParty(withoutDate)
  return buildReservation({
    date,
    time,
    name: parseName(withoutDate),
    party_size: party,
    child_size: child,
    phone: parsePhone(text),
    course: parseCourse(text),
    source: parseSource(text),
  })
}

/** スレッドの返信が「取消」の意味か。 */
export function isCancelText(raw: string): boolean {
  const t = normalizeText(raw)
  return /^(取消|取り消し|とりけし|キャンセル|きゃんせる|中止|やめ|なし)/.test(t) || /(取消|取り消し|キャンセル)(で|に|し|お願い|して)/.test(t)
}

// ---- 卓の自動割り当て ----

/**
 * 空いている卓を1つ選ぶ。4名まではテーブル、5名以上は座敷。
 * 9名以上は隣り合う座敷2つ。空きが無ければ [](予約表で選んでもらう)。
 */
export type SeatUse = Pick<SeatHold, 'seats' | 'start_slot' | 'duration_slots'>

export function pickSeats(partySize: number | null, holds: SeatUse[], startSlot: number, durationSlots: number): string[] {
  const busy = new Set<string>()
  for (const h of holds) {
    if (overlaps(h, { start_slot: startSlot, duration_slots: durationSlots })) h.seats.forEach((s) => busy.add(s))
  }
  const free = SEATS.filter((s) => !busy.has(s.id))
  const tables = free.filter((s) => s.kind === 'table').map((s) => s.id)
  const zashiki = free.filter((s) => s.kind === 'zashiki').map((s) => s.id)
  const size = partySize ?? 2

  if (size >= 9) {
    const all = SEATS.filter((s) => s.kind === 'zashiki').map((s) => s.id)
    for (let i = 0; i + 1 < all.length; i++) {
      if (!busy.has(all[i]) && !busy.has(all[i + 1])) return [all[i], all[i + 1]]
    }
    return zashiki.length ? [zashiki[0]] : []
  }
  if (size >= 5) return zashiki.length ? [zashiki[0]] : tables.length ? [tables[0]] : []
  return tables.length ? [tables[0]] : zashiki.length ? [zashiki[0]] : []
}

// ---- Slackへの返事 ----

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土']

/** '2026-09-05' → '9/5(土)'。サーバーのタイムゾーンに左右されない。 */
export function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}/${d}(${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`
}

export function describeReservation(r: ParsedReservation & { seats: string[] }): string {
  const who = r.name ? `${r.name}様` : 'お名前なし'
  const people =
    r.party_size != null ? `${r.party_size}名${r.child_size ? `(うち子供${r.child_size})` : ''}` : '人数未定'
  const seat = r.seats.length ? `卓: ${seatsLabel(sortSeats(r.seats))}` : '卓: 空きがないので予約表で選んでください'
  const extras = [r.course, r.phone, r.source ? `経路: ${r.source}` : null].filter(Boolean).join(' / ')
  return `${shortDate(r.reserve_date)} ${rangeLabel(r.start_slot, r.duration_slots)} ${who} ${people}\n${seat}${extras ? `\n${extras}` : ''}`
}

export function confirmationText(r: ParsedReservation & { seats: string[] }, link: string | null): string {
  return (
    `✅ 予約表に入れました\n${describeReservation(r)}\n` +
    `違っていたら、このスレッドに「取消」と返信してから書き直してください。` +
    (link ? `\n${link}/reservations` : '')
  )
}

export const USAGE_HINT =
  '読み取れませんでした。日付と時刻を入れてください。\n例) 9/5 19時 田中様 4名\n例) 明日 18時半 佐藤様 大人4 子供2 電話'
