'use client'

import { useState } from 'react'
import type { RenameResult, StaffResult } from '@/hooks/useTimecard'

export default function StaffManager({
  names,
  checksPostNames,
  staffColumnMissing,
  onAdd,
  onRename,
  onDelete,
  onCountRecords,
  onTogglePostCheck,
}: {
  names: string[]
  /** 出勤の前にポスト確認が必要な人の名前。 */
  checksPostNames: Set<string>
  staffColumnMissing: boolean
  onAdd: (name: string) => void
  onRename: (oldName: string, newName: string) => Promise<RenameResult>
  onDelete: (name: string) => void
  onCountRecords: (name: string) => Promise<number>
  onTogglePostCheck: (name: string, next: boolean) => Promise<StaffResult>
}) {
  const [newStaff, setNewStaff] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const togglePostCheck = async (name: string, next: boolean) => {
    setToggling(name)
    setError(null)
    const result = await onTogglePostCheck(name, next)
    setToggling(null)
    if (!result.ok) setError(result.error)
  }

  const startEdit = (name: string) => {
    setEditing(name)
    setDraft(name)
    setMessage(null)
    setError(null)
  }

  const save = async (oldName: string) => {
    setSaving(true)
    setError(null)
    const result = await onRename(oldName, draft)
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(null)
    setMessage(
      result.merged
        ? `「${oldName}」の記録を「${draft.trim()}」にまとめました。`
        : `「${oldName}」を「${draft.trim()}」に直しました。過去の記録も付け替えています。`,
    )
  }

  const remove = async (name: string) => {
    const count = await onCountRecords(name)
    const warning =
      count > 0
        ? `「${name}」には${count}件の記録があります。\n一覧からは消えますが、過去の記録はこの名前のまま残ります。\n\n名前の打ち間違いを直したい場合は、削除ではなく「名前を直す」を使ってください。\n\n削除しますか?`
        : `「${name}」を一覧から削除します。よろしいですか?`
    if (!window.confirm(warning)) return
    onDelete(name)
    setMessage(`「${name}」を一覧から削除しました。`)
  }

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">人</div>
        <div>
          <div className="category-name">スタッフの管理</div>
          <div className="category-sub">ここの名前は他の画面の担当者欄にも出ます</div>
        </div>
      </div>

      <div className="items">
        {names.length === 0 ? <div className="empty-hint">スタッフが登録されていません。</div> : null}
        {names.map((name) =>
          editing === name ? (
            <div key={name} className="staff-edit-row">
              <input
                className="satisfaction-input"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save(name)
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
              <div className="staff-edit-actions">
                <button type="button" className="next-guest-btn" disabled={saving} onClick={() => void save(name)}>
                  {saving ? '保存中…' : '保存'}
                </button>
                <button type="button" className="staff-cancel-btn" disabled={saving} onClick={() => setEditing(null)}>
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <div key={name} className="staff-row">
              <span className="staff-row-name">{name}</span>
              <button
                type="button"
                className={`staff-post-btn${checksPostNames.has(name) ? ' active' : ''}`}
                disabled={staffColumnMissing || toggling === name}
                onClick={() => void togglePostCheck(name, !checksPostNames.has(name))}
              >
                📬 ポスト確認{checksPostNames.has(name) ? 'あり' : 'なし'}
              </button>
              <button type="button" className="staff-rename-btn" onClick={() => startEdit(name)}>
                名前を直す
              </button>
              <button type="button" className="del-btn" aria-label={`${name}を削除`} onClick={() => void remove(name)}>
                ×
              </button>
            </div>
          ),
        )}
      </div>

      <div className="satisfaction-body">
        {staffColumnMissing ? (
          <div className="recorder-error">
            ポスト確認の列がまだありません。Supabaseで supabase-migration-post-check.sql を実行してください。
          </div>
        ) : null}
        <div className="staff-post-hint">
          「📬 ポスト確認あり」の人は、出勤の前に「ポストの確認をしました」を押さないと出勤できません。
          誰か1人が押せばその日はもう出ません。
        </div>
        {error ? <div className="recorder-error">{error}</div> : null}
        {message ? <div className="staff-message">{message}</div> : null}

        <label className="satisfaction-label">スタッフを追加</label>
        <div className="table-select-row">
          <input
            className="satisfaction-input table-select-input"
            placeholder="例) 山田"
            value={newStaff}
            onChange={(e) => setNewStaff(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAdd(newStaff)
                setNewStaff('')
              }
            }}
          />
          <button
            className="next-guest-btn"
            type="button"
            onClick={() => {
              onAdd(newStaff)
              setNewStaff('')
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  )
}
