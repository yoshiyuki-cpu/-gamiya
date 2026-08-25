'use client'

import { useRef } from 'react'
import type { Reservation } from '@/lib/supabase'
import { SEATS, TOTAL_SLOTS, slotLabel } from '@/lib/reservations'

const LONG_PRESS_MS = 450

export default function ReservationGrid({
  reservations,
  movingId,
  onOpen,
  onLongPress,
  onPickCell,
}: {
  reservations: Reservation[]
  movingId: number | null
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

  // 予約が占めているコマ。空きマスの判定に使う。
  const occupied = new Map<string, Reservation>()
  for (const r of reservations) {
    for (let i = 0; i < r.duration_slots; i++) occupied.set(`${r.seat}-${r.start_slot + i}`, r)
  }

  // 予約ブロックが複数行にまたがるため、自動配置に任せると後続のマスが
  // ずれていく。すべてのマスに列と行を明示して置く。
  const cells: React.ReactNode[] = []

  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
    const onHour = slot % 4 === 0
    cells.push(
      <div
        key={`t-${slot}`}
        className={`rv-time${onHour ? ' rv-time-hour' : ''}`}
        style={{ gridColumn: 1, gridRow: slot + 2 }}
      >
        {onHour ? slotLabel(slot) : ''}
      </div>,
    )

    SEATS.forEach((seat, seatIndex) => {
      const column = seatIndex + 2
      const row = slot + 2
      const key = `${seat.id}-${slot}`
      const r = occupied.get(key)

      if (r && r.start_slot === slot) {
        cells.push(
          <button
            key={key}
            type="button"
            className={`rv-block${r.is_walk_in ? ' rv-walkin' : ''}${movingId === r.id ? ' rv-moving' : ''}`}
            style={{ gridColumn: column, gridRow: `${row} / span ${r.duration_slots}` }}
            onPointerDown={() => startPress(r)}
            onPointerUp={() => endPress(r)}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="rv-block-name">{r.name ?? '(名前なし)'}</span>
            {r.party_size ? <span className="rv-block-size">{r.party_size}名</span> : null}
            {r.note ? <span className="rv-block-note">※</span> : null}
          </button>,
        )
        return
      }
      // 予約に覆われているコマは、ブロックが上に乗るので何も置かない。
      if (r) return

      cells.push(
        <button
          key={key}
          type="button"
          className={`rv-cell${onHour ? ' rv-cell-hour' : ''}${movingId ? ' rv-cell-target' : ''}`}
          style={{ gridColumn: column, gridRow: row }}
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
