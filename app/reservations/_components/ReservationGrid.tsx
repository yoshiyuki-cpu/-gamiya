'use client'

import { useRef } from 'react'
import type { Reservation } from '@/lib/supabase'
import { SEATS, TOTAL_SLOTS, holdsSeat, isLate, seatIndex, seatRuns, slotLabel } from '@/lib/reservations'

const LONG_PRESS_MS = 450

export default function ReservationGrid({
  reservations,
  movingId,
  nowSlot,
  onOpen,
  onLongPress,
  onPickCell,
}: {
  reservations: Reservation[]
  movingId: number | null
  nowSlot: number | null
  onOpen: (r: Reservation) => void
  onLongPress: (r: Reservation) => void
  onPickCell: (seat: string, slot: number) => void
}) {
  // 長押しの判定。押しっぱなしで移動モードに入り、指を離すまでにスクロール
  // したら取り消す(表を送るつもりの操作で予約が動かないように)。
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  const startPress = (r: Reservation) => {
    firedRef.current = false
    timer.current = setTimeout(() => {
      firedRef.current = true
      onLongPress(r)
    }, LONG_PRESS_MS)
  }
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const endPress = (r: Reservation) => {
    cancelPress()
    if (!firedRef.current) onOpen(r)
  }

  // キャンセルと無断キャンセルは卓を空ける。表からは消える。
  const active = reservations.filter((r) => holdsSeat(r.status))

  // 予約が占めているコマ。空きマスの判定に使う。
  const occupied = new Map<string, Reservation>()
  for (const r of active) {
    for (const seat of r.seats) {
      for (let i = 0; i < r.duration_slots; i++) occupied.set(`${seat}-${r.start_slot + i}`, r)
    }
  }

  // 予約ブロックが複数行・複数列にまたがるため、自動配置に任せると
  // 後続のマスがずれていく。すべてのマスに列と行を明示して置く。
  const cells: React.ReactNode[] = []

  // 帯は「並びが続く卓のかたまり」ごとに1つ描く。座敷を2つ繋いだ予約は
  // 1本の帯になり、離れた卓を使う予約は分かれて描かれる。
  for (const r of active) {
    for (const run of seatRuns(r.seats)) {
      const first = seatIndex(run[0])
      if (first < 0) continue
      const late = isLate(r, nowSlot)
      cells.push(
        <button
          key={`b-${r.id}-${run[0]}`}
          type="button"
          className={
            `rv-block rv-st-${r.status}` +
            (r.is_walk_in ? ' rv-walkin' : '') +
            (late ? ' rv-late' : '') +
            (movingId === r.id ? ' rv-moving' : '')
          }
          style={{
            gridColumn: `${first + 2} / span ${run.length}`,
            gridRow: `${r.start_slot + 2} / span ${r.duration_slots}`,
          }}
          onPointerDown={() => startPress(r)}
          onPointerUp={() => endPress(r)}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="rv-block-name">{r.name ?? '(名前なし)'}</span>
          {r.party_size ? (
            <span className="rv-block-size">
              {r.party_size}名{r.child_size ? `(子${r.child_size})` : ''}
            </span>
          ) : null}
          <span className="rv-block-tags">
            {r.status === 'seated' ? <span className="rv-block-in">来店中</span> : null}
            {r.status === 'done' ? <span className="rv-block-done">退店</span> : null}
            {late ? <span className="rv-block-late">遅れ</span> : null}
            {r.note ? <span className="rv-block-note">※</span> : null}
          </span>
        </button>,
      )
    }
  }

  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
    const onHour = slot % 4 === 0
    cells.push(
      <div
        key={`t-${slot}`}
        className={`rv-time${onHour ? ' rv-time-hour' : ''}${nowSlot === slot ? ' rv-time-now' : ''}`}
        style={{ gridColumn: 1, gridRow: slot + 2 }}
      >
        {onHour ? slotLabel(slot) : ''}
      </div>,
    )

    SEATS.forEach((seat, seatIdx) => {
      // 予約に覆われているコマは、帯が上に乗るので何も置かない。
      if (occupied.has(`${seat.id}-${slot}`)) return
      cells.push(
        <button
          key={`c-${seat.id}-${slot}`}
          type="button"
          className={
            `rv-cell${onHour ? ' rv-cell-hour' : ''}` +
            (movingId ? ' rv-cell-target' : '') +
            (nowSlot === slot ? ' rv-cell-now' : '')
          }
          style={{ gridColumn: seatIdx + 2, gridRow: slot + 2 }}
          onClick={() => onPickCell(seat.id, slot)}
          aria-label={`${seat.id} ${slotLabel(slot)}`}
        />,
      )
    })
  }

  return (
    <div className="rv-grid-wrap">
      <div
        className="rv-grid"
        style={{
          gridTemplateColumns: `44px repeat(${SEATS.length}, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, 26px)`,
        }}
      >
        <div className="rv-corner" style={{ gridColumn: 1, gridRow: 1 }} />
        {SEATS.map((s, i) => (
          <div key={s.id} className={`rv-head rv-head-${s.kind}`} style={{ gridColumn: i + 2, gridRow: 1 }}>
            {s.id}
          </div>
        ))}
        {cells}
      </div>
    </div>
  )
}
