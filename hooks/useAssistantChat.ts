'use client'

import { useCallback, useState } from 'react'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function useAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return
      const next = [...messages, { role: 'user' as const, content: trimmed }]
      setMessages(next)
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/ask-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '応答に失敗しました')
        setMessages((prev) => [...prev, { role: 'assistant', content: json.reply }])
      } catch (err) {
        setError(err instanceof Error ? err.message : '応答に失敗しました')
      } finally {
        setLoading(false)
      }
    },
    [messages, loading],
  )

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, sendMessage, reset }
}
