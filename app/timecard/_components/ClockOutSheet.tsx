'use client'

import { useEffect, useState } from 'react'
import type { ReflectionKind } from '@/lib/supabase'
import type { ReflectionResult } from '@/hooks/useReflections'
import { KIND_ICON, KIND_LABEL } from '@/lib/reflections'

/**
 * 退勤の前に、今日の良かった事・悪かった事を1つ書いてもらう画面。
 * 書き忘れが多いので、退勤のボタンをここに置く(書かないと退勤できない)。
 * 名前は打刻したスタッフの名前をそのまま使う(店のスマホを共有しているため)。
 */
export default function ClockOutSheet({
  staffName,
  saving,
  onSave,
  onClose,
}: {
  staffName: string
  saving: boolean
  /** 記録できたら退勤まで進める。 */
  onSave: (kind: ReflectionKind, body: string) => Promise<ReflectionResult>
  onClose: () => void
}) {
  const [kind, setKind] = useState<ReflectionKind | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSave = kind !== null && body.trim() !== '' && !saving

  const submit = async () => {
    if (!kind) return
    setError(null)
    const result = await onSave(kind, body)
    if (!result.ok) setError(result.error)
  }

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-sheet co-sheet" role="dialog" aria-label="退勤の前に" onClick={(e) => e.stopPropagation()}>
        <div className="menu-head">
          <div>
            <div className="menu-title">退勤の前に、今日の1つ</div>
            <div className="co-sub">{staffName}さん ・ 良かった事か悪かった事を1行で</div>
          </div>
          <button type="button" className="menu-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="co-body">
          <div className="report-choice" role="group" aria-label="どちらか">
            {(['good', 'bad'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`report-choice-btn rf-kind-btn rf-kind-${k}${kind === k ? ' active' : ''}`}
                onClick={() => setKind(k)}
              >
                {KIND_ICON[k]} {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <textarea
            className="satisfaction-input co-text"
            placeholder={
              kind === 'bad'
                ? '例) 19時台に3卓同時にご案内が重なって、お通しが遅れた'
                : '例) お客様の誕生日に気づいてデザートを出した'
            }
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {error ? <div className="recorder-error">{error}</div> : null}

          <button type="button" className="tc-btn tc-btn-in co-submit" disabled={!canSave} onClick={() => void submit()}>
            {saving ? '保存中…' : kind ? `${KIND_LABEL[kind]}を記録して退勤する` : '良かった事か悪かった事を選んでください'}
          </button>
          <div className="co-note">記録は「ふりかえり」と日報に残ります。退勤の時刻は、記録できたときに押されます。</div>
        </div>
      </div>
    </div>
  )
}
