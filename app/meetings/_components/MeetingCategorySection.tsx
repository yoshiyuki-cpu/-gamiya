'use client'

import { useState } from 'react'
import type { Meeting } from '@/lib/supabase'
import MeetingList from './MeetingList'

type Props = {
  badge: string
  name: string
  sub: string
  meetings: Meeting[]
  onSelect: (meeting: Meeting) => void
  onStartRecording: () => void
  onAddMemo: () => void
}

export default function MeetingCategorySection({ badge, name, sub, meetings, onSelect, onStartRecording, onAddMemo }: Props) {
  const [expanded, setExpanded] = useState(true)
  const sorted = [...meetings].sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : a.meeting_date > b.meeting_date ? -1 : b.id - a.id))

  return (
    <div className="category">
      <div className="category-head" onClick={() => setExpanded((v) => !v)} role="button" tabIndex={0}>
        <div className="badge">{badge}</div>
        <div>
          <div className="category-name">{name}</div>
          <div className="category-sub">{sub}</div>
        </div>
        <span className={`category-chevron${expanded ? '' : ' collapsed'}`} aria-hidden="true">
          ▼
        </span>
      </div>
      <div className={`items${expanded ? '' : ' collapsed'}`}>
        <div className="meeting-category-actions">
          <button type="button" className="meeting-action-btn" onClick={onStartRecording}>
            ● 録音する
          </button>
          <button type="button" className="meeting-action-btn" onClick={onAddMemo}>
            ✎ メモを書く
          </button>
        </div>
        <MeetingList meetings={sorted} onSelect={onSelect} />
      </div>
    </div>
  )
}
