'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { monthCells, monthKeyOf, monthLabel, monthRange, shiftMonth } from '@/lib/months'
import { holdsSeat, type ReservationStatus } from '@/lib/reservations'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

type DaySummary = { groups: number; guests: number }

/**
 * 予約表の日付を押すと出るカレンダー。
 * 日を選んで移るだけでなく、その月のどの日に何組入っているかを
 * 一覧で見るためのもの。手書きノートをめくって見ていた部分にあたる。
 */
export default function MonthCalendar({
  date,
  today,
  onPick,
  onClose,
}: {
  date: string
  today: string
  onPick: (date: string) => void
  onClose: () => void
}) {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(date))
  const [summary, setSummary] = useState<Record<string, DaySummary>>({})
  // 読み込み済みの月を持っておき、見たい月と違えば「読み込み中」とみなす。
  // 月を送った瞬間に前の月の組数が残らない。
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
  const loading = loadedMonth !== monthKey

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { start, end } = monthRange(monthKey)
      const { data, error } = await supabase
        .from('reservations')
        .select('reserve_date, party_size, status')
        .gte('reserve_date', start)
        .lte('reserve_date', end)
      if (cancelled) return
      if (error) {
        console.error('MonthCalendar: 予約の読み込みに失敗', error)
        setSummary({})
        setLoadedMonth(monthKey)
        return
      }
      const map: Record<string, DaySummary> = {}
      for (const row of (data ?? []) as { reserve_date: string; party_size: number | null; status: ReservationStatus }[]) {
        // キャンセルと無断キャンセルは入っていない日として数える。
        if (!holdsSeat(row.status)) continue
        const cell = (map[row.reserve_date] ??= { groups: 0, guests: 0 })
        cell.groups += 1
        cell.guests += row.party_size ?? 0
      }
      setSummary(map)
      setLoadedMonth(monthKey)
    })()
    return () => {
      cancelled = true
    }
  }, [monthKey])

  const cells = monthCells(monthKey)

  return (
    <div className="rv-sheet-backdrop" onClick={onClose}>
      <div className="rv-sheet rv-cal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rv-sheet-head">
          <div>
            <div className="rv-sheet-title">日付を選ぶ</div>
            <div className="rv-sheet-sub">数字はその日の組数です</div>
          </div>
          <button type="button" className="rv-sheet-close" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="rv-cal-nav">
          <button type="button" className="tc-month-btn" aria-label="前の月" onClick={() => setMonthKey((m) => shiftMonth(m, -1))}>
            ◀
          </button>
          <span className="rv-cal-month">{monthLabel(monthKey)}</span>
          <button type="button" className="tc-month-btn" aria-label="次の月" onClick={() => setMonthKey((m) => shiftMonth(m, 1))}>
            ▶
          </button>
        </div>

        <div className="rv-cal-grid rv-cal-head">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`rv-cal-wd${i === 0 ? ' rv-sun' : i === 6 ? ' rv-sat' : ''}`}>
              {w}
            </div>
          ))}
        </div>

        <div className="rv-cal-grid">
          {cells.map((cell, i) =>
            cell === null ? (
              <div key={`x-${i}`} className="rv-cal-blank" />
            ) : (
              <button
                key={cell}
                type="button"
                className={
                  'rv-cal-day' +
                  (cell === date ? ' rv-cal-picked' : '') +
                  (cell === today ? ' rv-cal-today' : '') +
                  (summary[cell] ? ' rv-cal-has' : '')
                }
                onClick={() => onPick(cell)}
              >
                <span className={`rv-cal-num${i % 7 === 0 ? ' rv-sun' : i % 7 === 6 ? ' rv-sat' : ''}`}>
                  {Number(cell.slice(8))}
                </span>
                <span className="rv-cal-count">{summary[cell] ? `${summary[cell].groups}組` : ''}</span>
              </button>
            ),
          )}
        </div>

        <div className="rv-cal-foot">
          <button type="button" className="rv-seat-btn" onClick={() => onPick(today)}>
            本日にもどる
          </button>
          <span className="rv-cal-note">{loading ? '読み込み中…' : '枠の色が濃い日は予約が入っています'}</span>
        </div>
      </div>
    </div>
  )
}
