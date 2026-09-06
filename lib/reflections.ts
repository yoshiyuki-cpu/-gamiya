import type { ReflectionKind } from './supabase'

/** 画面と集計に必要な最小限。DBの行そのままでも使える。 */
export type ReflectionLike = {
  id: number
  note_date: string
  kind: ReflectionKind
  body: string
  staff_name: string | null
  resolved_at: string | null
  hidden: boolean
}

export const KIND_LABEL: Record<ReflectionKind, string> = {
  good: '良かった事',
  bad: '悪かった事',
}

export const KIND_ICON: Record<ReflectionKind, string> = {
  good: '👍',
  bad: '⚠',
}

/** 本文の前後の空白と、改行だらけをならす。空なら ''。 */
export function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t　]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** まだ直していない悪かった事。 */
export function isOpen(r: ReflectionLike): boolean {
  return r.kind === 'bad' && !r.resolved_at && !r.hidden
}

export function visibleRows<T extends ReflectionLike>(rows: T[]): T[] {
  return rows.filter((r) => !r.hidden)
}

export type ReflectionCounts = { good: number; bad: number; open: number }

/** sinceKey('YYYY-MM-DD')以降だけ数える。省略なら全部。 */
export function countRows(rows: ReflectionLike[], sinceKey?: string): ReflectionCounts {
  const counts: ReflectionCounts = { good: 0, bad: 0, open: 0 }
  for (const r of rows) {
    if (r.hidden) continue
    if (sinceKey && r.note_date < sinceKey) continue
    if (r.kind === 'good') counts.good += 1
    else counts.bad += 1
    if (isOpen(r)) counts.open += 1
  }
  return counts
}

export type DateGroup<T> = { date: string; rows: T[] }

/** 日付ごとにまとめて新しい順。同じ日の中は id の小さい順(書いた順)。 */
export function groupByDate<T extends ReflectionLike>(rows: T[]): DateGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    if (r.hidden) continue
    const list = map.get(r.note_date)
    if (list) list.push(r)
    else map.set(r.note_date, [r])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, list]) => ({ date, rows: list.slice().sort((a, b) => a.id - b.id) }))
}

export type StaffCount = { name: string; good: number; bad: number }

/** 誰が何件書いたか。多い順。名前なしは「名前なし」にまとめる。 */
export function byStaff(rows: ReflectionLike[], sinceKey?: string): StaffCount[] {
  const map = new Map<string, StaffCount>()
  for (const r of rows) {
    if (r.hidden) continue
    if (sinceKey && r.note_date < sinceKey) continue
    const name = (r.staff_name ?? '').trim() || '名前なし'
    const cur = map.get(name) ?? { name, good: 0, bad: 0 }
    if (r.kind === 'good') cur.good += 1
    else cur.bad += 1
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => b.good + b.bad - (a.good + a.bad) || a.name.localeCompare(b.name, 'ja'))
}

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土']

/** '2026-09-06' → '9/6(日)' */
export function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  const wd = WEEKDAY[new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${wd})`
}
