'use client'

import { useEffect, useRef, useState } from 'react'
import type { DailyRecord, Item } from '@/lib/supabase'
import TimerDisplay from './TimerDisplay'

function StaffSelect({
  itemId,
  value,
  staffList,
  onSetItemStaff,
}: {
  itemId: number
  value: string
  staffList: string[]
  onSetItemStaff: (itemId: number, name: string) => void
}) {
  return (
    <select
      className="staff-select"
      aria-label="担当者"
      value={staffList.includes(value) ? value : ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onSetItemStaff(itemId, e.target.value)}
    >
      <option value="">担当者</option>
      {staffList.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}

function QuantityField({
  item,
  record,
  staffList,
  onSetQuantity,
  onSetItemStaff,
}: {
  item: Item
  record: DailyRecord | undefined
  staffList: string[]
  onSetQuantity: (itemId: number, value: string) => void
  onSetItemStaff: (itemId: number, name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(record?.quantity_value ?? '')

  // Only sync from the (possibly remote-updated) record while this input
  // isn't focused — avoids yanking the value out from under someone typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setValue(record?.quantity_value ?? '')
    }
  }, [record?.quantity_value])

  const filled = value.trim() !== ''

  return (
    <>
      <span className={`qty-dot${filled ? ' filled' : ''}`}></span>
      <span className={`item-text${filled ? ' filled-text' : ''}`}>{item.text}</span>
      {filled ? (
        <StaffSelect
          itemId={item.id}
          value={record?.staff_name ?? ''}
          staffList={staffList}
          onSetItemStaff={onSetItemStaff}
        />
      ) : null}
      <input
        ref={inputRef}
        className="qty-input"
        type="text"
        inputMode="decimal"
        placeholder="個数"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onSetQuantity(item.id, e.target.value)
        }}
      />
    </>
  )
}

function CheckboxField({
  item,
  record,
  staffList,
  onToggleCheck,
  onSetItemStaff,
}: {
  item: Item
  record: DailyRecord | undefined
  staffList: string[]
  onToggleCheck: (itemId: number) => void
  onSetItemStaff: (itemId: number, name: string) => void
}) {
  const checked = !!record?.checked
  const timeLabel = record?.checked_time

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={() => onToggleCheck(item.id)} />
      <span className="check-circle">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#fff2e6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="item-text">{item.text}</span>
      {checked && timeLabel ? <span className="time-badge">{timeLabel}</span> : null}
      {checked ? (
        <StaffSelect
          itemId={item.id}
          value={record?.staff_name ?? ''}
          staffList={staffList}
          onSetItemStaff={onSetItemStaff}
        />
      ) : null}
    </label>
  )
}

type Props = {
  item: Item
  record: DailyRecord | undefined
  editMode: boolean
  showTimer: boolean
  isFirst: boolean
  isLast: boolean
  staffList: string[]
  onToggleCheck: (itemId: number) => void
  onSetQuantity: (itemId: number, value: string) => void
  onSetItemStaff: (itemId: number, name: string) => void
  onToggleTimer: (itemId: number) => void
  onResetTimer: (itemId: number) => void
  onMove: (direction: 1 | -1) => void
  onToggleQuantityMode: () => void
  onDelete: () => void
}

export default function ItemRow({
  item,
  record,
  editMode,
  showTimer,
  isFirst,
  isLast,
  staffList,
  onToggleCheck,
  onSetQuantity,
  onSetItemStaff,
  onToggleTimer,
  onResetTimer,
  onMove,
  onToggleQuantityMode,
  onDelete,
}: Props) {
  if (editMode) {
    return (
      <div className="item">
        <div className="order-btns">
          <button type="button" className="order-btn" aria-label="上に移動" disabled={isFirst} onClick={() => onMove(-1)}>
            ▲
          </button>
          <button type="button" className="order-btn" aria-label="下に移動" disabled={isLast} onClick={() => onMove(1)}>
            ▼
          </button>
        </div>
        <span className="item-text">{item.text}</span>
        <button
          type="button"
          className={`qty-toggle${item.has_quantity ? ' active' : ''}`}
          onClick={onToggleQuantityMode}
        >
          数量入力
        </button>
        <button type="button" className="del-btn" aria-label="削除" onClick={onDelete}>
          ×
        </button>
      </div>
    )
  }

  const mainField = item.has_quantity ? (
    <QuantityField
      item={item}
      record={record}
      staffList={staffList}
      onSetQuantity={onSetQuantity}
      onSetItemStaff={onSetItemStaff}
    />
  ) : (
    <CheckboxField
      item={item}
      record={record}
      staffList={staffList}
      onToggleCheck={onToggleCheck}
      onSetItemStaff={onSetItemStaff}
    />
  )

  if (showTimer) {
    const accumulatedMs = record?.timer_accumulated_ms ?? 0
    const startedAt = record?.timer_started_at ?? null
    const running = !!startedAt
    const stoppedWithElapsed = !running && accumulatedMs > 0

    return (
      <div className="item has-timer">
        <div className="item-main">{mainField}</div>
        <div className="timer-row">
          <TimerDisplay accumulatedMs={accumulatedMs} startedAt={startedAt} />
          <button
            type="button"
            className={`timer-btn${running ? ' active' : ''}`}
            onClick={() => onToggleTimer(item.id)}
          >
            {running ? '停止' : '計測開始'}
          </button>
          {stoppedWithElapsed ? (
            <button type="button" className="timer-reset" aria-label="リセット" onClick={() => onResetTimer(item.id)}>
              ↺
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={item.has_quantity ? 'item' : 'item clickable'} tabIndex={item.has_quantity ? undefined : 0}>
      {mainField}
    </div>
  )
}
