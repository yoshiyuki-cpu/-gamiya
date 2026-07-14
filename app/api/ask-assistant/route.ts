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

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 })
  }

  const today = todayKey()

  const [{ data: items }, { data: records }, { data: orders }, { data: meetings }] = await Promise.all([
    supabase.from('items').select('id, text, has_quantity'),
    supabase.from('daily_records').select('item_id, checked, quantity_value, staff_name').eq('record_date', today),
    supabase
      .from('wall_orders')
      .select('table_number, item_name, quantity, staff_name, created_at')
      .is('completed_at', null),
    supabase
      .from('meetings')
      .select('meeting_date, title, summary_overview, summary_decisions, summary_action_items')
      .order('meeting_date', { ascending: false })
      .limit(5),
  ])

  const recordsByItem = new Map((records ?? []).map((r) => [r.item_id, r]))
  const checklistLines = (items ?? []).map((it) => {
    const r = recordsByItem.get(it.id)
    const done = it.has_quantity ? !!(r?.quantity_value && r.quantity_value.trim()) : !!r?.checked
    return `- ${it.text}: ${done ? '完了' : '未完了'}${r?.staff_name ? `(担当:${r.staff_name})` : ''}`
  })

  const orderLines = (orders ?? []).map(
    (o) => `- 卓${o.table_number}: ${o.item_name} × ${o.quantity}${o.staff_name ? `(受付:${o.staff_name})` : ''}`,
  )

  const meetingLines = (meetings ?? []).map((m) => {
    const parts = [`概要:${m.summary_overview ?? 'なし'}`]
    if (m.summary_decisions) parts.push(`決定事項:${m.summary_decisions}`)
    if (m.summary_action_items) parts.push(`宿題:${m.summary_action_items}`)
    return `- ${m.meeting_date}${m.title ? ` ${m.title}` : ''} — ${parts.join(' / ')}`
  })

  const context =
    `今日の日付: ${today}\n\n` +
    `【開店準備チェックリストの状況】\n${checklistLines.join('\n') || '(項目なし)'}\n\n` +
    `【対応中の壁紙メニュー注文】\n${orderLines.join('\n') || '対応中の注文はありません'}\n\n` +
    `【直近の会議記録】\n${meetingLines.join('\n') || '会議記録はありません'}`

  try {
    const anthropicMessages = (messages as ChatMessage[]).map((m) => ({ role: m.role, content: m.content }))

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:
        'あなたは焼肉店「がみや」の業務アシスタントです。以下の最新データをもとに、スタッフからの質問に日本語で簡潔に答えてください。' +
        'データに無いこと・分からないことは、推測せず正直に「分かりません」と伝えてください。\n\n' +
        context,
      messages: anthropicMessages,
    })

    const block = message.content[0]
    const reply = block.type === 'text' ? block.text : ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('ask-assistant error', err)
    return NextResponse.json({ error: '応答に失敗しました' }, { status: 500 })
  }
}
