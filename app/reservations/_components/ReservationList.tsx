'use client'

import { useMemo, useState } from 'react'
import type { Reservation } from '@/lib/supabase'
import {
  STATUS_LABEL,
  isLate,
  rangeLabel,
  seatsLabel,
  type ReservationStatus,
} from '@/lib/reservations'

// 電話で「予約した田中ですが」と言われたときに、マス目を目で探さずに
// 済むようにするための一覧。名前でも電話番号でも引ける。
export default function ReservationList({
  reservations,
  nowSlot,
  saving,
  onOpen,
  onSetStatus,
}: {
  reservations: Reservation[]
  nowSlot: number | null
  saving: boolean
  onOpen: (r: Reservation) => void
  onSetStatus: (id: number, status: ReservationStatus) => void
}) {
  const [query, setQuery] = useState('')
  const [hideClosed, setHideClosed] = useState(true)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/[^0-9]/g, '')
    return reservations
      .filter((r) => {
        if (hideClosed && (r.status === 'cancelled' || r.status === 'noshow' || r.status === 'done')) return false
        if (!q) return true
        const name = (r.name ?? '').toLowerCase()
        const phone = (r.phone ?? '').replace(/[^0-9]/g, '')
        return name.includes(q) || (digits.length > 0 && phone.includes(digits)) || seatsLabel(r.seats).toLowerCase().includes(q)
      })
      .slice()
      .sort((a, b) => a.start_slot - b.start_slot || a.id - b.id)
  }, [reservations, query, hideClosed])

  const hiddenCount = reservations.length - rows.length

  return (
    <div className="category">
      <div className="satisfaction-body">
        <input
          className="satisfaction-input"
          type="search"
          placeholder="お名前・電話番号・卓で探す"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="rv-walkin-toggle">
          <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
          退店・キャンセルを隠す
        </label>
      </div>

      <div className="items">
        {rows.length === 0 ? (
          <div className="empty-hint">
            {query ? '見つかりませんでした。' : 'この日の予約はまだありません。'}
          </div>
        ) : null}

        {rows.map((r) => {
          const late = isLate(r, nowSlot)
          return (
            <div key={r.id} className={`rv-list-row${late ? ' rv-list-late' : ''}`}>
              <div
                className="rv-list-main"
                role="button"
                tabIndex={0}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onOpen(r)
                }}
              >
                <div className="rv-list-top">
                  <span className="rv-list-time">{rangeLabel(r.start_slot, r.duration_slots)}</span>
                  <span className="history-table">{seatsLabel(r.seats)}</span>
                  <span className="visit-name">{r.name ?? '(名前なし)'}</span>
                  <span className={`rv-chip rv-chip-${r.status}`}>
                    {late ? '遅れ' : STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="rv-list-meta">
                  {r.party_size ? (
                    <span>
                      {r.party_size}名{r.child_size ? `(子${r.child_size})` : ''}
                    </span>
                  ) : null}
                  {r.course ? <span className="rv-list-course">{r.course}</span> : null}
                  {r.source ? <span className="rv-list-source">{r.source}</span> : null}
                  {r.is_walk_in ? <span className="rv-list-source">当日</span> : null}
                  {r.phone ? (
                    <a
                      className="rv-call-link"
                      href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      📞 {r.phone}
                    </a>
                  ) : null}
                </div>
                {r.note ? <div className="rv-list-note">※{r.note}</div> : null}
              </div>

              {/* 当日いちばん押す2つだけを、開かずに押せるところへ置く。 */}
              <div className="rv-list-actions">
                {r.status === 'booked' ? (
                  <button
                    type="button"
                    className="rv-quick-btn rv-quick-in"
                    disabled={saving}
                    onClick={() => onSetStatus(r.id, 'seated')}
                  >
                    来店
                  </button>
                ) : null}
                {r.status === 'seated' ? (
                  <button
                    type="button"
                    className="rv-quick-btn rv-quick-out"
                    disabled={saving}
                    onClick={() => onSetStatus(r.id, 'done')}
                  >
                    退店
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {hideClosed && hiddenCount > 0 ? (
        <div className="rv-list-hidden">退店・キャンセルなど{hiddenCount}件を隠しています</div>
      ) : null}
    </div>
  )
}
