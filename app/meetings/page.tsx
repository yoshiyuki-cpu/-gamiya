'use client'

import { useState } from 'react'
import { useMeetings } from '@/hooks/useMeetings'
import { todayKey as todayDateStr } from '@/lib/checklist'
import { MEETING_CATEGORIES } from '@/lib/meetings'
import type { Meeting } from '@/lib/supabase'
import MeetingCategorySection from './_components/MeetingCategorySection'
import MeetingDetail from './_components/MeetingDetail'
import Recorder from './_components/Recorder'

export const dynamic = 'force-dynamic'

export default function MeetingsPage() {
  const { meetings, loading, createMeetingFromRecording, createMemoEntry, updateMeeting, processMeeting, deleteMeeting } = useMeetings()
  const [view, setView] = useState<'list' | 'record' | 'detail'>('list')
  const [recordingCategory, setRecordingCategory] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const selected = meetings.find((m) => m.id === selectedId) ?? null
  const recordingCategoryName = MEETING_CATEGORIES.find((c) => c.id === recordingCategory)?.name ?? ''

  async function handleRecordingFinished(blob: Blob) {
    if (!recordingCategory) return
    setUploading(true)
    setUploadError(null)
    try {
      const meeting = await createMeetingFromRecording(blob, todayDateStr(), recordingCategory)
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

  async function handleAddMemo(category: string) {
    const meeting = await createMemoEntry(category, todayDateStr())
    if (meeting) {
      setSelectedId(meeting.id)
      setView('detail')
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
            <div className="subtitle">朝礼・会議・日々の振り返りを記録します</div>
          </div>
        </div>
      </div>

      {view === 'record' ? (
        <div className="category">
          <div className="category-head">
            <div className="badge">録</div>
            <div>
              <div className="category-name">{recordingCategoryName}を録音</div>
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
            if (!window.confirm('この記録を削除します。よろしいですか?')) return
            await deleteMeeting(selected)
            setView('list')
          }}
          onRetry={() => {
            if (selected.audio_url) void processMeeting(selected.id, selected.audio_url)
          }}
        />
      ) : (
        MEETING_CATEGORIES.map((cat) => (
          <MeetingCategorySection
            key={cat.id}
            badge={cat.badge}
            name={cat.name}
            sub={cat.sub}
            meetings={meetings.filter((m) => m.category === cat.id)}
            onSelect={openMeeting}
            onStartRecording={() => {
              setRecordingCategory(cat.id)
              setView('record')
            }}
            onAddMemo={() => void handleAddMemo(cat.id)}
          />
        ))
      )}
    </div>
  )
}
