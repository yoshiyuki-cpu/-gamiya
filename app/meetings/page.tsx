'use client'

import { useState } from 'react'
import { useMeetings } from '@/hooks/useMeetings'
import type { Meeting } from '@/lib/supabase'
import MeetingDetail from './_components/MeetingDetail'
import MeetingList from './_components/MeetingList'
import Recorder from './_components/Recorder'

export const dynamic = 'force-dynamic'

function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MeetingsPage() {
  const { meetings, loading, createMeetingFromRecording, updateMeeting, processMeeting, deleteMeeting } = useMeetings()
  const [view, setView] = useState<'list' | 'record' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const selected = meetings.find((m) => m.id === selectedId) ?? null

  async function handleRecordingFinished(blob: Blob) {
    setUploading(true)
    setUploadError(null)
    try {
      const meeting = await createMeetingFromRecording(blob, todayDateStr())
      setSelectedId(meeting.id)
      setView('detail')
      if (meeting.audio_url) {
        void processMeeting(meeting.id, meeting.audio_url)
      }
    } catch {
      setUploadError('アップロードに失敗しました。もう一度お試しください。')
    } finally {
      setUploading(false)
    }
  }

  function openMeeting(m: Meeting) {
    setSelectedId(m.id)
    setView('detail')
  }

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
            <h1 className="title">議事録</h1>
            <div className="subtitle">会議を録音して、自動で文字起こし・要約します</div>
          </div>
          {view !== 'record' ? (
            <button type="button" className="edit-toggle" onClick={() => setView('record')}>
              新規録音
            </button>
          ) : null}
        </div>
      </div>

      {view === 'record' ? (
        <div className="category">
          <div className="category-head">
            <div className="badge">録</div>
            <div>
              <div className="category-name">新規録音</div>
              <div className="category-sub">録音を終えると自動で文字起こし・要約が始まります</div>
            </div>
          </div>
          <div className="items meeting-record-panel">
            {uploading ? <div className="meeting-processing">アップロード中…</div> : <Recorder onFinished={handleRecordingFinished} />}
            {uploadError ? <div className="recorder-error">{uploadError}</div> : null}
            <button type="button" className="meeting-cancel-btn" onClick={() => setView('list')}>
              キャンセルして一覧に戻る
            </button>
          </div>
        </div>
      ) : view === 'detail' && selected ? (
        <MeetingDetail
          meeting={selected}
          onBack={() => setView('list')}
          onUpdate={(patch) => updateMeeting(selected.id, patch)}
          onDelete={async () => {
            if (!window.confirm('この会議の記録を削除します。よろしいですか?')) return
            await deleteMeeting(selected)
            setView('list')
          }}
          onRetry={() => {
            if (selected.audio_url) void processMeeting(selected.id, selected.audio_url)
          }}
        />
      ) : (
        <MeetingList meetings={meetings} onSelect={openMeeting} />
      )}
    </div>
  )
}
