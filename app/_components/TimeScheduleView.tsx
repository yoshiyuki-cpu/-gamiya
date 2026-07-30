'use client'

import type { DailyRecord, Deadline, Item } from '@/lib/supabase'
import ItemRow from './ItemRow'

type Props = {
  deadlines: Deadline[]
  items: Item[]
  dailyRecords: Map<number, DailyRecord>
  staffList: string[]
  onToggleCheck: (itemId: number) => void
  onSetQuantity: (itemId: number, value: string) => void
  onSetItemStaff: (itemId: number, name: string) => void
  onToggleTimer: (itemId: number) => void
  onResetTimer: (itemId: number) => void
}

export default function TimeScheduleView({
  deadlines,
  items,
  dailyRecords,
  staffList,
  onToggleCheck,
  onSetQuantity,
  onSetItemStaff,
  onToggleTimer,
  onResetTimer,
}: Props) {
  const sortedDeadlines = [...deadlines].sort((a, b) => a.sort_order - b.sort_order)
  const groups = [
    ...sortedDeadlines.map((d) => ({
      key: `d-${d.id}`,
      label: d.label,
      items: items.filter((i) => i.deadline_id === d.id),
    })),
    { key: 'none', label: '時間指定なし', items: items.filter((i) => i.deadline_id == null) },
  ].filter((g) => g.items.length > 0)

  if (groups.length === 0) {
    return <div className="empty-hint">項目がありません。「カテゴリー」表示の編集モードで項目に締め切りを設定してください。</div>
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.key} className="category">
          <div className="category-head">
            <div className="badge">⏰</div>
            <div>
              <div className="category-name">{g.label}</div>
              <div className="category-sub">{g.items.length}件</div>
            </div>
          </div>
          <div className="items">
            {g.items
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  record={dailyRecords.get(item.id)}
                  editMode={false}
                  showTimer={item.category_id === 'prep'}
                  isFirst={false}
                  isLast={false}
                  staffList={staffList}
                  deadlines={deadlines}
                  onToggleCheck={onToggleCheck}
                  onSetQuantity={onSetQuantity}
                  onSetItemStaff={onSetItemStaff}
                  onToggleTimer={onToggleTimer}
                  onResetTimer={onResetTimer}
                  onMove={() => {}}
                  onToggleQuantityMode={() => {}}
                  onSetItemDeadline={() => {}}
                  onDelete={() => {}}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
