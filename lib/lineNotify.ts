import { NextRequest, NextResponse } from 'next/server'

// LINEリマインド用の共通処理。通知の種類が増えても同じ約束事で動くよう、
// 日付の計算・Cronの認証・LINEへの送信をここにまとめている。

const RESET_HOUR = 5
const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'
const LINE_QUOTA_URL = 'https://api.line.me/v2/bot/message/quota'
const LINE_CONSUMPTION_URL = 'https://api.line.me/v2/bot/message/quota/consumption'

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

/**
 * 今月あと何通送れるか。無制限のプランや、確認できなかった場合は null。
 * 確認できないことを理由に送信を止めはしない(届かない方が困るため)。
 */
export async function remainingMessages(token: string): Promise<number | null> {
  try {
    const headers = { Authorization: `Bearer ${token}` }
    const [quotaRes, usedRes] = await Promise.all([
      fetch(LINE_QUOTA_URL, { headers }),
      fetch(LINE_CONSUMPTION_URL, { headers }),
    ])
    if (!quotaRes.ok || !usedRes.ok) return null

    const quota = (await quotaRes.json()) as { type?: string; value?: number }
    if (quota.type !== 'limited' || typeof quota.value !== 'number') return null

    const used = (await usedRes.json()) as { totalUsage?: number | string }
    const usedCount = Number(used.totalUsage ?? 0)
    if (!Number.isFinite(usedCount)) return null

    return Math.max(0, quota.value - usedCount)
  } catch (e) {
    console.error('remainingMessages failed', e)
    return null
  }
}

export type BroadcastResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: 'quota'; remaining: number }
  | { ok: false; status: number; message: string }

/**
 * 通知ごとの「ここまで減ったらもう送らない」通数。
 * 枠が尽きかけたとき、数字の大きい通知から順に落ちていく。
 * 報告業務は毎日の義務なので、枠がある限り最後まで送る。
 */
export const KEEP_REMAINING = {
  reportCheck: 0,
  // シフトは締め切りに間に合わないと組めなくなるので、日々の声かけより優先する。
  shiftReminder: 6,
  shiftReport: 9,
  xPost: 15,
  shiftHelpWanted: 21,
  tomorrowReservations: 30,
  morningMeeting: 45,
} as const

export type BroadcastOptions = {
  /**
   * 残りがこの通数を下回るなら送らない。無料枠(月200通)は
   * 「友だちの人数 × 送信回数」で減るので、枠が尽きるとその月は
   * どの通知も届かなくなる。大事な通知ほど最後まで残るように、
   * 優先度の低い通知に大きめの数を持たせて先に落とす。
   */
  keepRemaining?: number
}

// LINEは1通5000文字まで。超えると送信自体が失敗して1件も届かないので、
// 長い日は末尾を切ってでも必ず送る。絵文字が割れないよう文字単位で数える。
const LINE_TEXT_LIMIT = 4900

export function clampForLine(text: string): string {
  const chars = Array.from(text)
  if (chars.length <= LINE_TEXT_LIMIT) return text
  return chars.slice(0, LINE_TEXT_LIMIT).join('') + '\n…(続きはアプリで確認してください)'
}

/** LINE公式アカウントの友だち全員(= 登録したスタッフ)に送る。 */
export async function broadcastLine(text: string, options: BroadcastOptions = {}): Promise<BroadcastResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('broadcastLine: LINE_CHANNEL_ACCESS_TOKEN is not set')
    return { ok: false, status: 500, message: 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません' }
  }

  const keep = options.keepRemaining ?? 0
  if (keep > 0) {
    const remaining = await remainingMessages(token)
    if (remaining !== null && remaining < keep) {
      console.warn(`broadcastLine: skipped, remaining=${remaining} < keep=${keep}`)
      return { ok: true, sent: false, reason: 'quota', remaining }
    }
  }

  const res = await fetch(LINE_BROADCAST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ type: 'text', text: clampForLine(text) }] }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('broadcastLine failed', res.status, detail)
    return { ok: false, status: 502, message: 'LINEへの送信に失敗しました' }
  }
  return { ok: true, sent: true }
}
