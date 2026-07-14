'use client'

import { useState } from 'react'
import { useAssistantChat } from '@/hooks/useAssistantChat'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  const { messages, loading, error, sendMessage, reset } = useAssistantChat()
  const [input, setInput] = useState('')

  function submit() {
    if (!input.trim() || loading) return
    void sendMessage(input)
    setInput('')
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">AI相談</h1>
            <div className="subtitle">チェックリスト・注文・議事録について質問できます</div>
          </div>
          {messages.length > 0 ? (
            <button className="edit-toggle" type="button" onClick={reset}>
              リセット
            </button>
          ) : null}
        </div>
      </div>

      <div className="category">
        <div className="items chat-panel">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-hint">
                例)「今日の仕込みで残ってるのは?」「対応中の注文ある?」「前回の会議で決まったことは?」
              </div>
            ) : null}
            {messages.map((m, idx) => (
              <div key={idx} className={`chat-bubble ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading ? <div className="chat-bubble assistant chat-loading">考え中…</div> : null}
          </div>
          {error ? <div className="recorder-error">{error}</div> : null}
          <div className="chat-input-row">
            <input
              type="text"
              placeholder="質問を入力"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            <button type="button" className="chat-send-btn" disabled={!input.trim() || loading} onClick={submit}>
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
