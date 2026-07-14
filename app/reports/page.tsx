'use client'

import { useDailyReports } from '@/hooks/useDailyReports'

export const dynamic = 'force-dynamic'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
}

export default function ReportsPage() {
  const { reports, loading, generating, error, generateTodayReport } = useDailyReports()

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">日報</h1>
            <div className="subtitle">その日の業務をAIが自動でまとめます</div>
          </div>
          <button className="edit-toggle" type="button" disabled={generating} onClick={() => void generateTodayReport()}>
            {generating ? '作成中…' : '本日のまとめを作成'}
          </button>
        </div>
      </div>

      {error ? <div className="recorder-error">{error}</div> : null}

      <div className="meeting-list">
        {reports.length === 0 ? (
          <div className="empty-hint">まだ日報がありません。「本日のまとめを作成」から作成してください。</div>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="report-card">
              <div className="report-date">{formatDate(r.report_date)}</div>
              {r.stats ? (
                <div className="report-stats">
                  <span className="staff-badge">チェック {r.stats.checklistDone}/{r.stats.checklistTotal}</span>
                  <span className="staff-badge">
                    注文 {r.stats.ordersCompleted}/{r.stats.ordersTotal}
                  </span>
                </div>
              ) : null}
              <div className="report-summary">{r.summary}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
