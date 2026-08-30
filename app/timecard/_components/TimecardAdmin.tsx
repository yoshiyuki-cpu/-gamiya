'use client'

import { useMemo, useState } from 'react'
import { useTimecardMonth } from '@/hooks/useTimecard'
import type { MonthEntry } from '@/hooks/useTimecard'
import {
  breakMs,
  composeAt,
  currentMonthKey,
  durationHours,
  durationLabel,
  monthLabel,
  shiftMonth,
  timeLabel,
  workedMs,
} from '@/lib/timecard'

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function buildCsv(items: MonthEntry[]): string {
  const header = ['日付', 'スタッフ名', '出勤', '退勤', '休憩', '実労働', '実労働(時間)', '備考']
  const rows = items.map(({ entry, breaks }) => {
    const worked = entry.clock_out ? workedMs(entry, breaks) : 0
    return [
      entry.work_date,
      entry.staff_name,
      timeLabel(entry.clock_in),
      entry.clock_out ? timeLabel(entry.clock_out) : '未退勤',
      durationLabel(breakMs(breaks)),
      entry.clock_out ? durationLabel(worked) : '',
      entry.clock_out ? durationHours(worked) : '',
      entry.note ?? '',
    ]
  })
  // Excelで開いたときに日本語が文字化けしないよう、先頭にBOMを付ける。
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

function EntryEditor({
  item,
  onUpdateEntry,
  onMoveDate,
  onUpdateBreak,
  onDeleteBreak,
  onDeleteEntry,
}: {
  item: MonthEntry
  onUpdateEntry: (id: number, patch: { clock_in?: string | null; clock_out?: string | null; note?: string | null }) => void
  onMoveDate: (id: number, newWorkDate: string) => Promise<void>
  onUpdateBreak: (id: number, patch: { break_start?: string; break_end?: string | null }) => void
  onDeleteBreak: (id: number) => void
  onDeleteEntry: (id: number) => void
}) {
  const { entry, breaks } = item
  const [note, setNote] = useState(entry.note ?? '')
  const [workDate, setWorkDate] = useState(entry.work_date)
  // 日付の付け替えは出勤・退勤・休憩を順に書き換えるので、
  // 終わるまで触れないようにする。途中でもう一度動かすと記録が割れる。
  const [moving, setMoving] = useState(false)

  const setEntryTime = (field: 'clock_in' | 'clock_out', hhmm: string) => {
    if (!hhmm) {
      onUpdateEntry(entry.id, { [field]: null })
      return
    }
    const iso = composeAt(entry.work_date, hhmm)
    if (iso) onUpdateEntry(entry.id, { [field]: iso })
  }

  // 日付を変えると、出勤・退勤・休憩の時刻もその日へ一緒に移る。
  // 別の月へ動かすとこの一覧から消えるので、そこだけ確認を挟む。
  const changeDate = async (value: string) => {
    if (!value || value === entry.work_date || moving) return
    setWorkDate(value)
    const movesMonth = value.slice(0, 7) !== entry.work_date.slice(0, 7)
    const ok = window.confirm(
      `${entry.staff_name}さんの勤務日を ${entry.work_date} から ${value} に変えます。\n` +
        '出勤・退勤・休憩の時刻も、そのままこの日へ移ります。' +
        (movesMonth ? '\n\n別の月へ移るため、この一覧からは見えなくなります。' : ''),
    )
    if (!ok) {
      setWorkDate(entry.work_date)
      return
    }
    setMoving(true)
    try {
      await onMoveDate(entry.id, value)
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="tc-editor">
      <label className="tc-edit-field">
        <span>勤務日</span>
        <input
          type="date"
          className="satisfaction-input tc-date-input"
          value={workDate}
          disabled={moving}
          onChange={(e) => void changeDate(e.target.value)}
        />
      </label>
      <div className="tc-edit-hint">
        {moving
          ? '勤務日を移しています…'
          : '日付を直すと、出勤・退勤・休憩の時刻もその日へ移ります。深夜1時の退勤は、移した先でも翌日の1時のままです。'}
      </div>

      <div className="tc-edit-row">
        <label className="tc-edit-field">
          <span>出勤</span>
          <input
            type="time"
            className="satisfaction-input tc-time-input"
            defaultValue={entry.clock_in ? timeLabel(entry.clock_in) : ''}
            onChange={(e) => setEntryTime('clock_in', e.target.value)}
          />
        </label>
        <label className="tc-edit-field">
          <span>退勤</span>
          <input
            type="time"
            className="satisfaction-input tc-time-input"
            defaultValue={entry.clock_out ? timeLabel(entry.clock_out) : ''}
            onChange={(e) => setEntryTime('clock_out', e.target.value)}
          />
        </label>
      </div>

      {breaks.length > 0 ? (
        <div className="tc-breaks">
          {breaks.map((b, i) => (
            <div key={b.id} className="tc-edit-row">
              <label className="tc-edit-field">
                <span>休憩{breaks.length > 1 ? i + 1 : ''} 開始</span>
                <input
                  type="time"
                  className="satisfaction-input tc-time-input"
                  defaultValue={timeLabel(b.break_start)}
                  onChange={(e) => {
                    const iso = composeAt(entry.work_date, e.target.value)
                    if (iso) onUpdateBreak(b.id, { break_start: iso })
                  }}
                />
              </label>
              <label className="tc-edit-field">
                <span>戻り</span>
                <input
                  type="time"
                  className="satisfaction-input tc-time-input"
                  defaultValue={b.break_end ? timeLabel(b.break_end) : ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      onUpdateBreak(b.id, { break_end: null })
                      return
                    }
                    const iso = composeAt(entry.work_date, e.target.value)
                    if (iso) onUpdateBreak(b.id, { break_end: iso })
                  }}
                />
              </label>
              <button type="button" className="del-btn" aria-label="この休憩を削除" onClick={() => onDeleteBreak(b.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <label className="tc-edit-field">
        <span>備考</span>
        <input
          type="text"
          className="satisfaction-input"
          placeholder="例) 退勤の押し忘れを修正"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onUpdateEntry(entry.id, { note: note.trim() || null })}
        />
      </label>

      <button
        type="button"
        className="visit-delete-btn"
        onClick={() => {
          if (window.confirm(`${entry.work_date} の${entry.staff_name}さんの記録を削除します。よろしいですか?`)) {
            onDeleteEntry(entry.id)
          }
        }}
      >
        この勤務記録を削除
      </button>
    </div>
  )
}

export default function TimecardAdmin() {
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const { loading, items, updateEntry, moveEntryDate, updateBreak, deleteBreak, deleteEntry } = useTimecardMonth(monthKey)
  const [openId, setOpenId] = useState<number | null>(null)

  const summary = useMemo(() => {
    const map = new Map<string, { days: Set<string>; ms: number; open: number }>()
    for (const { entry, breaks } of items) {
      const row = map.get(entry.staff_name) ?? { days: new Set<string>(), ms: 0, open: 0 }
      row.days.add(entry.work_date)
      if (entry.clock_out) row.ms += workedMs(entry, breaks)
      else row.open += 1
      map.set(entry.staff_name, row)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, days: v.days.size, ms: v.ms, open: v.open }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }, [items])

  const unclosed = items.filter((i) => !i.entry.clock_out).length

  const downloadCsv = () => {
    const blob = new Blob([buildCsv(items)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // ファイル名に日本語を入れるとブラウザが名前ごと捨てて「download」(拡張子なし)
    // になり、Excelで開けなくなる。ASCIIだけにしておく。
    a.download = `kintai-${monthKey}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 取り消しが早すぎると端末によっては保存前にデータが消えるため、少し待つ。
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <>
      <div className="category">
        <div className="category-head">
          <div className="badge">月</div>
          <div>
            <div className="category-name">月次集計</div>
            <div className="category-sub">スタッフ別の勤務日数と実労働時間</div>
          </div>
        </div>
        <div className="satisfaction-body">
          <div className="tc-month-nav">
            <button type="button" className="tc-month-btn" onClick={() => setMonthKey((m) => shiftMonth(m, -1))}>
              ◀
            </button>
            <span className="tc-month-label">{monthLabel(monthKey)}</span>
            <button type="button" className="tc-month-btn" onClick={() => setMonthKey((m) => shiftMonth(m, 1))}>
              ▶
            </button>
          </div>

          {loading ? (
            <div className="empty-hint">読み込み中…</div>
          ) : summary.length === 0 ? (
            <div className="empty-hint">この月の記録はありません。</div>
          ) : (
            <>
              <div className="tc-table-wrap">
                <table className="tc-table">
                  <thead>
                    <tr>
                      <th>スタッフ</th>
                      <th>勤務日数</th>
                      <th>実労働</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td className="tc-num">{s.days}日</td>
                        <td className="tc-num">
                          {durationLabel(s.ms)}
                          {s.open > 0 ? <span className="tc-warn-mark"> ※未退勤{s.open}件</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {unclosed > 0 ? (
                <div className="recorder-error">
                  退勤が打刻されていない記録が{unclosed}件あります。集計に含まれないので、下の一覧から修正してください。
                </div>
              ) : null}

              <button type="button" className="next-guest-btn satisfaction-submit" onClick={downloadCsv}>
                Excel用に書き出す(CSV)
              </button>
              <div className="footer-note">
                書き出したファイルはExcelでそのまま開けます。「実労働(時間)」の列は6.5のような数値なので、合計や時給の計算に使えます。
              </div>
            </>
          )}
        </div>
      </div>

      {!loading && items.length > 0 ? (
        <div className="category">
          <div className="category-head">
            <div className="badge">修</div>
            <div>
              <div className="category-name">打刻の修正</div>
              <div className="category-sub">押し忘れ・打ち間違いをここで直します</div>
            </div>
          </div>
          <div className="items">
            {items.map((item) => {
              const open = openId === item.entry.id
              const worked = workedMs(item.entry, item.breaks)
              return (
                <div key={item.entry.id} className="visit-row">
                  <div
                    className="visit-row-head"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(open ? null : item.entry.id)}
                  >
                    <span className="tc-date">{item.entry.work_date.slice(5).replace('-', '/')}</span>
                    <span className="visit-name">{item.entry.staff_name}</span>
                    <span className="tc-times">
                      {timeLabel(item.entry.clock_in)}〜{item.entry.clock_out ? timeLabel(item.entry.clock_out) : '未退勤'}
                    </span>
                    {item.entry.clock_out ? (
                      <span className="tc-worked">{durationLabel(worked)}</span>
                    ) : (
                      <span className="unrated-chip">未退勤</span>
                    )}
                    <span className={`category-chevron${open ? '' : ' collapsed'}`} aria-hidden="true">
                      ▼
                    </span>
                  </div>
                  {open ? (
                    <EntryEditor
                      item={item}
                      onUpdateEntry={updateEntry}
                      onMoveDate={moveEntryDate}
                      onUpdateBreak={updateBreak}
                      onDeleteBreak={deleteBreak}
                      onDeleteEntry={(id) => {
                        deleteEntry(id)
                        setOpenId(null)
                      }}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </>
  )
}
