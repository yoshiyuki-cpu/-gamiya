'use client'

import { useState } from 'react'
import type { Recipe } from '@/lib/supabase'

type Props = {
  categoryId: string
  badge: string
  name: string
  sub: string
  recipes: Recipe[]
  onSelect: (recipe: Recipe) => void
  onAdd: (category: string, name: string) => void
}

export default function RecipeCategorySection({ categoryId, badge, name, sub, recipes, onSelect, onAdd }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [newName, setNewName] = useState('')
  const sorted = [...recipes].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="category">
      <div className="category-head" onClick={() => setExpanded((v) => !v)} role="button" tabIndex={0}>
        <div className="badge">{badge}</div>
        <div>
          <div className="category-name">{name}</div>
          <div className="category-sub">{sub}</div>
        </div>
        <span className={`category-chevron${expanded ? '' : ' collapsed'}`} aria-hidden="true">
          ▼
        </span>
      </div>
      <div className={`items${expanded ? '' : ' collapsed'}`}>
        {sorted.length === 0 ? <div className="empty-hint">まだレシピがありません。下から追加してください。</div> : null}
        {sorted.map((r) => (
          <button key={r.id} type="button" className="recipe-row" onClick={() => onSelect(r)}>
            <span className="item-text">{r.name}</span>
            {r.prep_time ? <span className="time-badge">{r.prep_time}</span> : null}
            {r.photo_url ? (
              <span className="recipe-photo-dot" aria-hidden="true">
                📷
              </span>
            ) : null}
          </button>
        ))}
        <div className="bulk-add">
          <label>新しいレシピを追加</label>
          <div className="add-category-row">
            <input
              className="add-category-name"
              placeholder="レシピ名(例: 特製ダレ)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!newName.trim()) return
              onAdd(categoryId, newName)
              setNewName('')
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  )
}
