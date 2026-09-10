'use client'

import { useEffect } from 'react'

/**
 * 出勤の前に出す、ポスト確認の画面。
 * 店長・赤木のどちらか一方が押せば、その日はもう出ない(共有の確認)。
 */
export default function PostCheckSheet({
  staffName,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  staffName: string
  saving: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-sheet co-sheet" role="dialog" aria-label="出勤の前に" onClick={(e) => e.stopPropagation()}>
        <div className="menu-head">
          <div>
            <div className="menu-title">出勤の前に</div>
            <div className="co-sub">{staffName}さん ・ ポストを確認してから出勤を押してください</div>
          </div>
          <button type="button" className="menu-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="co-body">
          {error ? <div className="recorder-error">{error}</div> : null}

          <button type="button" className="tc-btn tc-btn-in co-submit" disabled={saving} onClick={() => void onConfirm()}>
            📬 {saving ? '保存中…' : 'ポストの確認をしました'}
          </button>
          <div className="co-note">押すと、この後そのまま出勤になります。今日すでにどちらかが押していれば、次からは出ません。</div>
        </div>
      </div>
    </div>
  )
}
