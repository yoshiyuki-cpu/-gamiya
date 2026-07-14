import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// See app/api/transcribe-meeting/route.ts for why the placeholder fallback is needed.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-anthropic-key' })
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const reportDate = typeof body?.reportDate === 'string' && body.reportDate ? body.reportDate : todayKey()
  const dayStart = `${reportDate}T00:00:00`
  const dayEnd = `${reportDate}T23:59:59`

  const [{ data: items }, { data: records }, { data: orders }, { data: meetings }] = await Promise.all([
    supabase.from('items').select('id, text, has_quantity'),
    supabase.from('daily_records').select('item_id, checked, quantity_value').eq('record_date', reportDate),
    supabase
      .from('wall_orders')
      .select('table_number, item_name, quantity, completed_at')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('meetings')
      .select('title, summary_overview, summary_decisions, summary_action_items')
      .eq('meeting_date', reportDate),
  ])

  const total = (items ?? []).length
  const recordsByItem = new Map((records ?? []).map((r) => [r.item_id, r]))
  const doneCount = (items ?? []).filter((it) => {
    const r = recordsByItem.get(it.id)
    return it.has_quantity ? !!(r?.quantity_value && r.quantity_value.trim()) : !!r?.checked
  }).length

  const totalOrders = (orders ?? []).length
  const completedOrders = (orders ?? []).filter((o) => o.completed_at).length
  const orderLines = (orders ?? []).map(
    (o) => `- 卓${o.table_number} ${o.item_name}×${o.quantity}${o.completed_at ? '(対応済)' : '(未対応)'}`,
  )

  const meetingLines = (meetings ?? []).map(
    (m) =>
      `- ${m.title ?? '会議'}: ${m.summary_overview ?? 'なし'} / 決定事項:${m.summary_decisions ?? 'なし'} / 宿題:${m.summary_action_items ?? 'なし'}`,
  )

  const context =
    `対象日: ${reportDate}\n\n` +
    `【開店準備チェックリスト】 ${doneCount}/${total} 完了\n\n` +
    `【壁紙メニュー注文】 合計${totalOrders}件(対応済${completedOrders}件)\n${orderLines.join('\n') || 'なし'}\n\n` +
    `【会議記録】\n${meetingLines.join('\n') || 'なし'}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                '以下は焼肉店「がみや」の1日分の業務データです。オーナー向けに、その日の営業の要点を日本語で簡潔にまとめてください(箇条書き可)。' +
                '開店準備の進み具合、壁紙メニュー注文の様子、会議で決まったことや宿題があれば触れてください。データが乏しい項目は無理に書かなくて構いません。\n\n' +
                context,
            },
          ],
        },
      ],
    })

    const block = message.content[0]
    const summary = block.type === 'text' ? block.text.trim() : ''
    const stats = { checklistTotal: total, checklistDone: doneCount, ordersTotal: totalOrders, ordersCompleted: completedOrders }

    const { data, error } = await supabase
      .from('daily_reports')
      .upsert({ report_date: reportDate, summary, stats }, { onConflict: 'report_date' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('generate-daily-report error', err)
    return NextResponse.json({ error: '日報の作成に失敗しました' }, { status: 500 })
  }
}
