'use client'

import { useState } from 'react'
import type { Reservation } from '@/lib/supabase'
import {
  DURATION_CHOICES,
  SEATS,
  SOURCES,
  STATUS_LABEL,
  durationLabel,
  rangeLabel,
  seatsLabel,
  slotLabel,
  sortSeats,
  type ReservationStatus,
} from '@/lib/reservations'

export type SheetTarget =
  | { mode: 'create'; seat: string; startSlot: number }
  | { mode: 'edit'; reservation: Reservation }

export type CreateValues = {
  seats: string[]
  startSlot: number
  durationSlots: number
  name: string
  partySize: string
  childSize: string
  phone: string
  course: string
  note: string
  source: string
  isWalkIn: boolean
}

export default function ReservationSheet({
  target,
  saving,
  error,
  onClose,
  onCreate,
  onUpdate,
  onSetStatus,
  onDelete,
  onNudge,
}: {
  target: SheetTarget
  saving: boolean
  error: string | null
  onClose: () => void
  onCreate: (values: CreateValues) => void
  onUpdate: (id: number, patch: Partial<Reservation>) => void
  onSetStatus: (id: number, status: ReservationStatus) => void
  onDelete: (id: number) => void
  onNudge: (id: number, deltaSlots: number) => void
}) {
  const existing = target.mode === 'edit' ? target.reservation : null

  const [seats, setSeats] = useState<string[]>(
    existing?.seats ?? (target.mode === 'create' ? [target.seat] : [SEATS[0].id]),
  )
  const [startSlot] = useState(existing?.start_slot ?? (target.mode === 'create' ? target.startSlot : 0))
  const [durationSlots, setDurationSlots] = useState(existing?.duration_slots ?? 6)
  const [name, setName] = useState(existing?.name ?? '')
  const [partySize, setPartySize] = useState(existing?.party_size ? String(existing.party_size) : '')
  const [childSize, setChildSize] = useState(existing?.child_size ? String(existing.child_size) : '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [course, setCourse] = useState(existing?.course ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [source, setSource] = useState(existing?.source ?? '')
  const [isWalkIn, setIsWalkIn] = useState(existing?.is_walk_in ?? false)

  const toggleSeat = (id: string) => {
    setSeats((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : sortSeats([...prev, id])))
  }

  const toCount = (value: string): number | null => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const save = () => {
    if (target.mode === 'create') {
      onCreate({
        seats,
        startSlot,
        durationSlots,
        name,
        partySize,
        childSize,
        phone,
        course,
        note,
        source,
        isWalkIn,
      })
    } else {
      onUpdate(target.reservation.id, {
        seats,
        duration_slots: durationSlots,
        name: name.trim() || null,
        party_size: toCount(partySize),
        child_size: toCount(childSize),
        phone: phone.trim() || null,
        course: course.trim() || null,
        note: note.trim() || null,
        source: source || null,
        is_walk_in: isWalkIn,
      })
    }
  }

  const status = existing?.status ?? 'booked'

  return (
    <div className="rv-sheet-backdrop" onClick={onClose}>
      <div className="rv-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rv-sheet-head">
          <div>
            <div className="rv-sheet-title">{target.mode === 'create' ? '予約を追加' : '予約の変更'}</div>
            <div className="rv-sheet-sub">
              {slotLabel(startSlot)}開始 ・ {rangeLabel(startSlot, durationSlots)}({durationLabel(durationSlots)})
              {seats.length > 1 ? ` ・ ${seatsLabel(seats)}の${seats.length}卓` : ''}
            </div>
          </div>
          <button type="button" className="rv-sheet-close" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="rv-sheet-body">
          {/* 来店の状態。当日いちばん押されるので、いちばん上に置く。 */}
          {existing ? (
            <>
              <label className="satisfaction-label">いまの状態 ・ {STATUS_LABEL[status]}</label>
              <div className="rv-status-row">
                {(['booked', 'seated', 'done'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`rv-status-btn rv-status-${s}${status === s ? ' active' : ''}`}
                    disabled={saving}
                    onClick={() => onSetStatus(existing.id, s)}
                  >
                    {s === 'booked' ? '未来店' : s === 'seated' ? '来店した' : '退店した'}
                  </button>
                ))}
              </div>
              <div className="rv-status-row">
                {(['cancelled', 'noshow'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`rv-status-btn rv-status-${s}${status === s ? ' active' : ''}`}
                    disabled={saving}
                    onClick={() => onSetStatus(existing.id, s)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <div className="rv-sheet-hint">
                キャンセルは消さずにここで記録します。あとからキャンセル率を数えられるようにするためです。
              </div>
            </>
          ) : null}

          <label className="satisfaction-label">
            卓（複数選べます。座敷を繋ぐ大人数はまとめて押してください）
          </label>
          <div className="rv-seat-picker">
            {SEATS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rv-seat-btn rv-seat-${s.kind}${seats.includes(s.id) ? ' active' : ''}`}
                onClick={() => toggleSeat(s.id)}
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
                className={`rv-seat-btn${durationSlots === d.slots ? ' active rv-seat-table' : ''}`}
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
            <div className="rv-field rv-field-size">
              <label className="satisfaction-label" htmlFor="rvChild">
                うち子供
              </label>
              <input
                id="rvChild"
                className="satisfaction-input"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={childSize}
                onChange={(e) => setChildSize(e.target.value)}
              />
            </div>
          </div>

          <div className="rv-row-2">
            <div className="rv-field">
              <label className="satisfaction-label" htmlFor="rvPhone">
                電話番号
              </label>
              <input
                id="rvPhone"
                className="satisfaction-input"
                type="tel"
                inputMode="tel"
                placeholder="090-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {/* 確認の電話をその場でかけられるように。 */}
              {phone.trim() ? (
                <a className="rv-call-link" href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>
                  📞 この番号にかける
                </a>
              ) : null}
            </div>
            <div className="rv-field">
              <label className="satisfaction-label" htmlFor="rvCourse">
                コース
              </label>
              <input
                id="rvCourse"
                className="satisfaction-input"
                placeholder="例) 上コース"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>
          </div>

          <label className="satisfaction-label">どこから入った予約か</label>
          <div className="rv-source-picker">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                className={`rv-source-btn${source === s ? ' active' : ''}`}
                onClick={() => setSource(source === s ? '' : s)}
              >
                {s}
              </button>
            ))}
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
            当日の飛び込み来店
          </label>

          {existing ? (
            <>
              <label className="satisfaction-label">時間をずらす</label>
              <div className="rv-nudge">
                <button
                  type="button"
                  className="rv-seat-btn"
                  disabled={saving}
                  onClick={() => onNudge(existing.id, -1)}
                >
                  15分 早める
                </button>
                <button
                  type="button"
                  className="rv-seat-btn"
                  disabled={saving}
                  onClick={() => onNudge(existing.id, 1)}
                >
                  15分 遅らせる
                </button>
              </div>
            </>
          ) : null}

          {error ? <div className="recorder-error">{error}</div> : null}

          <button className="next-guest-btn" type="button" disabled={saving} onClick={save}>
            {target.mode === 'create' ? 'この内容で登録' : '変更を保存'}
          </button>

          {existing ? (
            <button
              className="visit-delete-btn"
              type="button"
              disabled={saving}
              onClick={() => {
                if (window.confirm('この予約を表から消します。入力の間違いを消すとき用です。お客様都合の取り消しは「キャンセル」を使ってください。よろしいですか?')) {
                  onDelete(existing.id)
                }
              }}
            >
              入力の間違いとして削除する
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
