'use client'

import { useEffect, useState } from 'react'
import { useReservations } from '@/hooks/useReservations'
import type { Reservation } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'
import { currentSlot, dateLabel, seatsLabel, shiftDate, slotLabel } from '@/lib/reservations'
import ReservationGrid from './_components/ReservationGrid'
import ReservationList from './_components/ReservationList'
import ReservationSheet from './_components/ReservationSheet'
import type { SheetTarget } from './_components/ReservationSheet'

export const dynamic = 'force-dynamic'

export default function ReservationsPage() {
  const [date, setDate] = useState(todayKey)
  const {
    loading,
    saving,
    reservations,
    stats,
    freeByHour,
    createReservation,
    updateReservation,
    setStatus,
    nudge,
    deleteReservation,
  } = useReservations(date)

  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState<Reservation | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // 遅れの判定と「いま」の線のために、1分ごとに時刻を見直す。
  const [nowSlot, setNowSlot] = useState<number | null>(null)
  useEffect(() => {
    const isToday = date === todayKey()
    const update = () => setNowSlot(isToday ? currentSlot() : null)
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [date])

  const closeSheet = () => {
    setSheet(null)
    setError(null)
  }

  // 長押しで移動モードに入り、次に押した空きマスへ動かす。
  const handlePickCell = async (seat: string, slot: number) => {
    if (moving) {
      const result = await updateReservation(moving.id, { seats: [seat], start_slot: slot })
      if (!result.ok) setError(result.error)
      else setError(null)
      setMoving(null)
      return
    }
    setError(null)
    setSheet({ mode: 'create', seat, startSlot: slot })
  }

  const openSheet = (r: Reservation) => {
    setError(null)
    setSheet({ mode: 'edit', reservation: r })
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
              {stats.children > 0 ? `(子${stats.children})` : ''}
              {stats.seated > 0 ? ` ・ 来店中${stats.seated}組` : ''}
              {stats.cancelled + stats.noshow > 0 ? ` ・ 取消${stats.cancelled + stats.noshow}` : ''}
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

      {/* 電話を受けながら「その時間あと何卓空いているか」を見るための帯。 */}
      <div className="rv-free-strip">
        {freeByHour.map((h) => (
          <div key={h.hour} className={`rv-free-cell${h.free === 0 ? ' rv-free-none' : ''}`}>
            <span className="rv-free-hour">{h.hour}時</span>
            <span className="rv-free-num">{h.free}</span>
          </div>
        ))}
      </div>

      <div className="view-toggle">
        <button type="button" className={`view-toggle-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')}>
          表
        </button>
        <button type="button" className={`view-toggle-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>
          一覧・検索
        </button>
      </div>

      {moving ? (
        <div className="rv-moving-bar">
          <span>「{moving.name ?? '予約'}」を移動中 ・ 移動先のマスを押してください</span>
          <button type="button" className="rv-cancel-move" onClick={() => setMoving(null)}>
            やめる
          </button>
        </div>
      ) : null}

      {error ? <div className="recorder-error rv-error">{error}</div> : null}

      {loading ? (
        <div className="empty-hint">読み込み中…</div>
      ) : view === 'grid' ? (
        <ReservationGrid
          reservations={reservations}
          movingId={moving?.id ?? null}
          nowSlot={nowSlot}
          onOpen={openSheet}
          onLongPress={(r) => {
            setError(null)
            setMoving(r)
          }}
          onPickCell={handlePickCell}
        />
      ) : (
        <ReservationList
          reservations={reservations}
          nowSlot={nowSlot}
          saving={saving}
          onOpen={openSheet}
          onSetStatus={async (id, s) => {
            const result = await setStatus(id, s)
            if (!result.ok) setError(result.error)
          }}
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
              .filter((r) => (r.note || r.course) && r.status !== 'cancelled' && r.status !== 'noshow')
              .sort((a, b) => a.start_slot - b.start_slot)
              .map((r) => (
                <div key={r.id} className="rv-note-row">
                  <div className="rv-note-top">
                    <span className="rv-note-time">{slotLabel(r.start_slot)}</span>
                    <span className="history-table">{seatsLabel(r.seats)}</span>
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
          T1〜T4がテーブル、Z5〜Z8が座敷です。座敷を繋ぐ大人数は、卓を複数選んで1組として押さえられます。
          空いているマスを押すと予約を追加、入っている予約は押すと変更、長押しすると別のマスへ移せます。
          お客様が着いたら「来店」を押してください。押した卓だけが埋まっているものとして扱われます。
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
              seats: v.seats,
              start_slot: v.startSlot,
              duration_slots: v.durationSlots,
              name: v.name,
              party_size: v.partySize,
              child_size: v.childSize,
              phone: v.phone,
              course: v.course,
              note: v.note,
              source: v.source,
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
          onSetStatus={async (id, s) => {
            const result = await setStatus(id, s)
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
