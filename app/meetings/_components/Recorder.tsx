'use client'

import { useEffect, useRef, useState } from 'react'

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Recorder({ onFinished }: { onFinished: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!recording) return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [recording])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        onFinished(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setElapsed(0)
      setRecording(true)
    } catch {
      setError('マイクを使用できませんでした。ブラウザの設定でマイクの許可を確認してください。')
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  return (
    <div className="recorder">
      {error ? <div className="recorder-error">{error}</div> : null}
      {recording ? (
        <>
          <div className="recorder-elapsed">{formatElapsed(elapsed)}</div>
          <button type="button" className="recorder-stop-btn" onClick={stop}>
            ● 録音終了
          </button>
        </>
      ) : (
        <button type="button" className="recorder-start-btn" onClick={start}>
          ● 録音開始
        </button>
      )}
    </div>
  )
}
