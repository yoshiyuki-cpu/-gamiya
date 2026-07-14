'use client'

import { useState } from 'react'
import type { WallMenuItem } from '@/lib/supabase'

type Props = {
  menuItems: WallMenuItem[]
  onAdd: (name: string) => void
  onDelete: (id: number, name: string) => void
}

export default function MenuEditor({ menuItems, onAdd, onDelete }: Props) {
  const [name, setName] = useState('')

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">壁</div>
        <div>
          <div className="category-name">壁紙メニュー一覧</div>
          <div className="category-sub">セルフオーダーにないメニューを登録</div>
        </div>
      </div>
      <div className="items">
        {menuItems.length === 0 ? <div className="empty-hint">まだメニューが登録されていません。下から追加してください。</div> : null}
        {menuItems.map((m) => (
          <div key={m.id} className="item">
            <span className="item-text">{m.name}</span>
            <button type="button" className="del-btn" aria-label="削除" onClick={() => onDelete(m.id, m.name)}>
              ×
            </button>
          </div>
        ))}
        <div className="bulk-add">
          <label>新しいメニューを追加</label>
          <div className="add-category-row">
            <input
              className="add-category-name"
              placeholder="メニュー名(例: 特製ホルモン)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return
              onAdd(name)
              setName('')
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  )
}
