'use client'

import { useState } from 'react'
import { useReservations } from '@/hooks/useReservations'
import type { Reservation } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'
import { dateLabel, shiftDate, slotLabel } from '@/lib/reservations'
import ReservationGrid from './_components/ReservationGrid'
import ReservationSheet from './_components/ReservationSheet'
import type { SheetTarget } from './_components/ReservationSheet'

export const dynamic = 'force-dynamic'

export default function ReservationsPage() {
  const [date, setDate] = useState(todayKey)
  const { loading, saving, reservations, stats, createReservation, updateReservation, nudge, deleteReservation } =
    useReservations(date)

  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState<Reservation | null>(null)

  const closeSheet = () => {
    setSheet(null)
    setError(null)
  }

  // 長押しで移動モードに入り、次に押した空きマスへ動かす。
  const handlePickCell = async (seat: string, slot: number) => {
    if (moving) {
      const result = await updateReservation(moving.id, { seat, start_slot: slot })
      if (!result.ok) setError(result.error)
      else setError(null)
      setMoving(null)
      return
    }
    setError(null)
    setSheet({ mode: 'create', seat, startSlot: slot })
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">予約表</h1>
            <div className="subtitle">
              予約{stats.booked}組 ・ 当日{stats.walkIn}組 ・ 合計{stats.guests}名
            </div>
          </div>
        </div>
      </div>

      <div className="rv-date-nav">
        <button type="button" className="tc-month-btn" onClick={() => setDate((d) => shiftDate(d, -1))}>
          ◀
        </button>
        <button type="button" className="rv-date-label" onClick={() => setDate(todayKey())}>
          {dateLabel(date)}
          {date !== todayKey() ? <span className="rv-today-hint">本日に戻る</span> : null}
        </button>
        <button type="button" className="tc-month-btn" onClick={() => setDate((d) => shiftDate(d, 1))}>
          ▶
        </button>
      </div>

      {moving ? (
        <div className="rv-moving-bar">
          <span>
            「{moving.name ?? '予約'}」を移動中 ・ 移動先のマスを押してください
          </span>
          <button type="button" className="rv-cancel-move" onClick={() => setMoving(null)}>
            やめる
          </button>
        </div>
      ) : null}

      {error ? <div className="recorder-error rv-error">{error}</div> : null}

      {loading ? (
        <div className="empty-hint">読み込み中…</div>
      ) : (
        <ReservationGrid
          reservations={reservations}
          movingId={moving?.id ?? null}
          onOpen={(r) => {
            setError(null)
            setSheet({ mode: 'edit', reservation: r })
          }}
          onLongPress={(r) => {
            setError(null)
            setMoving(r)
          }}
          onPickCell={handlePickCell}
        />
      )}

      {reservations.some((r) => r.note || r.course) ? (
        <div className="category rv-notes-card">
          <div className="category-head">
            <div className="badge">備</div>
            <div>
              <div className="category-name">備考・コースのある予約</div>
              <div className="category-sub">仕込み・取り置きの確認用</div>
            </div>
          </div>
          <div className="items">
            {reservations
              .filter((r) => r.note || r.course)
              .sort((a, b) => a.start_slot - b.start_slot)
              .map((r) => (
                <div key={r.id} className="rv-note-row">
                  <div className="rv-note-top">
                    <span className="rv-note-time">{slotLabel(r.start_slot)}</span>
                    <span className="history-table">{r.seat}</span>
                    <span className="visit-name">{r.name ?? '(名前なし)'}</span>
                    {r.party_size ? <span className="tc-times">{r.party_size}名</span> : null}
                    {r.course ? <span className="from-rv-chip">{r.course}</span> : null}
                  </div>
                  {r.note ? <div className="history-text">{r.note}</div> : null}
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="footer">
        <div className="footer-note">
          T1〜T4がテーブル、Z5〜Z8が座敷で、1つの列が1組ぶんの卓です。
          同じ時間に最大8組まで入ります(人数は何名でも1組は1列です)。
          空いているマスを押すと予約を追加、入っている予約は押すと変更、
          長押しすると別のマスへ移せます。
        </div>
      </div>

      {sheet ? (
        <ReservationSheet
          target={sheet}
          saving={saving}
          error={error}
          onClose={closeSheet}
          onCreate={async (v) => {
            const result = await createReservation({
              seat: v.seat,
              start_slot: v.startSlot,
              duration_slots: v.durationSlots,
              name: v.name,
              party_size: v.partySize,
              phone: v.phone,
              course: v.course,
              note: v.note,
              is_walk_in: v.isWalkIn,
            })
            if (result.ok) closeSheet()
            else setError(result.error)
          }}
          onUpdate={async (id, patch) => {
            const result = await updateReservation(id, patch)
            if (result.ok) closeSheet()
            else setError(result.error)
          }}
          onDelete={async (id) => {
            await deleteReservation(id)
            closeSheet()
          }}
          onNudge={async (id, delta) => {
            const result = await nudge(id, delta)
            if (result.ok) closeSheet()
            else setError(result.error)
          }}
        />
      ) : null}
    </div>
  )
}
