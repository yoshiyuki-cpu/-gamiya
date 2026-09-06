import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl } from '@/lib/lineNotify'
import { holdsSeat, type ReservationStatus } from '@/lib/reservations'
import { addReaction, postThreadReply, verifySlackSignature } from '@/lib/slack'
import {
  USAGE_HINT,
  buildReservation,
  businessTodayKey,
  confirmationText,
  isCancelText,
  parseReservationMessage,
  pickSeats,
  type ParsedReservation,
  type ReservationFields,
  type SeatUse,
} from '@/lib/slackReservation'

// Slackの予約チャンネルに書かれた1行を予約表に入れる。
//   「9/5 19時 田中様 4名」 → 予約を作ってスレッドに ✅ で返す
//   スレッドに「取消」        → その予約をキャンセルにする
// Slackは3秒以内に返事が無いと同じ投稿をもう一度送ってくるので、
// 再送(x-slack-retry-num)は受け取るだけにし、投稿のts で二重登録を防ぐ。

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-anthropic-key' })

type SlackEvent = {
  type: string
  subtype?: string
  bot_id?: string
  channel?: string
  user?: string
  text?: string
  ts?: string
  thread_ts?: string
}

type SlackPayload = {
  type: string
  challenge?: string
  event?: SlackEvent
}

