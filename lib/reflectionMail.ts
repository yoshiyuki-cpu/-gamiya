import { dateLabel } from './reflections'
import { sendMail } from './mail'
import type { MailResult } from './mail'

export type MailReflection = { kind: 'good' | 'bad'; body: string; staff_name: string | null }


const INDENT = '　'

function bullet(r: MailReflection): string {
  const lines = r.body.trim().split('\n')
  const who = r.staff_name?.trim() ? `(${r.staff_name.trim()})` : ''
  return ['・' + lines[0], ...lines.slice(1).map((l) => INDENT + l)].join('\n') + who
}

/** その日の全員分の良かった事・悪かった事を、メールの件名と本文にする。 */
export function buildReflectionMail(
  reportDate: string,
  rows: MailReflection[],
  appUrl?: string,
): { subject: string; text: string } {
  const label = dateLabel(reportDate)
  const good = rows.filter((r) => r.kind === 'good')
  const bad = rows.filter((r) => r.kind === 'bad')

  const section = (title: string, list: MailReflection[]) =>
    [`■ ${title}(${list.length}件)`, ...(list.length ? list.map(bullet) : ['なし'])].join('\n')

  const text = [
    `${label} の良かった事・悪かった事です(全員分)。`,
    rows.length === 0 ? 'この日はまだ誰も記録していません。' : '',
    section('良かった事', good),
    section('悪かった事', bad),
    appUrl ? `アプリで見る: ${appUrl.replace(/\/$/, '')}/reflections` : '',
  ]
    .filter((s) => s !== '')
    .join('\n\n')

  return { subject: `【がみや】${label} 良かった事・悪かった事(全員分)`, text }
}

/** 日報づくりのたびに、その日の全員分を送る。 */
export function sendReflectionMail(subject: string, text: string): Promise<MailResult> {
  return sendMail(subject, text)
}
