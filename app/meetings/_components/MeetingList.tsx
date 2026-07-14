import type { Meeting } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = {
  recorded: '処理待ち',
  transcribing: '文字起こし中…',
  transcribed: '要約待ち',
  summarizing: '要約中…',
  done: '完了',
  error: 'エラー',
}

export default function MeetingList({
  meetings,
  onSelect,
}: {
  meetings: Meeting[]
  onSelect: (meeting: Meeting) => void
}) {
  if (meetings.length === 0) {
    return <div className="empty-hint">まだ会議の記録がありません。「新規録音」から始めてください。</div>
  }

  return (
    <div className="meeting-list">
      {meetings.map((m) => (
        <button key={m.id} type="button" className="meeting-list-item" onClick={() => onSelect(m)}>
          <div className="meeting-list-top">
            <span className="meeting-list-date">{m.meeting_date}</span>
            <span className={`meeting-status-badge meeting-status-${m.status}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
          </div>
          <div className="meeting-list-title">{m.title || '(タイトル未設定)'}</div>
          {m.summary_overview ? <div className="meeting-list-preview">{m.summary_overview}</div> : null}
        </button>
      ))}
    </div>
  )
}
