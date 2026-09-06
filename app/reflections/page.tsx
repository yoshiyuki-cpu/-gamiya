'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SUMMARY_DAYS, legacyNoteText, useLegacyDailyNotes, useReflections } from '@/hooks/useReflections'
import type { Reflection } from '@/lib/supabase'
import { KIND_ICON, KIND_LABEL, byStaff, dateLabel, groupByDate } from '@/lib/reflections'
import { recentBusinessDayKeys } from '@/lib/checklist'

export const dynamic = 'force-dynamic'

type View = 'all' | 'staff'

/** 1行。タップで開いて、本文を直す／一覧から消す ができる。 */
function Row({
  row,
  saving,
  onEdit,
  onHide,
}: {
  row: Reflection
  saving: boolean
  onEdit: (id: number, body: string) => Promise<{ ok: boolean; error?: string }>
  onHide: (id: number) => Promise<{ ok: boolean; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.body)
  const [error, setError] = useState<string | null>(null)

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    const r = await p
    if (!r.ok) {
      setError(r.error ?? '保存できませんでした。')
      return
    }
    setEditing(false)
    setOpen(false)
  }

  return (
    <div className="rf-item">
      <button type="button" className="rf-item-main" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`rf-chip rf-chip-${row.kind}`}>{KIND_ICON[row.kind]}</span>
        <span className="rf-body">
          {row.body}
          {row.staff_name ? <span className="rf-who">{row.staff_name}</span> : null}
        </span>
        <span className="rf-item-arrow" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="rf-item-actions">
          {!editing ? (
            <div className="rf-action-row">
              <button
                type="button"
                className="st-btn"
                onClick={() => {
                  setDraft(row.body)
                  setEditing(true)
                }}
              >
                本文を直す
              </button>
              <button
                type="button"
                className="visit-delete-btn"
                disabled={saving}
                onClick={() => {
                  if (window.confirm('この1件を一覧から消します(記録は残ります)。よろしいですか?')) void run(onHide(row.id))
                }}
              >
                一覧から消す
              </button>
            </div>
          ) : (
            <div className="st-form">
              <textarea className="satisfaction-input" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="rf-action-row">
                <button type="button" className="next-guest-btn" disabled={saving || !draft.trim()} onClick={() => void run(onEdit(row.id, draft))}>
                  {saving ? '保存中…' : '保存'}
                </button>
                <button type="button" className="st-btn" onClick={() => setEditing(false)}>
                  やめる
                </button>
              </div>
            </div>
          )}

          {error ? <div className="recorder-error">{error}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export default function ReflectionsPage() {
  const { loading, saving, rows, counts, loadError, editBody, hide } = useReflections()
  const [view, setView] = useState<View>('all')

  // 議事録に残っている昔の「良かった事・悪かった事」も、日ごとの中に読むだけで並べる。
  const legacy = useLegacyDailyNotes()

  const sinceKey = recentBusinessDayKeys(SUMMARY_DAYS)[0]
  const groups = useMemo(() => {
    const base = groupByDate(rows)
    const dates = new Set(base.map((g) => g.date))
    const extra = [...new Set(legacy.map((n) => n.meeting_date))].filter((d) => !dates.has(d)).map((date) => ({ date, rows: [] as typeof rows }))
    return [...base, ...extra].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [rows, legacy])
  const staff = useMemo(() => byStaff(rows, sinceKey), [rows, sinceKey])

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="eyebrow">GAMIYA</div>
        <h1 className="title">ふりかえり</h1>
        <div className="subtitle">
          直近{SUMMARY_DAYS}日 👍良かった{counts.good} ・ ⚠悪かった{counts.bad}
        </div>
      </div>

      {loadError ? <div className="recorder-error rv-error">{loadError}</div> : null}

      <div className="view-toggle">
        <button type="button" className={`view-toggle-btn${view === 'all' ? ' active' : ''}`} onClick={() => setView('all')}>
          日ごと
        </button>
        <button type="button" className={`view-toggle-btn${view === 'staff' ? ' active' : ''}`} onClick={() => setView('staff')}>
          人ごと
        </button>
      </div>

      {view === 'all' ? (
        groups.length === 0 ? (
          <div className="empty-hint">まだ記録がありません。「日報」の画面から書けます。</div>
        ) : (
          groups.map((g) => (
            <div key={g.date} className="category">
              <div className="category-head">
                <div className="badge rf-date-badge">{g.date.slice(8).replace(/^0/, '')}</div>
                <div>
                  <div className="category-name">{dateLabel(g.date)}</div>
                  <div className="category-sub">
                    👍{g.rows.filter((r) => r.kind === 'good').length} ⚠{g.rows.filter((r) => r.kind === 'bad').length}
                  </div>
                </div>
              </div>
              <div className="rf-list">
                {g.rows.map((r) => (
                  <Row key={r.id} row={r} saving={saving} onEdit={editBody} onHide={hide} />
                ))}
                {legacy
                  .filter((n) => n.meeting_date === g.date)
                  .map((n) => (
                    <div key={`m${n.id}`} className="rf-legacy">
                      <span className="rf-chip rf-chip-legacy">議</span>
                      <span className="rf-body">
                        {legacyNoteText(n)}
                        <span className="rf-legacy-tag">議事録で書かれたもの(移す前の記録)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )
      ) : null}

      {view === 'staff' ? (
        <div className="category">
          <div className="category-head">
            <div className="badge">人</div>
            <div>
              <div className="category-name">誰が書いたか</div>
              <div className="category-sub">直近{SUMMARY_DAYS}日</div>
            </div>
          </div>
          {staff.length === 0 ? (
            <div className="empty-hint">まだ記録がありません。</div>
          ) : (
            <div className="rf-staff">
              {staff.map((s) => (
                <div key={s.name} className="rf-staff-row">
                  <span className="rf-staff-name">{s.name}</span>
                  <span className="rf-staff-count">
                    {KIND_ICON.good}{s.good} <span className="rf-staff-label">{KIND_LABEL.good}</span>
                  </span>
                  <span className="rf-staff-count">
                    {KIND_ICON.bad}{s.bad} <span className="rf-staff-label">{KIND_LABEL.bad}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <p className="rf-foot">
        書くのは「日報」の画面か、退勤のときです。消したい記録は「一覧から消す」で隠せます(記録は残ります)。{' '}
        <Link href="/reports">日報へ ›</Link>
      </p>
    </div>
  )
}
