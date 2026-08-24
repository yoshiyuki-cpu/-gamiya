import { NextRequest, NextResponse } from 'next/server'

// LINEリマインド用の共通処理。通知の種類が増えても同じ約束事で動くよう、
// 日付の計算・Cronの認証・LINEへの送信をここにまとめている。

const RESET_HOUR = 5
const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'

/**
 * JSTの営業日(朝5時区切り)のキー。
 * サーバーのタイムゾーンはUTCなので、クライアント側の todayKey() と
 * 同じ日付になるようここでズレを吸収する。
 */
export function jstBusinessDayKey(now = Date.now()): string {
  const jst = new Date(now + 9 * 60 * 60 * 1000)
  if (jst.getUTCHours() < RESET_HOUR) jst.setUTCDate(jst.getUTCDate() - 1)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** LINEのメッセージに載せるアプリのURL。未設定ならVercelの本番URLを使う。 */
export function appUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : null
}

/**
 * Vercel Cron からの呼び出しか確かめる。CRON_SECRET を Bearer トークンで送ってくる。
 * 未設定なら検証しない(ローカルでの手動確認用)。
 * 問題なければ null、弾く場合はそのまま返せるレスポンスを返す。
 */
export function rejectIfNotCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export type BroadcastResult = { ok: true } | { ok: false; status: number; message: string }

/** LINE公式アカウントの友だち全員(= 登録したスタッフ)に送る。 */
export async function broadcastLine(text: string): Promise<BroadcastResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('broadcastLine: LINE_CHANNEL_ACCESS_TOKEN is not set')
    return { ok: false, status: 500, message: 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません' }
  }

  const res = await fetch(LINE_BROADCAST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('broadcastLine failed', res.status, detail)
    return { ok: false, status: 502, message: 'LINEへの送信に失敗しました' }
  }
  return { ok: true }
}
