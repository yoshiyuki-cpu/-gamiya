'use client'

import { useEffect, useState } from 'react'
import type { ReflectionKind } from '@/lib/supabase'
import { KIND_ICON, KIND_LABEL } from '@/lib/reflections'

export type ClockOutInput = {
  /** ドリンクのおかわり杯数(0杯も入れる)。 */
  refills: number
  /** 今日まだ書いていない人だけ。 */
  reflection: { kind: ReflectionKind; body: string } | null
}

/**
 * 退勤の前の画面。
 * ・ドリンクのおかわりを何杯とれたか(毎回)
 * ・今日の良かった事・悪かった事を1つ(今日まだ書いていない人だけ)
 * 書き忘れが多いので、退勤のボタンをここに置く(入れないと退勤できない)。
 * 名前は打刻したスタッフの名前をそのまま使う(店のスマホを共有しているため)。
 */
export default function ClockOutSheet({
  staffName,
  saving,
  needsReflection,
  onSave,
  onClose,
}: {
  staffName: string
  saving: boolean
  needsReflection: boolean
  /** 記録できたら退勤まで進める。 */
  onSave: (input: ClockOutInput) => Promise<{ ok: true } | { ok: false; error: string }>
  onClose: () => void
}) {
  const [refills, setRefills] = useState<number | null>(null)
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

  const reflectionReady = !needsReflection || (kind !== null && body.trim() !== '')
  const canSave = refills !== null && reflectionReady && !saving

  const submit = async () => {
    if (refills === null) return
    if (needsReflection && !kind) return
    setError(null)
    const result = await onSave({
      refills,
      reflection: needsReflection && kind ? { kind, body } : null,
    })
    if (!result.ok) setError(result.error)
  }

  const submitLabel = saving
    ? '保存中…'
    : refills === null
      ? 'おかわりの杯数を入れてください'
      : needsReflection && !kind
        ? '良かった事か悪かった事を選んでください'
        : needsReflection && kind
          ? `${KIND_LABEL[kind]}を記録して退勤する`
          : '退勤する'

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-sheet co-sheet" role="dialog" aria-label="退勤の前に" onClick={(e) => e.stopPropagation()}>
        <div className="menu-head">
          <div>
            <div className="menu-title">退勤の前に</div>
            <div className="co-sub">
              {staffName}さん ・ {needsReflection ? 'おかわりの杯数と、今日の1つ' : 'おかわりの杯数'}
            </div>
          </div>
          <button type="button" className="menu-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="co-body">
          <div className="co-label">今日、ドリンクのおかわりを何杯とれましたか?</div>
          <div className="co-refill">
            <button
              type="button"
              className="co-step"
              aria-label="1杯減らす"
              disabled={refills === null || refills <= 0}
              onClick={() => setRefills((v) => Math.max(0, (v ?? 0) - 1))}
            >
              −
            </button>
            <input
              className="satisfaction-input co-refill-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              aria-label="おかわりの杯数"
              value={refills === null ? '' : String(refills)}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 3)
                setRefills(digits === '' ? null : Number(digits))
              }}
            />
            <span className="co-unit">杯</span>
            <button
              type="button"
              className="co-step"
              aria-label="1杯増やす"
              onClick={() => setRefills((v) => Math.min(999, (v ?? 0) + 1))}
            >
              ＋
            </button>
          </div>
          <div className="co-note">とれなかった日は「0」を入れてください。</div>

          {needsReflection ? (
            <>
              <div className="co-label">今日の良かった事か悪かった事を1行で</div>
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
            </>
          ) : null}

          {error ? <div className="recorder-error">{error}</div> : null}

          <button type="button" className="tc-btn tc-btn-in co-submit" disabled={!canSave} onClick={() => void submit()}>
            {submitLabel}
          </button>
          <div className="co-note">
            {needsReflection
              ? '記録は「ふりかえり」と日報に残ります。退勤の時刻は、記録できたときに押されます。'
              : '退勤の時刻は、このボタンを押したときに記録されます。'}
          </div>
        </div>
      </div>
    </div>
  )
}
