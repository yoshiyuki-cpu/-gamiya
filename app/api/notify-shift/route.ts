import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl, broadcastLine, jstBusinessDayKey, KEEP_REMAINING, rejectIfNotCron } from '@/lib/lineNotify'
import { deadlineOf, nextPeriod, periodOf, type ShiftPeriod } from '@/lib/shifts'
import {
  buildHelpWantedMessage,
  buildReminderMessage,
  buildReportMessage,
  daysBetween,
  REMINDER_DAYS_BEFORE,
} from '@/lib/shiftNotify'
import { loadPeriod } from '@/lib/shiftServer'

// Vercel Cron から毎日呼ばれる。その日にやることがあるときだけLINEに流す。
//   締め切りの5日前/2日前/当日 … まだ希望を出していない人がいれば催促
//   締め切りの翌日           … 店長へ過不足の報告
//   その後2日おき            … まだ足りない日があればお願い
// 1日に送るのは多くても1通。無料枠を食い潰さないため。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** 締め切りが過ぎたあと、足りない日のお願いを送る間隔(締め切りから何日後か)。 */
const HELP_WANTED_DAYS_AFTER = [2, 5, 8]

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

  const today = jstBusinessDayKey()

  const { data: settingsRow } = await supabase.from('shift_settings').select('*').eq('id', 1).maybeSingle()
  const firstDay = (settingsRow?.first_half_deadline_day as number) ?? 20
  const secondDay = (settingsRow?.second_half_deadline_day as number) ?? 5

  // 今と、その先2つぶんの期間を見る。締め切りは期間の始まりより前にあるため。
  const current = periodOf(today)
  const candidates: ShiftPeriod[] = [current, nextPeriod(current), nextPeriod(nextPeriod(current))]
  const withDeadline = candidates.map((p) => ({ period: p, deadline: deadlineOf(p, firstDay, secondDay) }))

  const link = appUrl()

  // 1) 締め切り前の催促。締め切りが最も近い期間だけを見る。
  const upcoming = withDeadline
    .filter((x) => daysBetween(today, x.deadline) >= 0)
    .sort((a, b) => daysBetween(today, a.deadline) - daysBetween(today, b.deadline))[0]

  if (upcoming) {
    const daysLeft = daysBetween(today, upcoming.deadline)
    if (REMINDER_DAYS_BEFORE.includes(daysLeft)) {
      const snap = await loadPeriod(supabase, upcoming.period)
      if (snap.notSubmitted.length > 0) {
        const text = buildReminderMessage(upcoming.period, upcoming.deadline, daysLeft, snap.notSubmitted, link)
        const result = await broadcastLine(text, { keepRemaining: KEEP_REMAINING.shiftReminder })
        if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
        return NextResponse.json({
          notified: result.sent,
          kind: 'reminder',
          daysLeft,
          waiting: snap.notSubmitted.length,
        })
      }
    }
  }

  // 2) 締め切りの翌日は、店長へ過不足を報告する。
  const closed = withDeadline.find((x) => daysBetween(x.deadline, today) === 1)
  if (closed) {
    const snap = await loadPeriod(supabase, closed.period)
    const text = buildReportMessage(closed.period, snap.statuses, snap.notSubmitted, link)
    const result = await broadcastLine(text, { keepRemaining: KEEP_REMAINING.shiftReport })
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
    return NextResponse.json({ notified: result.sent, kind: 'report' })
  }

  // 3) そのあとは、まだ足りない日があるときだけお願いする。
  const afterClose = withDeadline.find((x) => HELP_WANTED_DAYS_AFTER.includes(daysBetween(x.deadline, today)))
  if (afterClose) {
    const snap = await loadPeriod(supabase, afterClose.period)
    const text = buildHelpWantedMessage(afterClose.period, snap.statuses, link)
    if (text) {
      const result = await broadcastLine(text, { keepRemaining: KEEP_REMAINING.shiftHelpWanted })
      if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
      return NextResponse.json({ notified: result.sent, kind: 'help-wanted' })
    }
  }

  return NextResponse.json({ notified: false, reason: 'nothing to do', today })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
