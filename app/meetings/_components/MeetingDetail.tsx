'use client'

import { useState } from 'react'
import type { Meeting } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = {
  recorded: 'アップロード済み・処理待ち',
  transcribing: '文字起こし中…',
  transcribed: '文字起こし完了・要約待ち',
  summarizing: '要約中…',
  done: '完了',
  error: 'エラーが発生しました',
}

export default function MeetingDetail({
  meeting,
  onBack,
  onUpdate,
  onDelete,
  onRetry,
}: {
  meeting: Meeting
  onBack: () => void
  onUpdate: (patch: Partial<Meeting>) => void
  onDelete: () => void
  onRetry: () => void
}) {
  const [title, setTitle] = useState(meeting.title ?? '')
  const [transcript, setTranscript] = useState(meeting.transcript ?? '')
  const [overview, setOverview] = useState(meeting.summary_overview ?? '')
  const [decisions, setDecisions] = useState(meeting.summary_decisions ?? '')
  const [actionItems, setActionItems] = useState(meeting.summary_action_items ?? '')

  const processing = meeting.status === 'transcribing' || meeting.status === 'summarizing'

  return (
    <div className="meeting-detail">
      <button type="button" className="meeting-back-btn" onClick={onBack}>
        ← 一覧に戻る
      </button>

      <div className={`meeting-status-badge meeting-status-${meeting.status}`}>{STATUS_LABEL[meeting.status] ?? meeting.status}</div>
      {meeting.status === 'error' && meeting.error_message ? <div className="recorder-error">{meeting.error_message}</div> : null}
      {meeting.status === 'error' ? (
        <button type="button" className="meeting-retry-btn" onClick={onRetry}>
          やり直す
        </button>
      ) : null}

      <label className="meeting-field-label">タイトル</label>
      <input
        className="meeting-title-input"
        value={title}
        placeholder="(タイトル未設定)"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => onUpdate({ title: title.trim() || null })}
      />

      {meeting.audio_url ? <audio className="meeting-audio-player" controls src={meeting.audio_url} /> : null}

      {processing ? <div className="meeting-processing">処理中です。しばらくお待ちください…</div> : null}

      {meeting.status === 'done' ? (
        <>
          <label className="meeting-field-label">概要</label>
          <textarea
            className="meeting-textarea"
            rows={4}
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            onBlur={() => onUpdate({ summary_overview: overview || null })}
          />
          <label className="meeting-field-label">決定事項</label>
          <textarea
            className="meeting-textarea"
            rows={3}
            value={decisions}
            onChange={(e) => setDecisions(e.target.value)}
            onBlur={() => onUpdate({ summary_decisions: decisions || null })}
          />
          <label className="meeting-field-label">アクションアイテム</label>
          <textarea
            className="meeting-textarea"
            rows={3}
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
            onBlur={() => onUpdate({ summary_action_items: actionItems || null })}
          />
        </>
      ) : null}

      {meeting.transcript ? (
        <details className="meeting-transcript-details">
          <summary>文字起こし全文を表示</summary>
          <textarea
            className="meeting-textarea"
            rows={10}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onBlur={() => onUpdate({ transcript })}
          />
        </details>
      ) : null}

      <button type="button" className="meeting-delete-btn" onClick={onDelete}>
        この記録を削除
      </button>
    </div>
  )
}
