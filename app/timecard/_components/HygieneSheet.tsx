'use client'

import { useEffect, useState } from 'react'
import { HYGIENE_ITEMS, partnerChoices } from '@/lib/hygiene'
import type { HygieneItemId } from '@/lib/hygiene'

/**
 * 出勤の前の身だしなみチェック。2人1組で、お互いに確認する。
 * 相手を選んで3項目すべてにチェックを入れないと、出勤のボタンが押せない。
 */
export default function HygieneSheet({
  staffName,
  staffList,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  staffName: string
  staffList: string[]
  saving: boolean
  error: string | null
  onConfirm: (partner: string) => void
  onClose: () => void
}) {
  const [partner, setPartner] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<HygieneItemId>>(new Set())
  const choices = partnerChoices(staffList, staffName)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (id: HygieneItemId) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allChecked = checked.size === HYGIENE_ITEMS.length
  const canSubmit = partner !== null && allChecked && !saving

  const label = saving
    ? '保存中…'
    : partner === null
      ? '確認してくれた相手を選んでください'
      : !allChecked
        ? `あと${HYGIENE_ITEMS.length - checked.size}項目チェックしてください`
        : '確認しました。出勤する'

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-sheet co-sheet" role="dialog" aria-label="出勤の前の身だしなみチェック" onClick={(e) => e.stopPropagation()}>
        <div className="menu-head">
          <div>
            <div className="menu-title">出勤の前の身だしなみチェック</div>
            <div className="co-sub">{staffName}さん ・ 2人1組で、お互いに確認してください</div>
          </div>
          <button type="button" className="menu-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="co-body">
          <div className="co-label">① 確認してくれた相手</div>
          {choices.length === 0 ? (
            <div className="recorder-error">相手になれるスタッフがいません。下の「スタッフの管理」から、もう1人登録してください。</div>
          ) : (
            <div className="hy-partners" role="group" aria-label="確認してくれた相手">
              {choices.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`hy-partner${partner === n ? ' active' : ''}`}
                  onClick={() => setPartner(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          <div className="co-label">② 3つとも、相手に見てもらってOKなら押す</div>
          <div className="hy-items">
            {HYGIENE_ITEMS.map((item) => {
              const on = checked.has(item.id)
              return (
                <label key={item.id} className={`regular-check${on ? ' checked' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(item.id)} />
                  <span className="regular-check-box" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                  <span className="hy-item-text">
                    <span className="regular-check-text">{item.label}</span>
                    <span className="hy-item-hint">{item.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>

          {error ? <div className="recorder-error">{error}</div> : null}

          <button type="button" className="tc-btn tc-btn-in co-submit" disabled={!canSubmit} onClick={() => partner && onConfirm(partner)}>
            {label}
          </button>
          <div className="co-note">押すと、そのまま出勤になります。確認した相手の名前も、出勤の記録に残ります。</div>
        </div>
      </div>
    </div>
  )
}
