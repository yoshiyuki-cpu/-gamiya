'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useReflections } from '@/hooks/useReflections'
import type { ReflectionKind } from '@/lib/supabase'
import { KIND_ICON, KIND_LABEL } from '@/lib/reflections'

const NAME_KEY = 'gamiya-shift-name'

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberName(name: string) {
  try {
    if (name.trim()) window.localStorage.setItem(NAME_KEY, name.trim())
  } catch {
    // 端末の設定で保存できないだけ。記録自体は進める。
  }
}

/**
 * 日報の中に置く「良かった事・悪かった事」の入口。
 * 良かった／悪かった を押す → 1行書く → 記録する、の3タップ。
 */
export default function ReflectionCard() {
  const { loading, saving, today, counts, loadError, add } = useReflections()
  const [kind, setKind] = useState<ReflectionKind | null>(null)
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // 名前はシフト・発注と同じ場所に覚えてあるので、毎回打たなくていい。
  // 最初のタップのときに読む(描画時に読むとサーバーと食い違うため)。
  const pick = (k: ReflectionKind) => {
    setKind(k)
    if (!name) setName(readName())
  }

  if (loading) return null

  const goodToday = today.filter((r) => r.kind === 'good').length
  const badToday = today.filter((r) => r.kind === 'bad').length
  const canSave = kind !== null && body.trim() !== '' && !saving

  const submit = async () => {
    if (!kind) return
    setError(null)
    const result = await add(kind, body, name)
    if (!result.ok) {
      setError(result.error)
      return
    }
    rememberName(name)
    setBody('')
    setKind(null)
    setSavedAt(Date.now())
  }

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">振</div>
        <div>
          <div className="category-name">良かった事・悪かった事</div>
          <div className="category-sub">
            気づいたときに1行 ・ 今日 👍{goodToday} ⚠{badToday}
          </div>
        </div>
        {counts.open > 0 ? <span className="x-status rf-open-badge">未対応{counts.open}</span> : null}
      </div>

      <div className="satisfaction-body">
        {loadError ? <div className="recorder-error">{loadError}</div> : null}

        <div className="report-choice" role="group" aria-label="どちらか">
          {(['good', 'bad'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`report-choice-btn rf-kind-btn rf-kind-${k}${kind === k ? ' active' : ''}`}
              onClick={() => pick(k)}
            >
              {KIND_ICON[k]} {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {kind ? (
          <>
            <textarea
              className="satisfaction-input"
              placeholder={
                kind === 'good'
                  ? '例) 田中さんがお客様の誕生日に気づいてデザートを出した'
                  : '例) 19時台に3卓同時にご案内が重なって、お通しが遅れた'
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              autoFocus
            />
            <div className="rf-name-row">
              <label className="satisfaction-label" htmlFor="rfName">
                書いた人
              </label>
              <input
                id="rfName"
                className="satisfaction-input x-staff-input"
                placeholder="例) 山田"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="next-guest-btn satisfaction-submit" type="button" disabled={!canSave} onClick={() => void submit()}>
              {saving ? '保存中…' : `${KIND_LABEL[kind]}として記録する`}
            </button>
          </>
        ) : savedAt ? (
          <div className="x-posted-note">記録しました。もう1つあれば、上から続けて書けます。</div>
        ) : null}

        {error ? <div className="recorder-error">{error}</div> : null}

        {today.length > 0 ? (
          <div className="report-notes">
            <div className="satisfaction-label">今日の分</div>
            {today.map((r) => (
              <div key={r.id} className="rf-row">
                <span className={`rf-chip rf-chip-${r.kind}`}>{KIND_ICON[r.kind]}</span>
                <span className="rf-body">
                  {r.body}
                  {r.staff_name ? <span className="rf-who">{r.staff_name}</span> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <Link href="/reflections" className="rf-more-link">
          これまでの一覧{counts.open > 0 ? `・未対応 ${counts.open}件` : ''} ›
        </Link>
      </div>
    </div>
  )
}
