import { dateLabel } from './reflections'

export type MailReflection = { kind: 'good' | 'bad'; body: string; staff_name: string | null }

export type MailStatus = 'sent' | 'not_configured' | 'failed'
export type MailResult = { status: MailStatus; to?: string[] }

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

/**
 * Resend(メール送信サービス)で送る。環境変数が足りなければ送らずに終わる。
 * メールが送れなくても日報づくりは止めないので、例外は投げない。
 */
export async function sendReflectionMail(subject: string, text: string): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const to = (process.env.REPORT_MAIL_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!apiKey || to.length === 0) return { status: 'not_configured' }

  const from = process.env.REPORT_MAIL_FROM || 'がみやアプリ <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.error('reflection mail failed', res.status, await res.text().catch(() => ''))
      return { status: 'failed' }
    }
    return { status: 'sent', to }
  } catch (err) {
    console.error('reflection mail error', err)
    return { status: 'failed' }
  }
}
