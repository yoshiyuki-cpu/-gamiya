'use client'

import { useState } from 'react'
import { useReportChecks } from '@/hooks/useReportChecks'

function dateLabel(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}

export default function ReportCheckCard() {
  const { loading, saving, todayCheck, streak, monthCount, pendingNotes, markDone, undo } = useReportChecks()
  const [staffName, setStaffName] = useState('')
  const [note, setNote] = useState('')
  const [hasNote, setHasNote] = useState<boolean | null>(null)

  if (loading) return null

  const done = !!todayCheck
  // 「ある」を選んだのに内容が空のままだと、何を報告するのか残らない。
  const canSave = hasNote === false || (hasNote === true && note.trim() !== '')

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">報</div>
        <div>
          <div className="category-name">前日分の報告業務</div>
          <div className="category-sub">出勤したら最初に ・ 今月{monthCount}日実施</div>
        </div>
        <span className={`x-status${done ? ' done' : ''}`}>{done ? '完了' : '未対応'}</span>
      </div>

      <div className="satisfaction-body">
        <div className="coal-strip" aria-label={`直近${streak.length}日の実施状況`}>
          {streak.map((d) => (
            <span key={d.key} className={`coal${d.done ? ' lit' : ''}`} title={d.key} />
          ))}
        </div>

        {done ? (
          <>
            <div className="x-posted-note">
              本日は対応済みです{todayCheck?.staff_name ? `(${todayCheck.staff_name})` : ''}。15時のLINEリマインドは飛びません。
            </div>
            <div className="history-text">
              社長への報告: {todayCheck?.president_note ? todayCheck.president_note : '特になし'}
            </div>
            <button className="visit-delete-btn" type="button" disabled={saving} onClick={() => void undo()}>
              取り消す(まだ対応していない)
            </button>
          </>
        ) : (
          <>
            <div className="report-q">Q1. 報告業務はやりましたか?</div>
            <label className="satisfaction-label" htmlFor="reportStaff">
              対応した人(任意)
            </label>
            <input
              id="reportStaff"
              className="satisfaction-input x-staff-input"
              placeholder="例) 山田"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />

            <div className="report-q">Q2. 社長に報告することがありますか?</div>
            <div className="report-choice">
              <button
                type="button"
                className={`report-choice-btn${hasNote === false ? ' active' : ''}`}
                onClick={() => {
                  setHasNote(false)
                  setNote('')
                }}
              >
                特になし
              </button>
              <button
                type="button"
                className={`report-choice-btn${hasNote === true ? ' active' : ''}`}
                onClick={() => setHasNote(true)}
              >
                ある
              </button>
            </div>
            {hasNote === true ? (
              <textarea
                className="satisfaction-input"
                placeholder="例) 冷蔵庫の調子が悪い / 常連のお客様からご意見をいただいた"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            ) : null}

            <button
              className="next-guest-btn satisfaction-submit"
              type="button"
              disabled={saving || !canSave}
              onClick={() => void markDone(staffName, note)}
            >
              {saving ? '保存中…' : hasNote === null ? 'Q2に答えてください' : '報告業務を完了にする'}
            </button>
          </>
        )}

        {pendingNotes.length > 0 ? (
          <div className="report-notes">
            <div className="satisfaction-label">社長への報告(直近)</div>
            {pendingNotes.map((c) => (
              <div key={c.id} className="report-note-row">
                <span className="report-note-date">{dateLabel(c.check_date)}</span>
                <span className="history-text">{c.president_note}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
