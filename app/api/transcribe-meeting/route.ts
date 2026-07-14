import { NextRequest, NextResponse } from 'next/server'

// Calling the Whisper REST endpoint directly with a plain fetch()+FormData,
// rather than the `openai` SDK. The SDK's internal HTTP client repeatedly
// hit low-level connection errors in this Node/Vercel environment (an
// interaction between its bundled node-fetch/retry logic and streamed
// multipart bodies); a plain fetch with a fully-buffered Blob body avoids
// that entirely and is the officially documented way to call this endpoint.
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

    const form = new FormData()
    form.append('file', new Blob([arrayBuffer], { type: contentType }), `meeting.${ext}`)
    form.append('model', 'whisper-1')
    form.append('language', 'ja')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    })
    const json = await whisperRes.json()
    if (!whisperRes.ok) throw new Error(json?.error?.message || 'Whisper API error')

    return NextResponse.json({ transcript: json.text })
  } catch (err) {
    console.error('transcribe-meeting error', err)
    return NextResponse.json({ error: '文字起こしに失敗しました' }, { status: 500 })
  }
}
