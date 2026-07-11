'use client'

import { useState } from 'react'
import type { Category, DailyRecord, Item } from '@/lib/supabase'
import ItemRow from './ItemRow'

type Props = {
  category: Category
  items: Item[]
  dailyRecords: Map<number, DailyRecord>
  editMode: boolean
  onToggleCheck: (itemId: number) => void
  onSetQuantity: (itemId: number, value: string) => void
  onToggleTimer: (itemId: number) => void
  onResetTimer: (itemId: number) => void
  onMoveItem: (categoryId: string, itemId: number, direction: 1 | -1) => void
  onToggleQuantityMode: (itemId: number) => void
  onDeleteItem: (itemId: number) => void
  onAddItemsBulk: (categoryId: string, rawText: string) => void
}

export default function CategoryCard({
  category,
  items,
  dailyRecords,
  editMode,
  onToggleCheck,
  onSetQuantity,
  onToggleTimer,
  onResetTimer,
  onMoveItem,
  onToggleQuantityMode,
  onDeleteItem,
  onAddItemsBulk,
}: Props) {
  const [bulkText, setBulkText] = useState('')
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const showTimer = category.id === 'prep'

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">{category.badge}</div>
        <div>
          <div className="category-name">{category.name}</div>
          <div className="category-sub">{category.sub}</div>
        </div>
      </div>
      <div className="items">
        {sortedItems.length === 0 ? (
          <div className="empty-hint">項目がありません。下から追加してください。</div>
        ) : null}
        {sortedItems.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            record={dailyRecords.get(item.id)}
            editMode={editMode}
            showTimer={showTimer}
            isFirst={idx === 0}
            isLast={idx === sortedItems.length - 1}
            onToggleCheck={onToggleCheck}
            onSetQuantity={onSetQuantity}
            onToggleTimer={onToggleTimer}
            onResetTimer={onResetTimer}
            onMove={(direction) => onMoveItem(category.id, item.id, direction)}
            onToggleQuantityMode={() => onToggleQuantityMode(item.id)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
        {editMode ? (
          <div className="bulk-add">
            <label>新しい項目をまとめて追加(1行に1項目)</label>
            <textarea
              placeholder={'例)\n皿・グラスの在庫確認\n冷房温度の設定'}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                onAddItemsBulk(category.id, bulkText)
                setBulkText('')
              }}
            >
              このカテゴリーに追加
            </button>
            <div className="bulk-add-hint">追加した項目はあとから「数量入力」に切り替えられます</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