function allowedChannel(channel: string | undefined): boolean {
  const list = (process.env.SLACK_RESERVATION_CHANNEL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // 未設定なら、Botが招待されているチャンネル全部で受ける。
  return list.length === 0 || (!!channel && list.includes(channel))
}

/** ルールで読めなかったときだけAIに読ませる。曖昧なものは null で返す。 */
async function parseWithAi(text: string, now: Date): Promise<ParsedReservation | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const today = businessTodayKey(now)
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            `焼肉店の予約チャンネルに書かれた次の文から、予約の情報をJSONだけで返してください。今日は ${today} です。\n` +
            `形式: {"date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"name":string|null,"party_size":number|null,"child_size":number|null,"phone":string|null,"course":string|null,"source":"電話"|"Google"|"食べログ"|"ぐるなび"|"Instagram"|"X"|"TikTok"|"LINE"|"AI検索"|"当日来店"|"その他"|null}\n` +
            `時刻は24時間表記(深夜0〜2時は24〜26で)。名前は敬称を除く。予約の話でなければ全部 null。\n\n文: ${text}`,
        },
      ],
    })
    const block = message.content[0]
    if (block.type !== 'text') return null
    const json = block.text.match(/\{[\s\S]*\}/)?.[0]
    if (!json) return null
    const fields = JSON.parse(json) as ReservationFields
    return buildReservation(fields)
  } catch (err) {
    console.error('slack parseWithAi failed', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret) {
    console.error('SLACK_SIGNING_SECRET is not set')
    return NextResponse.json({ error: 'SLACK_SIGNING_SECRET が未設定です' }, { status: 500 })
  }
  if (!verifySlackSignature(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'), secret)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  let payload: SlackPayload
  try {
    payload = JSON.parse(raw) as SlackPayload
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  // Slackの「Request URL」登録時の確認。
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge ?? '' })
  }
  if (payload.type !== 'event_callback' || !payload.event) return NextResponse.json({ ok: true })

  // 再送は受け取ったことにだけする(初回の処理が進んでいる)。
  if (req.headers.get('x-slack-retry-num')) return NextResponse.json({ ok: true, retry: 'ignored' })

  const ev = payload.event
  if (ev.type !== 'message' || ev.subtype || ev.bot_id || !ev.text || !ev.channel || !ev.ts) {
    return NextResponse.json({ ok: true })
  }
  if (!allowedChannel(ev.channel)) return NextResponse.json({ ok: true, skipped: 'channel' })

  const token = process.env.SLACK_BOT_TOKEN
  const reply = (text: string) => (token ? postThreadReply(token, ev.channel!, ev.thread_ts ?? ev.ts!, text) : Promise.resolve(false))
  const react = (name: string) => (token ? addReaction(token, ev.channel!, ev.ts!, name) : Promise.resolve(false))

  // ---- スレッドの返信: 「取消」だけ扱う ----
  if (ev.thread_ts && ev.thread_ts !== ev.ts) {
    if (!isCancelText(ev.text)) return NextResponse.json({ ok: true })
    const { data: target } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('slack_ts', ev.thread_ts)
      .maybeSingle()
    if (!target) {
      await reply('この投稿から入れた予約が見つかりませんでした。予約表で直してください。')
      return NextResponse.json({ ok: true })
    }
    if ((target.status as ReservationStatus) !== 'booked') {
      await reply('この予約はもう来店・退店・キャンセルのどれかになっています。予約表で確認してください。')
      return NextResponse.json({ ok: true })
    }
    const { error } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', target.id)
    if (error) {
      console.error('slack cancel failed', error)
      await reply(`キャンセルにできませんでした(${error.message})。予約表で直してください。`)
      return NextResponse.json({ ok: true })
    }
    await Promise.all([reply('🚫 キャンセルにしました。書き直すときは新しく投稿してください。'), react('no_entry_sign')])
    return NextResponse.json({ ok: true })
  }

  // ---- 新しい投稿: 予約として読む ----
  const now = new Date()
  const parsed = parseReservationMessage(ev.text, now) ?? (await parseWithAi(ev.text, now))
  if (!parsed) {
    // チャンネルを予約専用に絞っているときだけ、読めなかったと返す(雑談に反応しないため)。
    if (process.env.SLACK_RESERVATION_CHANNEL) await reply(USAGE_HINT)
    return NextResponse.json({ ok: true, parsed: false })
  }

  // 同じ投稿を二度入れない。
  const { data: dup } = await supabase.from('reservations').select('id').eq('slack_ts', ev.ts).maybeSingle()
  if (dup) return NextResponse.json({ ok: true, duplicate: true })

  const { data: sameDay, error: loadError } = await supabase
    .from('reservations')
    .select('seats, start_slot, duration_slots, status')
    .eq('reserve_date', parsed.reserve_date)
  if (loadError) {
    console.error('slack load reservations failed', loadError)
    const missingColumn = /slack_ts|slack_channel/.test(loadError.message ?? '')
    await reply(
      missingColumn
        ? '予約表の準備ができていません(supabase-migration-slack-reservations.sql を実行してください)。'
        : `予約表を読めませんでした(${loadError.message})。予約表から直接入れてください。`,
    )
    return NextResponse.json({ ok: true, error: loadError.message })
  }
  const holds: SeatUse[] = (sameDay ?? [])
    .filter((r) => holdsSeat(r.status as ReservationStatus))
    .map((r) => ({ seats: (r.seats as string[]) ?? [], start_slot: r.start_slot, duration_slots: r.duration_slots }))
  const seats = pickSeats(parsed.party_size, holds, parsed.start_slot, parsed.duration_slots)

  const { error } = await supabase.from('reservations').insert({
    ...parsed,
    seats,
    note: `Slackから: ${ev.text.trim()}`,
    is_walk_in: false,
    status: 'booked',
    seated_at: null,
    slack_channel: ev.channel,
    slack_ts: ev.ts,
  })
  if (error) {
    console.error('slack insert reservation failed', error)
    const missingColumn = /slack_ts|slack_channel/.test(error.message ?? '')
    await reply(
      missingColumn
        ? '予約表の準備ができていません(supabase-migration-slack-reservations.sql を実行してください)。'
        : `予約表に入れられませんでした(${error.message})。予約表から直接入れてください。`,
    )
    return NextResponse.json({ ok: true, error: error.message })
  }

  await Promise.all([reply(confirmationText({ ...parsed, seats }, appUrl())), react('white_check_mark')])
  return NextResponse.json({ ok: true, reserved: true })
}
