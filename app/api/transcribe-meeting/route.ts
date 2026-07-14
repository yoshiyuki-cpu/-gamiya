import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { NextRequest, NextResponse } from 'next/server'

// Falls back to a placeholder so module evaluation never throws during
// Next.js's build-time page-data collection (which evaluates route modules
// too, not just pages). The real key is still used whenever it's actually set.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder-openai-key' })

export async function POST(req: NextRequest) {
  const { audioUrl } = await req.json()
  if (!audioUrl) {
    return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 })
  }

  try {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error('failed to fetch audio from storage')
    const arrayBuffer = await audioRes.arrayBuffer()
    const contentType = audioRes.headers.get('content-type') || 'audio/webm'
    const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('wav') ? 'wav' : 'webm'
    const file = await toFile(Buffer.from(arrayBuffer), `meeting.${ext}`, { type: contentType })

    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ja',
    })

    return NextResponse.json({ transcript: transcription.text })
  } catch (err) {
    console.error('transcribe-meeting error', err)
    return NextResponse.json({ error: '文字起こしに失敗しました' }, { status: 500 })
  }
}
