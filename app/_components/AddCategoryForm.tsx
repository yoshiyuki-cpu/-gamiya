'use client'

import { useState } from 'react'

export default function AddCategoryForm({
  onAdd,
}: {
  onAdd: (badge: string, name: string, sub: string) => void
}) {
  const [badge, setBadge] = useState('')
  const [name, setName] = useState('')
  const [sub, setSub] = useState('')

  return (
    <div className="add-category">
      <label>新しいカテゴリーを追加</label>
      <div className="add-category-row">
        <input
          className="add-category-badge"
          placeholder="アイコン"
          maxLength={2}
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
        />
        <input
          className="add-category-name"
          placeholder="カテゴリー名(例: 閉店作業)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <input
        className="add-category-sub"
        placeholder="説明(例: 閉店後の片付け)"
        value={sub}
        onChange={(e) => setSub(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          if (!name.trim()) return
          onAdd(badge, name, sub)
          setBadge('')
          setName('')
          setSub('')
        }}
      >
        カテゴリーを追加
      </button>
    </div>
  )
}
