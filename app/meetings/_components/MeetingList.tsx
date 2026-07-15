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
  emptyHint = 'まだ記録がありません。録音するかメモを書いて始めてください。',
}: {
  meetings: Meeting[]
  onSelect: (meeting: Meeting) => void
  emptyHint?: string
}) {
  if (meetings.length === 0) {
    return <div className="empty-hint">{emptyHint}</div>
  }

  return (
    <div className="meeting-list">
      {meetings.map((m) => (
        <button key={m.id} type="button" className="meeting-list-item" onClick={() => onSelect(m)}>
          <div className="meeting-list-top">
            <span className="meeting-list-date">{m.meeting_date}</span>
            {m.audio_url ? (
              <span className={`meeting-status-badge meeting-status-${m.status}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
            ) : (
              <span className="meeting-memo-badge">メモ</span>
            )}
          </div>
          <div className="meeting-list-title">{m.title || '(タイトル未設定)'}</div>
          {m.summary_overview ? (
            <div className="meeting-list-preview">{m.summary_overview}</div>
          ) : m.memo ? (
            <div className="meeting-list-preview">{m.memo}</div>
          ) : null}
        </button>
      ))}
    </div>
  )
}
