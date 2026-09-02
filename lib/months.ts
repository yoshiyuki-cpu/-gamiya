// 「YYYY-MM」で月を扱うための決まりごと。
// 勤怠の月次集計と、予約表のカレンダーで同じものを使う。
// 日付は 'YYYY-MM-DD' の文字列で持つ(Dateを持ち回すとタイムゾーンでずれるため)。

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 'YYYY-MM' の月に含まれる日付の範囲(月末日も含む)。 */
export function monthRange(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` }
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}年${m}月`
}

/** 選択中の月から前後に動かす。 */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 'YYYY-MM-DD' から 'YYYY-MM' を取り出す。 */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/**
 * カレンダーに並べるマス。日曜始まりで、月の前後は null で埋める。
 * 週の途中で月が始まっても、曜日の列がずれないようにするため。
 */
export function monthCells(monthKey: string): (string | null)[] {
  const [y, m] = monthKey.split('-').map(Number)
  const firstWeekday = new Date(y, m - 1, 1).getDay() // 0=日曜
  const lastDay = new Date(y, m, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
