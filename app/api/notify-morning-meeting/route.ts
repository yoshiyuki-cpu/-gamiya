import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl, broadcastLine, jstBusinessDayKey, KEEP_REMAINING, rejectIfNotCron } from '@/lib/lineNotify'

// Vercel Cron から毎日16時50分(JST)に呼ばれる。本日の朝礼がまだ議事録に
// 記録されていなければ、LINE公式アカウントの友だち全員に知らせる。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const MORNING_CATEGORY = 'morning'

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

  const meetingDate = jstBusinessDayKey()
  // 議事録の「朝礼」がその日の分として既にあるなら、済んでいるとみなす。
  const { data: existing, error } = await supabase
    .from('meetings')
    .select('id')
    .eq('meeting_date', meetingDate)
    .eq('category', MORNING_CATEGORY)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('notify-morning-meeting: supabase read failed', error)
    return NextResponse.json({ error: '朝礼の記録の確認に失敗しました' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ notified: false, reason: 'already recorded', meetingDate })
  }

  const link = appUrl()
  const text =
    '🕐 朝礼の時間です(16:50)\n\n' +
    '本日の朝礼をお願いします。\n' +
    '内容はアプリの「議事録」画面から残せます。' +
    (link ? `\n${link}/meetings` : '')

  const result = await broadcastLine(text, { keepRemaining: KEEP_REMAINING.morningMeeting })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  if (!result.sent) {
    return NextResponse.json({ notified: false, reason: 'quota', remaining: result.remaining })
  }

  return NextResponse.json({ notified: true, meetingDate })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
