'use client'

import { useEffect, useState } from 'react'
import type { ReflectionKind } from '@/lib/supabase'
import { KIND_ICON, KIND_LABEL } from '@/lib/reflections'

export type ClockOutInput = {
  /** ドリンクのおかわり杯数(0杯も入れる)。 */
  refills: number
  /** 今日断った組数(店長・赤木だけ。0組も入れる)。聞かない人は null。 */
  turnaways: number | null
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
function CountStepper({
  value,
  onChange,
  unit,
  label,
}: {
  value: number | null
  onChange: (next: number | null) => void
  unit: string
  label: string
}) {
  return (
    <div className="co-refill">
      <button
        type="button"
        className="co-step"
        aria-label={`1${unit}減らす`}
        disabled={value === null || value <= 0}
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
      >
        −
      </button>
      <input
        className="satisfaction-input co-refill-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        aria-label={label}
        value={value === null ? '' : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 3)
          onChange(digits === '' ? null : Number(digits))
        }}
      />
      <span className="co-unit">{unit}</span>
      <button
        type="button"
        className="co-step"
        aria-label={`1${unit}増やす`}
        onClick={() => onChange(Math.min(999, (value ?? 0) + 1))}
      >
        ＋
      </button>
    </div>
  )
}

export default function ClockOutSheet({
  staffName,
  saving,
  needsReflection,
  askTurnaways,
  turnawaysSoFar,
  onSave,
  onClose,
}: {
  staffName: string
  saving: boolean
  needsReflection: boolean
  /** 店長・赤木のときだけ、今日断った組数も聞く。 */
  askTurnaways: boolean
  /** 今日すでに入っている数(もう1人が先に入れていたら、その数と名前)。 */
  turnawaysSoFar: { groups: number; by: string | null } | null
  /** 記録できたら退勤まで進める。 */
  onSave: (input: ClockOutInput) => Promise<{ ok: true } | { ok: false; error: string }>
  onClose: () => void
}) {
  const [refills, setRefills] = useState<number | null>(null)
  const [turnaways, setTurnaways] = useState<number | null>(turnawaysSoFar?.groups ?? null)
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
  const turnawaysReady = !askTurnaways || turnaways !== null
  const canSave = refills !== null && turnawaysReady && reflectionReady && !saving

  const submit = async () => {
    if (refills === null) return
    if (needsReflection && !kind) return
    setError(null)
    const result = await onSave({
      refills,
      turnaways: askTurnaways ? turnaways : null,
      reflection: needsReflection && kind ? { kind, body } : null,
    })
    if (!result.ok) setError(result.error)
  }

  const submitLabel = saving
    ? '保存中…'
    : refills === null
      ? 'おかわりの杯数を入れてください'
      : !turnawaysReady
        ? '断った組数を入れてください'
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
              {staffName}さん ・ {[askTurnaways ? '断った組数' : null, 'おかわりの杯数', needsReflection ? '今日の1つ' : null].filter(Boolean).join('と')}
            </div>
          </div>
          <button type="button" className="menu-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="co-body">
          {askTurnaways ? (
            <>
              <div className="co-label">今日、お断りした組は何組でしたか?</div>
              <CountStepper value={turnaways} onChange={setTurnaways} unit="組" label="断った組数" />
              <div className="co-note">
                {turnawaysSoFar
                  ? `${turnawaysSoFar.by ? `${turnawaysSoFar.by}さん` : 'ほかの人'}が入れた数(${turnawaysSoFar.groups}組)です。違えば直してください。`
                  : 'お断りしていない日は「0」を入れてください。'}
              </div>
            </>
          ) : null}
          <div className="co-label">今日、ドリンクのおかわりを何杯とれましたか?</div>
          <CountStepper value={refills} onChange={setRefills} unit="杯" label="おかわりの杯数" />
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
