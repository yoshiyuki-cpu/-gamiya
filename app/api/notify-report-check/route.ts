import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl, broadcastLine, jstBusinessDayKey, rejectIfNotCron } from '@/lib/lineNotify'

// Vercel Cron から毎日15時(JST)に呼ばれる。前日分の報告業務がまだ記録
// されていなければ、LINE公式アカウントの友だち全員にリマインドを送る。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

  const checkDate = jstBusinessDayKey()
  const { data: existing, error } = await supabase
    .from('report_checks')
    .select('check_date')
    .eq('check_date', checkDate)
    .maybeSingle()

  if (error) {
    console.error('notify-report-check: supabase read failed', error)
    return NextResponse.json({ error: '報告業務の記録の確認に失敗しました' }, { status: 500 })
  }

  // 対応済みの日は通知しない。無料枠(月200通)の節約にもなる。
  if (existing) {
    return NextResponse.json({ notified: false, reason: 'already done', checkDate })
  }

  const link = appUrl()
  const text =
    '📋 前日分の報告業務のリマインドです\n\n' +
    '・報告業務はやりましたか?\n' +
    '・社長に報告することがありますか?\n\n' +
    '済んだらアプリの「日報」画面で記録してください。' +
    (link ? `\n${link}/reports` : '')

  const result = await broadcastLine(text)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ notified: true, checkDate })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
