import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

// See app/api/transcribe-meeting/route.ts for why Whisper is called via plain
// fetch()+FormData rather than the `openai` SDK.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-anthropic-key' })

const EMPTY_RESULT = { transcript: '', table_number: null, items: [] as { name: string; quantity: number }[] }

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const audio = form.get('audio')
  const menuNamesRaw = form.get('menuNames')
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: '音声データがありません' }, { status: 400 })
  }
  let menuNames: string[] = []
  try {
    menuNames = menuNamesRaw ? JSON.parse(String(menuNamesRaw)) : []
  } catch {
    menuNames = []
  }

  try {
    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'order.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'ja')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: whisperForm,
    })
    const whisperJson = await whisperRes.json()
    if (!whisperRes.ok) throw new Error(whisperJson?.error?.message || 'Whisper API error')

    const transcript = String(whisperJson.text || '').trim()
    if (!transcript) return NextResponse.json(EMPTY_RESULT)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'これは焼肉店のスタッフが口頭で受けた注文を文字起こししたものです。卓番号と、注文されたメニュー名・数量を読み取ってJSON形式で返してください。\n\n' +
                `登録済みメニュー名の候補: ${JSON.stringify(menuNames)}\n` +
                '候補に近い名前が話されていれば候補の表記に合わせてください。候補に無い新しいメニュー名はそのまま使ってください。\n\n' +
                '{"table_number": "卓番号(文字列。聞き取れなければnull)", "items": [{"name": "メニュー名", "quantity": 数量(数値。聞き取れなければ1)}]}\n\n' +
                '該当する注文が無ければ items は空配列にしてください。JSONのみ返してください。\n\n---\n' +
                transcript,
            },
          ],
        },
      ],
    })

    const block = message.content[0]
    const text = block.type === 'text' ? block.text.trim() : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((it: { name?: unknown; quantity?: unknown }) => ({
            name: String(it.name ?? '').trim(),
            quantity: Number(it.quantity) > 0 ? Math.round(Number(it.quantity)) : 1,
          }))
          .filter((it: { name: string }) => it.name)
      : []

    return NextResponse.json({ transcript, table_number: parsed.table_number ?? null, items })
  } catch (err) {
    console.error('parse-voice-order error', err)
    return NextResponse.json({ error: '音声の解析に失敗しました' }, { status: 500 })
  }
}
