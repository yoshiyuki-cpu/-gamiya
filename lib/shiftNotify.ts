// シフトのLINE通知の文面。ルート側に置くとテストできないので、
// 純粋な組み立てだけここに切り出す。
import { dayLabel, periodLabel, type DayStatus, type ShiftPeriod, type StaffMember } from './shifts'

/** 締め切りの何日前に声をかけるか。当日も含める。 */
export const REMINDER_DAYS_BEFORE = [5, 2, 0]

export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const from = Date.UTC(fy, fm - 1, fd)
  const to = Date.UTC(ty, tm - 1, td)
  return Math.round((to - from) / 86400000)
}

export function buildReminderMessage(
  period: ShiftPeriod,
  deadline: string,
  daysLeft: number,
  notSubmitted: StaffMember[],
  link: string | null,
): string {
  const when = daysLeft === 0 ? '本日が締め切りです' : `あと${daysLeft}日で締め切りです`
  const head = `🗓 ${periodLabel(period)}のシフト希望\n${when}(${dayLabel(deadline)})\n`
  const names = notSubmitted.map((m) => m.name).join('、')
  const body = `\nまだ出していない人:\n${names}\n\nアプリの「シフト」から、休みたい日を押して提出してください。`
  return head + body + (link ? `\n${link}/shifts` : '')
}

export function buildReportMessage(
  period: ShiftPeriod,
  statuses: DayStatus[],
  notSubmitted: StaffMember[],
  link: string | null,
): string {
  const short = statuses.filter((s) => s.shortage > 0)
  const over = statuses.filter((s) => s.surplus > 0)
  const warn = statuses.filter((s) => s.shortage === 0 && (s.staffShortage > 0 || s.hallShortage > 0 || s.kitchenShortage > 0))

  const lines: string[] = [`📋 ${periodLabel(period)}のシフト状況`]
  lines.push(`足りない日 ${short.length}日 ・ 多すぎる日 ${over.length}日`)

  if (notSubmitted.length > 0) {
    lines.push(`\n⚠️ 未提出: ${notSubmitted.map((m) => m.name).join('、')}`)
  }

  if (short.length > 0) {
    lines.push('\n【人が足りない日】')
    for (const s of short) {
      const canCome = s.available.filter((m) => !s.assigned.some((a) => a.name === m.name))
      const who = canCome.length > 0 ? `出られる人: ${canCome.map((m) => m.name).join('、')}` : '出られる人がいません'
      lines.push(`・${dayLabel(s.date)} ${s.assigned.length}/${s.need.total_needed}人 (あと${s.shortage}人)\n　${who}`)
    }
  }

  if (warn.length > 0) {
    lines.push('\n【人数は足りているが偏っている日】')
    for (const s of warn) {
      const detail: string[] = []
      if (s.staffShortage > 0) detail.push('社員がいない')
      if (s.hallShortage > 0) detail.push(`ホールがあと${s.hallShortage}人`)
      if (s.kitchenShortage > 0) detail.push(`キッチンがあと${s.kitchenShortage}人`)
      lines.push(`・${dayLabel(s.date)} ${detail.join(' / ')}`)
    }
  }

  if (over.length > 0) {
    lines.push('\n【人が多い日】どなたを外すか決めてください')
    for (const s of over) {
      lines.push(`・${dayLabel(s.date)} ${s.assigned.length}/${s.need.total_needed}人 (${s.surplus}人多い)\n　${s.assigned.map((m) => m.name).join('、')}`)
    }
  }

  if (short.length === 0 && over.length === 0 && warn.length === 0 && notSubmitted.length === 0) {
    lines.push('\n過不足はありません。このまま確定して大丈夫です。')
  }

  return lines.join('\n') + (link ? `\n\n${link}/shifts` : '')
}

export function buildHelpWantedMessage(period: ShiftPeriod, statuses: DayStatus[], link: string | null): string {
  const short = statuses.filter((s) => s.shortage > 0)
  if (short.length === 0) return ''

  const lines: string[] = ['🙏 シフトのお願い', `${periodLabel(period)}で、人が足りない日があります。`, '']
  for (const s of short) {
    const canCome = s.available.filter((m) => !s.assigned.some((a) => a.name === m.name))
    lines.push(`・${dayLabel(s.date)} あと${s.shortage}人`)
    if (canCome.length > 0) lines.push(`　(${canCome.map((m) => m.name).join('、')}さんは休み希望を出していません)`)
  }
  lines.push('', '入れる方は、アプリの「シフト」からその日を「入りたい」にしてください。')
  return lines.join('\n') + (link ? `\n${link}/shifts` : '')
}
