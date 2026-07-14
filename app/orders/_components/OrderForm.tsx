'use client'

import { useState } from 'react'
import type { WallMenuItem } from '@/lib/supabase'

type Props = {
  menuItems: WallMenuItem[]
  onAddOrder: (tableNumber: string, itemName: string, quantity: number) => void
}

export default function OrderForm({ menuItems, onAddOrder }: Props) {
  const [tableNumber, setTableNumber] = useState('')
  const [selectedItem, setSelectedItem] = useState('')
  const [customItem, setCustomItem] = useState('')
  const [quantity, setQuantity] = useState(1)

  const itemName = customItem.trim() || selectedItem
  const canSubmit = tableNumber.trim() !== '' && itemName !== ''

  function submit() {
    if (!canSubmit) return
    onAddOrder(tableNumber, itemName, quantity)
    setSelectedItem('')
    setCustomItem('')
    setQuantity(1)
  }

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">注</div>
        <div>
          <div className="category-name">注文を追加</div>
          <div className="category-sub">卓番とメニューを選んで数量をメモ</div>
        </div>
      </div>
      <div className="items order-form">
        <div className="order-form-row">
          <label htmlFor="tableNumberInput">卓番</label>
          <input
            id="tableNumberInput"
            className="table-number-input"
            type="text"
            placeholder="例) 5"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
          />
        </div>

        <div className="menu-chip-grid">
          {menuItems.length === 0 ? <div className="empty-hint">まだメニューが登録されていません。下から入力してください。</div> : null}
          {menuItems.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`menu-chip${selectedItem === m.name && !customItem.trim() ? ' active' : ''}`}
              onClick={() => {
                setSelectedItem(m.name)
                setCustomItem('')
              }}
            >
              {m.name}
            </button>
          ))}
        </div>

        <input
          className="custom-item-input"
          type="text"
          placeholder="リストにない新しいメニュー名"
          value={customItem}
          onChange={(e) => {
            setCustomItem(e.target.value)
            setSelectedItem('')
          }}
        />

        <div className="order-form-row">
          <label>数量</label>
          <div className="qty-stepper">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="数量を減らす">
              −
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => q + 1)} aria-label="数量を増やす">
              ＋
            </button>
          </div>
        </div>

        <button type="button" className="add-order-btn" disabled={!canSubmit} onClick={submit}>
          注文を追加
        </button>
      </div>
    </div>
  )
}
