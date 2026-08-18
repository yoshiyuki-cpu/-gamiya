import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Vercel Cron から毎日呼ばれる。まだ今日のX投稿が記録されていなければ、
// LINE公式アカウントの友だち全員(= 登録したスタッフ)にリマインドを送る。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const RESET_HOUR = 5
const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'

// サーバーのタイムゾーンはUTCなので、JSTの営業日(朝5時区切り)を明示的に計算する。
// クライアント側の todayKey() と同じ日付キーになる必要があるため、ここでズレを吸収する。
function jstBusinessDayKey(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  if (jst.getUTCHours() < RESET_HOUR) jst.setUTCDate(jst.getUTCDate() - 1)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function appUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : null
}

async function handle(req: NextRequest) {
  // Vercel Cron は CRON_SECRET を Bearer トークンとして送ってくる。
  // 未設定なら検証しない(ローカルでの手動確認用)。
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('notify-x-post: LINE_CHANNEL_ACCESS_TOKEN is not set')
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません' }, { status: 500 })
  }

  const postDate = jstBusinessDayKey()
  const { data: existing, error } = await supabase.from('x_posts').select('post_date').eq('post_date', postDate).maybeSingle()

  if (error) {
    console.error('notify-x-post: supabase read failed', error)
    return NextResponse.json({ error: '投稿記録の確認に失敗しました' }, { status: 500 })
  }

  // 投稿済みの日は通知しない。無料枠(月200通)の節約にもなる。
  if (existing) {
    return NextResponse.json({ notified: false, reason: 'already posted', postDate })
  }

  const link = appUrl()
  const text =
    '📣 Xの投稿リマインドです\n\n' +
    '本日はまだ投稿が記録されていません。\n' +
    '18時前後の投稿をお願いします!\n\n' +
    '投稿できたら、アプリの「日報」画面で\n「投稿した」を押してください。' +
    (link ? `\n${link}/reports` : '')

  const res = await fetch(LINE_BROADCAST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('notify-x-post: LINE broadcast failed', res.status, detail)
    return NextResponse.json({ error: 'LINEへの送信に失敗しました', status: res.status }, { status: 502 })
  }

  return NextResponse.json({ notified: true, postDate })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
