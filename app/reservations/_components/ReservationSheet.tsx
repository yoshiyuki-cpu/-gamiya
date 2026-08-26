'use client'

import { useState } from 'react'
import type { Reservation } from '@/lib/supabase'
import { DURATION_CHOICES, SEATS, durationLabel, rangeLabel, slotLabel } from '@/lib/reservations'

export type SheetTarget =
  | { mode: 'create'; seat: string; startSlot: number }
  | { mode: 'edit'; reservation: Reservation }

export default function ReservationSheet({
  target,
  saving,
  error,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onNudge,
}: {
  target: SheetTarget
  saving: boolean
  error: string | null
  onClose: () => void
  onCreate: (values: { seat: string; startSlot: number; durationSlots: number; name: string; partySize: string; note: string; isWalkIn: boolean }) => void
  onUpdate: (id: number, patch: Partial<Reservation>) => void
  onDelete: (id: number) => void
  onNudge: (id: number, deltaSlots: number) => void
}) {
  const existing = target.mode === 'edit' ? target.reservation : null

  const [seat, setSeat] = useState(existing?.seat ?? (target.mode === 'create' ? target.seat : SEATS[0].id))
  const [startSlot] = useState(existing?.start_slot ?? (target.mode === 'create' ? target.startSlot : 0))
  const [durationSlots, setDurationSlots] = useState(existing?.duration_slots ?? 6)
  const [name, setName] = useState(existing?.name ?? '')
  const [partySize, setPartySize] = useState(existing?.party_size ? String(existing.party_size) : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [isWalkIn, setIsWalkIn] = useState(existing?.is_walk_in ?? false)

  const save = () => {
    if (target.mode === 'create') {
      onCreate({ seat, startSlot, durationSlots, name, partySize, note, isWalkIn })
    } else {
      const size = Number(partySize)
      onUpdate(target.reservation.id, {
        seat,
        duration_slots: durationSlots,
        name: name.trim() || null,
        party_size: Number.isFinite(size) && size > 0 ? size : null,
        note: note.trim() || null,
        is_walk_in: isWalkIn,
      })
    }
  }

  return (
    <div className="rv-sheet-backdrop" onClick={onClose}>
      <div className="rv-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rv-sheet-head">
          <div>
            <div className="rv-sheet-title">{target.mode === 'create' ? '予約を追加' : '予約の変更'}</div>
            <div className="rv-sheet-sub">
              {slotLabel(startSlot)}開始 ・ {rangeLabel(startSlot, durationSlots)}({durationLabel(durationSlots)})
            </div>
          </div>
          <button type="button" className="rv-sheet-close" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="rv-sheet-body">
          {error ? <div className="recorder-error">{error}</div> : null}

          <label className="satisfaction-label">卓(1組ぶん)</label>
          <div className="rv-seat-picker">
            {SEATS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rv-seat-btn rv-seat-${s.kind}${seat === s.id ? ' active' : ''}`}
                onClick={() => setSeat(s.id)}
              >
                {s.id}
              </button>
            ))}
          </div>

          <label className="satisfaction-label">ご利用時間</label>
          <div className="rv-duration-picker">
            {DURATION_CHOICES.map((d) => (
              <button
                key={d.slots}
                type="button"
                className={`report-choice-btn${durationSlots === d.slots ? ' active' : ''}`}
                onClick={() => setDurationSlots(d.slots)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="rv-row-2">
            <div className="rv-field">
              <label className="satisfaction-label" htmlFor="rvName">
                お名前
              </label>
              <input
                id="rvName"
                className="satisfaction-input"
                placeholder="例) 田中様"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="rv-field rv-field-size">
              <label className="satisfaction-label" htmlFor="rvSize">
                人数
              </label>
              <input
                id="rvSize"
                className="satisfaction-input"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="4"
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
              />
            </div>
          </div>

          <label className="satisfaction-label" htmlFor="rvNote">
            備考
          </label>
          <textarea
            id="rvNote"
            className="satisfaction-input"
            placeholder="例) 肉ケーキを出す / 炙りレバー2人前を取り置き"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <label className="rv-walkin-toggle">
            <input type="checkbox" checked={isWalkIn} onChange={(e) => setIsWalkIn(e.target.checked)} />
            <span>当日の飛び込み来店</span>
          </label>

          {existing ? (
            <>
              <label className="satisfaction-label">時間をずらす</label>
              <div className="rv-nudge">
                <button type="button" className="tc-btn" disabled={saving} onClick={() => onNudge(existing.id, -1)}>
                  15分 早める
                </button>
                <button type="button" className="tc-btn" disabled={saving} onClick={() => onNudge(existing.id, 1)}>
                  15分 遅らせる
                </button>
              </div>
            </>
          ) : null}

          <button className="next-guest-btn satisfaction-submit" type="button" disabled={saving} onClick={save}>
            {saving ? '保存中…' : target.mode === 'create' ? 'この内容で登録' : '変更を保存'}
          </button>

          {existing ? (
            <button
              type="button"
              className="visit-delete-btn"
              disabled={saving}
              onClick={() => {
                if (window.confirm(`${existing.name ?? 'この予約'}を削除します。よろしいですか?`)) {
                  onDelete(existing.id)
                }
              }}
            >
              この予約を削除
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
