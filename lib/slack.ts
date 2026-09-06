import { createHmac, timingSafeEqual } from 'node:crypto'

// Slackとの通信。署名の確認と、スレッドへの返事・リアクションだけ。

const SLACK_API = 'https://slack.com/api'

/**
 * Slackからの呼び出しか確かめる(Signing Secret)。
 * 5分より古いものは、盗み取った内容の再送とみなして弾く。
 */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()): boolean {
  if (!timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 60 * 5) return false
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function call(method: string, token: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!json.ok) console.error(`slack ${method} failed`, json.error)
    return !!json.ok
  } catch (err) {
    console.error(`slack ${method} error`, err)
    return false
  }
}

/** スレッドに返事する。 */
export function postThreadReply(token: string, channel: string, threadTs: string, text: string): Promise<boolean> {
  return call('chat.postMessage', token, { channel, thread_ts: threadTs, text })
}

/** 元の投稿に絵文字を付ける(✅ など)。 */
export function addReaction(token: string, channel: string, ts: string, name: string): Promise<boolean> {
  return call('reactions.add', token, { channel, timestamp: ts, name })
}
