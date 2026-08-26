import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl, broadcastLine, jstBusinessDayKey, rejectIfNotCron } from '@/lib/lineNotify'
import { buildTomorrowMessage, nextDay } from '@/lib/reservationNotify'
import type { Reservation } from '@/lib/supabase'

// Vercel Cron から毎日23時(JST)に呼ばれる。翌日の予約一覧をLINEに流す。
// 前日のうちに仕込み量を決められるようにするのが目的。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

  const target = nextDay(jstBusinessDayKey())
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('reserve_date', target)
    .order('start_slot')

  if (error) {
    console.error('notify-tomorrow-reservations: supabase read failed', error)
    return NextResponse.json({ error: '予約の取得に失敗しました' }, { status: 500 })
  }

  const list = (data ?? []) as Reservation[]
  const result = await broadcastLine(buildTomorrowMessage(target, list, appUrl()))
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ notified: true, date: target, count: list.length })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
