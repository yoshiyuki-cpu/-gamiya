'use client'

import { useEffect, useState } from 'react'
import { useTimecard } from '@/hooks/useTimecard'
import type { StaffRow } from '@/hooks/useTimecard'
import { todayLabelText } from '@/lib/checklist'
import { breakMs, durationLabel, timeLabel, workedMs } from '@/lib/timecard'
import TimecardAdmin from './_components/TimecardAdmin'

export const dynamic = 'force-dynamic'

const STATE_LABEL: Record<StaffRow['state'], string> = {
  off: '未出勤',
  working: '勤務中',
  onBreak: '休憩中',
}

function StaffCard({
  row,
  busy,
  now,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
}: {
  row: StaffRow
  busy: boolean
  now: number
  onClockIn: () => void
  onClockOut: () => void
  onStartBreak: () => void
  onEndBreak: () => void
}) {
  const { entry, breaks, state } = row
  const done = !!entry?.clock_out

  return (
    <div className={`tc-card tc-${state}${done ? ' tc-done' : ''}`}>
      <div className="tc-card-top">
        <span className="tc-name">{row.name}</span>
        <span className={`tc-chip tc-chip-${done ? 'done' : state}`}>{done ? '退勤済み' : STATE_LABEL[state]}</span>
      </div>

      {entry ? (
        <div className="tc-card-times">
          <span>出勤 {timeLabel(entry.clock_in)}</span>
          {entry.clock_out ? <span>退勤 {timeLabel(entry.clock_out)}</span> : null}
          {breaks.length > 0 ? <span>休憩 {durationLabel(breakMs(breaks, now))}</span> : null}
          <span className="tc-card-worked">実働 {durationLabel(workedMs(entry, breaks, now))}</span>
        </div>
      ) : null}

      <div className="tc-card-actions">
        {state === 'off' ? (
          <button type="button" className="tc-btn tc-btn-in" disabled={busy} onClick={onClockIn}>
            {done ? 'もう一度出勤' : '出勤'}
          </button>
        ) : null}
        {state === 'working' ? (
          <>
            <button type="button" className="tc-btn tc-btn-break" disabled={busy} onClick={onStartBreak}>
              休憩に入る
            </button>
            <button type="button" className="tc-btn tc-btn-out" disabled={busy} onClick={onClockOut}>
              退勤
            </button>
          </>
        ) : null}
        {state === 'onBreak' ? (
          <>
            <button type="button" className="tc-btn tc-btn-in" disabled={busy} onClick={onEndBreak}>
              休憩から戻る
            </button>
            <button type="button" className="tc-btn tc-btn-out" disabled={busy} onClick={onClockOut}>
              退勤
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default function TimecardPage() {
  const { loading, busy, rows, clockIn, clockOut, startBreak, endBreak, addStaff } = useTimecard()
  const [tab, setTab] = useState<'punch' | 'admin'>('punch')
  const [newStaff, setNewStaff] = useState('')
  const [now, setNow] = useState(() => Date.now())

  // 勤務中の「実働」を伸ばしていく。分単位の表示なので30秒ごとで足りる。
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  const working = rows.filter((r) => r.state === 'working' || r.state === 'onBreak').length

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">勤怠</h1>
            <div className="subtitle">
              {todayLabelText()} ・ 勤務中{working}名
            </div>
          </div>
        </div>
      </div>

      <div className="view-toggle">
        <button
          type="button"
          className={`view-toggle-btn${tab === 'punch' ? ' active' : ''}`}
          onClick={() => setTab('punch')}
        >
          打刻
        </button>
        <button
          type="button"
          className={`view-toggle-btn${tab === 'admin' ? ' active' : ''}`}
          onClick={() => setTab('admin')}
        >
          管理・書き出し
        </button>
      </div>

      {tab === 'punch' ? (
        <>
          <div className="tc-list">
            {rows.length === 0 ? (
              <div className="empty-hint">スタッフが登録されていません。下から追加してください。</div>
            ) : null}
            {rows.map((row) => (
              <StaffCard
                key={row.name}
                row={row}
                busy={busy === row.name}
                now={now}
                onClockIn={() => clockIn(row.name)}
                onClockOut={() => clockOut(row)}
                onStartBreak={() => startBreak(row)}
                onEndBreak={() => endBreak(row)}
              />
            ))}
          </div>

          <div className="category">
            <div className="category-head">
              <div className="badge">＋</div>
              <div>
                <div className="category-name">スタッフを追加</div>
                <div className="category-sub">ここで追加した名前は他の画面の担当者欄にも出ます</div>
              </div>
            </div>
            <div className="satisfaction-body">
              <div className="table-select-row">
                <input
                  className="satisfaction-input table-select-input"
                  placeholder="例) 山田"
                  value={newStaff}
                  onChange={(e) => setNewStaff(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void addStaff(newStaff)
                      setNewStaff('')
                    }
                  }}
                />
                <button
                  className="next-guest-btn"
                  type="button"
                  onClick={() => {
                    void addStaff(newStaff)
                    setNewStaff('')
                  }}
                >
                  追加
                </button>
              </div>
            </div>
          </div>

          <div className="footer">
            <div className="footer-note">
              打刻は全端末で共有されます。深夜0時をまたぐ勤務も、出勤した日の1日分としてまとまります。
              押し忘れは「管理・書き出し」から直せます。
            </div>
          </div>
        </>
      ) : (
        <TimecardAdmin />
      )}
    </div>
  )
}
