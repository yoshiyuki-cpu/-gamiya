'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useGuestCheck } from '@/hooks/useGuestCheck'

export const dynamic = 'force-dynamic'

export default function GuestCheckPage() {
  const {
    loading,
    items,
    activeTables,
    currentTable,
    selectTable,
    backToTableSelect,
    checked,
    editMode,
    setEditMode,
    total,
    doneCount,
    toggleCheck,
    finishTable,
    moveItem,
  } = useGuestCheck()

  const [tableInput, setTableInput] = useState('')

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  const allDone = total > 0 && doneCount === total

  const handleSelectTable = () => {
    if (!tableInput.trim()) return
    selectTable(tableInput)
    setTableInput('')
  }

  // Table not chosen yet (and not editing the item list): show the table
  // picker so multiple tables can be checked in parallel without their
  // checks mixing together.
  if (!editMode && !currentTable) {
    return (
      <div className="app">
        <div className="header">
          <div className="top-row">
            <div>
              <div className="eyebrow">GAMIYA</div>
              <h1 className="title">テーブルチェック表</h1>
              <div className="subtitle">案内するテーブルを選んでください</div>
            </div>
            <button className="edit-toggle" type="button" onClick={() => setEditMode(true)}>
              並べ替え
            </button>
          </div>
          <Link href="/guests" className="table-switch-btn">
            ← お客様評価に戻る
          </Link>
        </div>

        <div className="category">
          <div className="category-head">
            <div className="badge">卓</div>
            <div>
              <div className="category-name">テーブル番号を入力</div>
              <div className="category-sub">案内するテーブル番号を入力して開始</div>
            </div>
          </div>
          <div className="satisfaction-body">
            <div className="table-select-row">
              <input
                className="satisfaction-input table-select-input"
                placeholder="例) 5"
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectTable()
                }}
              />
              <button className="next-guest-btn" type="button" onClick={handleSelectTable}>
                開始
              </button>
            </div>
          </div>
        </div>

        {activeTables.length > 0 ? (
          <div className="category">
            <div className="category-head">
              <div className="badge">進</div>
              <div>
                <div className="category-name">進行中のテーブル</div>
                <div className="category-sub">タップで再開({activeTables.length}件)</div>
              </div>
            </div>
            <div className="satisfaction-body">
              <div className="table-chips">
                {activeTables.map((t) => (
                  <button key={t} type="button" className="table-chip" onClick={() => selectTable(t)}>
                    テーブル{t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">テーブルチェック表</h1>
            <div className="subtitle">
              {editMode
                ? '並べ替え中:▲▼で項目の順番を変更できます'
                : `テーブル${currentTable} ・ ${doneCount}/${total} 完了`}
            </div>
          </div>
          <button className={`edit-toggle${editMode ? ' active' : ''}`} type="button" onClick={() => setEditMode((v) => !v)}>
            {editMode ? '完了' : '並べ替え'}
          </button>
        </div>
        {!editMode ? (
          <button type="button" className="table-switch-btn" onClick={backToTableSelect}>
            ← テーブルを変える
          </button>
        ) : null}
      </div>

      {!editMode ? <div className={`done-banner${allDone ? ' show' : ''}`}>✅ 確認完了!ご案内をどうぞ</div> : null}

      <div className="category">
        <div className="category-head">
          <div className="badge">卓</div>
          <div>
            <div className="category-name">テーブルセット確認</div>
            <div className="category-sub">ご案内前〜ご案内中に上から順にチェック</div>
          </div>
        </div>
        <div className="items">
          {items.length === 0 ? <div className="empty-hint">項目がありません。</div> : null}
          {items.map((item, idx) => {
            if (editMode) {
              return (
                <div key={item.id} className="item">
                  <div className="order-btns">
                    <button
                      type="button"
                      className="order-btn"
                      aria-label="上に移動"
                      disabled={idx === 0}
                      onClick={() => moveItem(item.id, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="order-btn"
                      aria-label="下に移動"
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(item.id, 1)}
                    >
                      ▼
                    </button>
                  </div>
                  <span className="item-text">{item.text}</span>
                </div>
              )
            }
            const isChecked = checked.has(item.id)
            return (
              <div key={item.id} className="item clickable" tabIndex={0}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(item.id)} />
                  <span className="check-circle">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#fff2e6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="item-text">{item.text}</span>
                </label>
              </div>
            )
          })}
        </div>
      </div>

      {!editMode && currentTable ? (
        <div className="footer">
          <button className="next-guest-btn" type="button" onClick={() => finishTable(currentTable)}>
            このテーブルを完了(チェックをリセット)
          </button>
          <div className="footer-note">
            テーブルごとのチェック状態と項目の並び順は全端末で共有されます。お客様の評価は「お客様評価」ページで記録します。
          </div>
        </div>
      ) : null}
    </div>
  )
}
