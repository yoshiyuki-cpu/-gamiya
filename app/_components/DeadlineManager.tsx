'use client'

import { useState } from 'react'
import type { Deadline } from '@/lib/supabase'

type Props = {
  deadlines: Deadline[]
  onAdd: (label: string) => void
  onDelete: (deadlineId: number, label: string) => void
  onMove: (deadlineId: number, direction: 1 | -1) => void
}

export default function DeadlineManager({ deadlines, onAdd, onDelete, onMove }: Props) {
  const [label, setLabel] = useState('')
  const sorted = [...deadlines].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">⏰</div>
        <div>
          <div className="category-name">締め切りの管理</div>
          <div className="category-sub">「時間で表示」に使う締め切りを追加・並べ替え</div>
        </div>
      </div>
      <div className="items">
        {sorted.length === 0 ? <div className="empty-hint">締め切りがありません。下から追加してください。</div> : null}
        {sorted.map((d, idx) => (
          <div key={d.id} className="item">
            <div className="order-btns">
              <button
                type="button"
                className="order-btn"
                aria-label="上に移動"
                disabled={idx === 0}
                onClick={() => onMove(d.id, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="order-btn"
                aria-label="下に移動"
                disabled={idx === sorted.length - 1}
                onClick={() => onMove(d.id, 1)}
              >
                ▼
              </button>
            </div>
            <span className="item-text">{d.label}</span>
            <button type="button" className="del-btn" aria-label="削除" onClick={() => onDelete(d.id, d.label)}>
              ×
            </button>
          </div>
        ))}
        <div className="bulk-add">
          <label>新しい締め切りを追加(例: 15:00まで)</label>
          <input
            className="deadline-add-input"
            type="text"
            placeholder="15:00まで"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (!label.trim()) return
              onAdd(label)
              setLabel('')
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  )
}
