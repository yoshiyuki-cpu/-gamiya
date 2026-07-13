'use client'

import { todayLabelText } from '@/lib/checklist'
import type { DailyRecord, Item } from '@/lib/supabase'
import CoalStrip from './CoalStrip'

type Props = {
  editMode: boolean
  onToggleEditMode: () => void
  currentStaff: string
  setCurrentStaff: (name: string) => void
  commitCurrentStaff: () => void
  staffList: string[]
  items: Item[]
  dailyRecords: Map<number, DailyRecord>
  total: number
  doneCount: number
}

export default function Header({
  editMode,
  onToggleEditMode,
  currentStaff,
  setCurrentStaff,
  commitCurrentStaff,
  staffList,
  items,
  dailyRecords,
  total,
  doneCount,
}: Props) {
  return (
    <div className="header">
      <div className="top-row">
        <div>
          <div className="eyebrow">GAMIYA</div>
          <h1 className="title">焼肉がみやアプリ</h1>
          <div className="subtitle">
            {editMode
              ? 'リストを編集中:項目の追加・削除・数量入力の切り替えができます'
              : '仕込みからセッティングまで、抜けなく確認'}
          </div>
        </div>
        <button className={`edit-toggle${editMode ? ' active' : ''}`} type="button" onClick={onToggleEditMode}>
          {editMode ? '完了' : '編集'}
        </button>
      </div>

      <div className="staff-row">
        <label htmlFor="staffInput">担当者</label>
        <input
          type="text"
          id="staffInput"
          list="staffOptions"
          placeholder="名前を入力"
          autoComplete="off"
          value={currentStaff}
          onChange={(e) => setCurrentStaff(e.target.value)}
          onBlur={commitCurrentStaff}
        />
        <datalist id="staffOptions">
          {staffList.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="date-row" style={{ justifyContent: editMode ? 'flex-start' : 'space-between' }}>
        <span>{todayLabelText()}</span>
        {!editMode ? (
          <strong>
            {doneCount}/{total} 完了
          </strong>
        ) : null}
      </div>

      {!editMode ? (
        <div className="progress-wrap">
          <CoalStrip items={items} dailyRecords={dailyRecords} />
        </div>
      ) : null}
    </div>
  )
}
