'use client'

import { useState } from 'react'
import type { Category, DailyRecord, Item } from '@/lib/supabase'
import ItemRow from './ItemRow'

type Props = {
  category: Category
  items: Item[]
  dailyRecords: Map<number, DailyRecord>
  editMode: boolean
  staffList: string[]
  onToggleCheck: (itemId: number) => void
  onSetQuantity: (itemId: number, value: string) => void
  onSetItemStaff: (itemId: number, name: string) => void
  onMoveItem: (categoryId: string, itemId: number, direction: 1 | -1) => void
  onToggleQuantityMode: (itemId: number) => void
  onToggleNoteMode: (itemId: number) => void
  onDeleteItem: (itemId: number) => void
  onAddItemsBulk: (categoryId: string, rawText: string) => void
  onDeleteCategory: (categoryId: string, categoryName: string) => void
}

export default function CategoryCard({
  category,
  items,
  dailyRecords,
  editMode,
  staffList,
  onToggleCheck,
  onSetQuantity,
  onSetItemStaff,
  onMoveItem,
  onToggleQuantityMode,
  onToggleNoteMode,
  onDeleteItem,
  onAddItemsBulk,
  onDeleteCategory,
}: Props) {
  const [bulkText, setBulkText] = useState('')
  const [expanded, setExpanded] = useState(true)
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const open = editMode || expanded
  // 中身が手順メモだけのカテゴリー(例:トイレ清掃)は、押す場所がないので
  // 見出しに「手順」と出して、チェック漏れと勘違いされないようにする。
  const noteOnly = sortedItems.length > 0 && sortedItems.every((i) => i.is_note)

  return (
    <div className="category">
      <div
        className="category-head"
        onClick={editMode ? undefined : () => setExpanded((v) => !v)}
        role={editMode ? undefined : 'button'}
        tabIndex={editMode ? undefined : 0}
      >
        <div className="badge">{category.badge}</div>
        <div>
          <div className="category-name">
            {category.name}
            {noteOnly ? <span className="note-badge">手順</span> : null}
          </div>
          <div className="category-sub">{category.sub}</div>
        </div>
        {editMode ? (
          <button
            type="button"
            className="category-del-btn"
            aria-label="カテゴリーを削除"
            onClick={() => onDeleteCategory(category.id, category.name)}
          >
            ×
          </button>
        ) : (
          <span className={`category-chevron${expanded ? '' : ' collapsed'}`} aria-hidden="true">
            ▼
          </span>
        )}
      </div>
      <div className={`items${open ? '' : ' collapsed'}`}>
        {sortedItems.length === 0 ? (
          <div className="empty-hint">項目がありません。下から追加してください。</div>
        ) : null}
        {sortedItems.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            record={dailyRecords.get(item.id)}
            editMode={editMode}
            isFirst={idx === 0}
            isLast={idx === sortedItems.length - 1}
            staffList={staffList}
            onToggleCheck={onToggleCheck}
            onSetQuantity={onSetQuantity}
            onSetItemStaff={onSetItemStaff}
            onMove={(direction) => onMoveItem(category.id, item.id, direction)}
            onToggleQuantityMode={() => onToggleQuantityMode(item.id)}
            onToggleNoteMode={() => onToggleNoteMode(item.id)}
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
            <div className="bulk-add-hint">
              追加した項目はあとから「数量入力」「手順メモ」に切り替えられます。手順メモはチェックが付かず、完了数にも入りません
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
