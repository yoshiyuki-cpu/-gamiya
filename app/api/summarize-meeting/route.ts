import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

// See app/api/transcribe-meeting/route.ts for why the fallback is needed.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-anthropic-key' })

const EMPTY_RESULT = { overview: null, decisions: null, action_items: null }

export async function POST(req: NextRequest) {
  const { transcript } = await req.json()
  if (!transcript || !String(transcript).trim()) {
    return NextResponse.json(EMPTY_RESULT)
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'これは飲食店の社内ミーティングの文字起こしです。内容を読み取り、以下の情報をJSON形式で抽出してください。\n\n' +
              '{"overview": "会議の概要(3〜5行程度)", "decisions": "話し合いで決まったこと", "action_items": "次回までにやること・宿題"}\n\n' +
              '該当する内容が無い項目はnullにしてください。JSONのみ返してください。\n\n---\n' +
              transcript,
          },
        ],
      },
    ],
  })

  try {
    const block = message.content[0]
    const text = block.type === 'text' ? block.text.trim() : ''
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    return NextResponse.json(json)
  } catch (err) {
    console.error('summarize-meeting parse error', err)
    return NextResponse.json(EMPTY_RESULT)
  }
}
