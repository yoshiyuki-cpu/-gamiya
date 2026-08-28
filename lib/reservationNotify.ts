// 翌日の予約一覧をLINEに流すときの文面。
// ルート側に置くとテストしづらいので、純粋な組み立てだけここに切り出す。
import { countsAsGuest, seatsLabel, slotLabel } from './reservations'
import type { Reservation } from './supabase'

export function nextDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function dateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  return `${m}月${d}日`
}

export function buildTomorrowMessage(dateKey: string, all: Reservation[], link: string | null): string {
  // キャンセルと無断キャンセルは仕込みに数えない。
  const list = all.filter((r) => countsAsGuest(r.status))
  const guests = list.reduce((sum, r) => sum + (r.party_size ?? 0), 0)
  const children = list.reduce((sum, r) => sum + (r.child_size ?? 0), 0)
  const head =
    `🗓 明日(${dateLabel(dateKey)})の予約\n${list.length}組 ・ 合計${guests}名` +
    (children > 0 ? `(うち子供${children}名)` : '') +
    '\n'

  // 0件の日も送る。仕込みを減らす判断材料になるため。
  if (list.length === 0) {
    return (
      `${head}\n現時点で予約は入っていません。\n仕込みの量はこれを目安に調整してください。` +
      (link ? `\n${link}/reservations` : '')
    )
  }

  const lines = list.map((r) => {
    const parts = [`${slotLabel(r.start_slot)} ${seatsLabel(r.seats)} ${r.name ?? '(名前なし)'}`]
    if (r.party_size) parts.push(`${r.party_size}名`)
    if (r.course) parts.push(r.course)
    let line = '・' + parts.join(' ')
    if (r.note) line += `\n　※${r.note}`
    return line
  })

  // 備考は仕込みに直結するので、末尾にもう一度まとめて出す。
  const notes = list.filter((r) => r.note)
  const noteBlock =
    notes.length > 0
      ? '\n\n【仕込み・取り置き】\n' +
        notes.map((r) => `・${slotLabel(r.start_slot)} ${r.name ?? seatsLabel(r.seats)} … ${r.note}`).join('\n')
      : ''

  // 長すぎる日の切り詰めは broadcastLine 側でまとめて行う。
  return `${head}\n${lines.join('\n')}${noteBlock}` + (link ? `\n\n${link}/reservations` : '')
}
