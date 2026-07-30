'use client'

import { useState } from 'react'

const ITEMS = [
  'テーブル・椅子の清掃確認(汚れ・油べたつきなし)',
  '卓上調味料(塩・タレ・レモン塩)の補充確認',
  'おしぼりの用意',
  '網・コンロの状態確認(交換・着火確認)',
  '箸・取り皿・トングを人数分準備',
  'メニュー表・タブレットの動作確認',
  '喫煙/禁煙席に合わせて灰皿を設置/撤去',
  '子ども椅子・座布団の要否確認',
]

export default function GuestCheckPage() {
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false))

  const doneCount = checked.filter(Boolean).length
  const allDone = doneCount === ITEMS.length

  const toggle = (idx: number) => {
    setChecked((prev) => prev.map((v, i) => (i === idx ? !v : v)))
  }

  const nextGuest = () => {
    setChecked(ITEMS.map(() => false))
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">来客チェック</h1>
            <div className="subtitle">
              ご案内のたびに確認 ・ {doneCount}/{ITEMS.length} 完了
            </div>
          </div>
        </div>
      </div>

      <div className={`done-banner${allDone ? ' show' : ''}`}>✅ 確認完了!ご案内をどうぞ</div>

      <div className="category">
        <div className="category-head">
          <div className="badge">卓</div>
          <div>
            <div className="category-name">テーブルセット確認</div>
            <div className="category-sub">ご案内前に上から順にチェック</div>
          </div>
        </div>
        <div className="items">
          {ITEMS.map((text, idx) => (
            <div key={text} className="item clickable" tabIndex={0}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked[idx]} onChange={() => toggle(idx)} />
                <span className="check-circle">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#fff2e6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="item-text">{text}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="footer">
        <button className="next-guest-btn" type="button" onClick={nextGuest}>
          次のお客様へ(チェックをリセット)
        </button>
        <div className="footer-note">このチェックはこの端末上だけで一時的に記録され、保存はされません。</div>
      </div>
    </div>
  )
}
