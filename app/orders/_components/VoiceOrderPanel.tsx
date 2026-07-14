'use client'

import { useRef, useState } from 'react'
import type { WallMenuItem } from '@/lib/supabase'

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

type ParsedItem = { name: string; quantity: number }

type Props = {
  menuItems: WallMenuItem[]
  onAddOrder: (tableNumber: string, itemName: string, quantity: number) => void
}

export default function VoiceOrderPanel({ menuItems, onAddOrder }: Props) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  async function processRecording(blob: Blob) {
    setProcessing(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('audio', blob, 'order.webm')
      form.append('menuNames', JSON.stringify(menuItems.map((m) => m.name)))
      const res = await fetch('/api/parse-voice-order', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '音声の解析に失敗しました')
      if (json.table_number) setTableNumber(String(json.table_number))
      const items: ParsedItem[] = Array.isArray(json.items) ? json.items : []
      if (items.length === 0) setError('メニューを聞き取れませんでした。もう一度お試しください。')
      setParsedItems(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '音声の解析に失敗しました')
    } finally {
      setProcessing(false)
    }
  }

  async function start() {
    setError(null)
    setParsedItems([])
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const finishedBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        void processRecording(finishedBlob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
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

  function updateItem(idx: number, patch: Partial<ParsedItem>) {
    setParsedItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function removeItem(idx: number) {
    setParsedItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function confirmAll() {
    if (!tableNumber.trim() || parsedItems.length === 0) return
    parsedItems.forEach((it) => onAddOrder(tableNumber, it.name, it.quantity))
    setParsedItems([])
    setTableNumber('')
  }

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">声</div>
        <div>
          <div className="category-name">音声で注文</div>
          <div className="category-sub">口頭注文をそのまま録音して自動入力</div>
        </div>
      </div>
      <div className="items voice-order-panel">
        {error ? <div className="recorder-error">{error}</div> : null}

        {processing ? (
          <div className="meeting-processing">聞き取り中…</div>
        ) : recording ? (
          <button type="button" className="recorder-stop-btn" onClick={stop}>
            ● 録音終了
          </button>
        ) : (
          <button type="button" className="recorder-start-btn" onClick={start}>
            ● 録音開始
          </button>
        )}

        {parsedItems.length > 0 ? (
          <div className="voice-order-preview">
            <div className="order-form-row">
              <label htmlFor="voiceTableNumberInput">卓番</label>
              <input
                id="voiceTableNumberInput"
                className="table-number-input"
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
              />
            </div>
            {parsedItems.map((it, idx) => (
              <div key={idx} className="voice-order-item">
                <input
                  className="custom-item-input"
                  type="text"
                  value={it.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                />
                <div className="qty-stepper">
                  <button type="button" aria-label="数量を減らす" onClick={() => updateItem(idx, { quantity: Math.max(1, it.quantity - 1) })}>
                    −
                  </button>
                  <span>{it.quantity}</span>
                  <button type="button" aria-label="数量を増やす" onClick={() => updateItem(idx, { quantity: it.quantity + 1 })}>
                    ＋
                  </button>
                </div>
                <button type="button" className="del-btn" aria-label="削除" onClick={() => removeItem(idx)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="add-order-btn" disabled={!tableNumber.trim()} onClick={confirmAll}>
              この内容で注文に追加
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
