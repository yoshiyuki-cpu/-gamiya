export type MailStatus = 'sent' | 'not_configured' | 'failed'
export type MailResult = { status: MailStatus; to?: string[] }
export type MailAttachment = { filename: string; /** base64 */ content: string }

/**
 * Resend(メール送信サービス)で、REPORT_MAIL_TO に送る。環境変数が足りなければ送らずに終わる。
 * 呼び出し元の処理(日報づくり・バックアップ)を止めないよう、例外は投げない。
 */
export async function sendMail(subject: string, text: string, attachments?: MailAttachment[]): Promise<MailResult> {
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
      body: JSON.stringify({ from, to, subject, text, ...(attachments?.length ? { attachments } : {}) }),
      signal: AbortSignal.timeout(attachments?.length ? 30000 : 10000),
    })
    if (!res.ok) {
      console.error('mail failed', res.status, await res.text().catch(() => ''))
      return { status: 'failed' }
    }
    return { status: 'sent', to }
  } catch (err) {
    console.error('mail error', err)
    return { status: 'failed' }
  }
}
