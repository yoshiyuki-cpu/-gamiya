import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl, broadcastLine, jstBusinessDayKey, KEEP_REMAINING, rejectIfNotCron } from '@/lib/lineNotify'

// Vercel Cron から毎日呼ばれる。まだ今日のX投稿が記録されていなければ、
// LINE公式アカウントの友だち全員(= 登録したスタッフ)にリマインドを送る。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

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
    '17時30分前後の投稿をお願いします!\n\n' +
    '投稿できたら、アプリの「日報」画面で\n「投稿した」を押してください。' +
    (link ? `\n${link}/reports` : '')

  const result = await broadcastLine(text, { keepRemaining: KEEP_REMAINING.xPost })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  if (!result.sent) {
    return NextResponse.json({ notified: false, reason: 'quota', remaining: result.remaining })
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
