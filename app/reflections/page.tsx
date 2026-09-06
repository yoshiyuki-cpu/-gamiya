'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SUMMARY_DAYS, useReflections } from '@/hooks/useReflections'
import type { Reflection } from '@/lib/supabase'
import { KIND_ICON, KIND_LABEL, byStaff, dateLabel, groupByDate, isOpen } from '@/lib/reflections'
import { recentBusinessDayKeys } from '@/lib/checklist'

export const dynamic = 'force-dynamic'

const NAME_KEY = 'gamiya-shift-name'

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

type View = 'open' | 'all' | 'staff'

function resolvedLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 1行。タップで開いて、直した／本文を直す／非表示 ができる。 */
function Row({
  row,
  saving,
  onResolve,
  onReopen,
  onEdit,
  onHide,
}: {
  row: Reflection
  saving: boolean
  onResolve: (id: number, by: string, note: string) => Promise<{ ok: boolean; error?: string }>
  onReopen: (id: number) => Promise<{ ok: boolean; error?: string }>
  onEdit: (id: number, body: string) => Promise<{ ok: boolean; error?: string }>
  onHide: (id: number) => Promise<{ ok: boolean; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'none' | 'resolve' | 'edit'>('none')
  const [by, setBy] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(row.body)
  const [error, setError] = useState<string | null>(null)

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    const r = await p
    if (!r.ok) {
      setError(r.error ?? '保存できませんでした。')
      return
    }
    setMode('none')
    setOpen(false)
  }

  return (
    <div className={`rf-item${isOpen(row) ? ' rf-item-open' : ''}`}>
      <button type="button" className="rf-item-main" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`rf-chip rf-chip-${row.kind}`}>{KIND_ICON[row.kind]}</span>
        <span className="rf-body">
          {row.body}
          {row.staff_name ? <span className="rf-who">{row.staff_name}</span> : null}
          {row.resolved_at ? (
            <span className="rf-resolved">
              ✓ 直した {resolvedLabel(row.resolved_at)}
              {row.resolved_by ? ` ${row.resolved_by}` : ''}
              {row.resolve_note ? ` — ${row.resolve_note}` : ''}
            </span>
          ) : null}
        </span>
        <span className="rf-item-arrow" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="rf-item-actions">
          {mode === 'none' ? (
            <div className="rf-action-row">
              {row.kind === 'bad' && !row.resolved_at ? (
                <button
                  type="button"
                  className="st-btn st-btn-done"
                  onClick={() => {
                    setBy(readName())
                    setMode('resolve')
                  }}
                >
                  直した
                </button>
              ) : null}
              {row.resolved_at ? (
                <button type="button" className="st-btn" disabled={saving} onClick={() => void run(onReopen(row.id))}>
                  まだ直っていない
                </button>
              ) : null}
              <button
                type="button"
                className="st-btn"
                onClick={() => {
                  setDraft(row.body)
                  setMode('edit')
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
          ) : null}

          {mode === 'resolve' ? (
            <div className="st-form">
              <label className="satisfaction-label">直した人</label>
              <input className="satisfaction-input x-staff-input" value={by} onChange={(e) => setBy(e.target.value)} placeholder="例) 山田" />
              <label className="satisfaction-label">どう直したか(任意)</label>
              <textarea
                className="satisfaction-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例) 19時台はキッチンから1人ホールに出ることにした"
              />
              <div className="rf-action-row">
                <button type="button" className="next-guest-btn" disabled={saving} onClick={() => void run(onResolve(row.id, by, note))}>
                  {saving ? '保存中…' : '直したことにする'}
                </button>
                <button type="button" className="st-btn" onClick={() => setMode('none')}>
                  やめる
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'edit' ? (
            <div className="st-form">
              <textarea className="satisfaction-input" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="rf-action-row">
                <button type="button" className="next-guest-btn" disabled={saving || !draft.trim()} onClick={() => void run(onEdit(row.id, draft))}>
                  {saving ? '保存中…' : '保存'}
                </button>
                <button type="button" className="st-btn" onClick={() => setMode('none')}>
                  やめる
                </button>
              </div>
            </div>
          ) : null}

          {error ? <div className="recorder-error">{error}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export default function ReflectionsPage() {
  const { loading, saving, rows, counts, loadError, missingTable, resolve, reopen, editBody, hide } = useReflections()
  const [view, setView] = useState<View>('open')

  const sinceKey = recentBusinessDayKeys(SUMMARY_DAYS)[0]
  const openRows = useMemo(() => rows.filter(isOpen).sort((a, b) => (a.note_date < b.note_date ? 1 : a.note_date > b.note_date ? -1 : b.id - a.id)), [rows])
  const groups = useMemo(() => groupByDate(rows), [rows])
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
          直近{SUMMARY_DAYS}日 👍良かった{counts.good} ・ ⚠悪かった{counts.bad} ・ 未対応{counts.open}
        </div>
      </div>

      {loadError ? <div className="recorder-error rv-error">{loadError}</div> : null}

      <div className="view-toggle">
        <button type="button" className={`view-toggle-btn${view === 'open' ? ' active' : ''}`} onClick={() => setView('open')}>
          未対応({counts.open})
        </button>
        <button type="button" className={`view-toggle-btn${view === 'all' ? ' active' : ''}`} onClick={() => setView('all')}>
          日ごと
        </button>
        <button type="button" className={`view-toggle-btn${view === 'staff' ? ' active' : ''}`} onClick={() => setView('staff')}>
          人ごと
        </button>
      </div>

      {view === 'open' ? (
        <div className="category">
          <div className="category-head">
            <div className="badge">未</div>
            <div>
              <div className="category-name">まだ直していない悪かった事</div>
              <div className="category-sub">直したら、開いて「直した」を押してください</div>
            </div>
          </div>
          {openRows.length === 0 ? (
            <div className="empty-hint">{missingTable ? '' : '未対応の悪かった事はありません。'}</div>
          ) : (
            <div className="rf-list">
              {openRows.map((r) => (
                <div key={r.id} className="rf-dated">
                  <div className="rf-date">{dateLabel(r.note_date)}</div>
                  <Row row={r} saving={saving} onResolve={resolve} onReopen={reopen} onEdit={editBody} onHide={hide} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

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
                  <Row key={r.id} row={r} saving={saving} onResolve={resolve} onReopen={reopen} onEdit={editBody} onHide={hide} />
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
        書くのは「日報」の画面から。悪かった事は直した人が「直した」を押すと、未対応から消えます。
        消したい記録は「一覧から消す」で隠せます(記録は残ります)。{' '}
        <Link href="/reports">日報へ ›</Link>
      </p>
    </div>
  )
}
