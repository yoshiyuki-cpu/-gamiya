'use client'

import { useEffect, useRef, useState } from 'react'
import type { DailyRecord, Item } from '@/lib/supabase'
import TimerDisplay from './TimerDisplay'

function QuantityField({
  item,
  record,
  onSetQuantity,
}: {
  item: Item
  record: DailyRecord | undefined
  onSetQuantity: (itemId: number, value: string) => void
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
  const staffName = record?.staff_name

  return (
    <>
      <span className={`qty-dot${filled ? ' filled' : ''}`}></span>
      <span className={`item-text${filled ? ' filled-text' : ''}`}>{item.text}</span>
      {staffName ? <span className="staff-badge">{staffName}</span> : null}
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
  onToggleCheck,
}: {
  item: Item
  record: DailyRecord | undefined
  onToggleCheck: (itemId: number) => void
}) {
  const checked = !!record?.checked
  const timeLabel = record?.checked_time
  const staffName = record?.staff_name

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
      {checked && staffName ? <span className="staff-badge">{staffName}</span> : null}
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
  onToggleCheck: (itemId: number) => void
  onSetQuantity: (itemId: number, value: string) => void
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
  onToggleCheck,
  onSetQuantity,
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
    <QuantityField item={item} record={record} onSetQuantity={onSetQuantity} />
  ) : (
    <CheckboxField item={item} record={record} onToggleCheck={onToggleCheck} />
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
