'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Meeting } from '@/lib/supabase'

const AUDIO_BUCKET = 'meeting-audio'

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  const applyMeeting = useCallback((row: Meeting) => {
    setMeetings((prev) => {
      const idx = prev.findIndex((m) => m.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((m) => (m.id === row.id ? row : m))
      return next.sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : a.meeting_date > b.meeting_date ? -1 : b.id - a.id))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('meetings').select('*').order('meeting_date', { ascending: false }).order('id', { ascending: false })
      if (cancelled) return
      setMeetings(data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('meetings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload: RealtimePostgresChangesPayload<Meeting>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyMeeting(payload.new as Meeting)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<Meeting>).id
            if (oldId != null) {
              setMeetings((prev) => prev.filter((m) => m.id !== oldId))
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyMeeting])

  const createMeetingFromRecording = useCallback(async (audioBlob: Blob, meetingDate: string): Promise<Meeting> => {
    const ext = extensionFor(audioBlob.type)
    const path = `meetings/${meetingDate}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, audioBlob, { upsert: false, contentType: audioBlob.type || 'audio/webm' })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)

    const { data, error } = await supabase
      .from('meetings')
      .insert({ meeting_date: meetingDate, audio_url: urlData.publicUrl, status: 'recorded' })
      .select()
      .single()
    if (error) throw error

    applyMeeting(data as Meeting)
    return data as Meeting
  }, [applyMeeting])

  const updateMeeting = useCallback(
    async (meetingId: number, patch: Partial<Meeting>) => {
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? { ...m, ...patch } : m)))
      const { data, error } = await supabase.from('meetings').update(patch).eq('id', meetingId).select().single()
      if (!error && data) applyMeeting(data as Meeting)
    },
    [applyMeeting],
  )

  const runTranscription = useCallback(
    async (meetingId: number, audioUrl: string) => {
      await updateMeeting(meetingId, { status: 'transcribing', error_message: null })
      try {
        const res = await fetch('/api/transcribe-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || '文字起こしに失敗しました')
        await updateMeeting(meetingId, { transcript: json.transcript, status: 'transcribed' })
        return json.transcript as string
      } catch (err) {
        await updateMeeting(meetingId, { status: 'error', error_message: err instanceof Error ? err.message : '文字起こしに失敗しました' })
        return null
      }
    },
    [updateMeeting],
  )

  const runSummarization = useCallback(
    async (meetingId: number, transcript: string) => {
      await updateMeeting(meetingId, { status: 'summarizing', error_message: null })
      try {
        const res = await fetch('/api/summarize-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error('要約に失敗しました')
        await updateMeeting(meetingId, {
          summary_overview: json.overview ?? null,
          summary_decisions: json.decisions ?? null,
          summary_action_items: json.action_items ?? null,
          status: 'done',
        })
      } catch (err) {
        await updateMeeting(meetingId, { status: 'error', error_message: err instanceof Error ? err.message : '要約に失敗しました' })
      }
    },
    [updateMeeting],
  )

  const processMeeting = useCallback(
    async (meetingId: number, audioUrl: string) => {
      const transcript = await runTranscription(meetingId, audioUrl)
      if (transcript) await runSummarization(meetingId, transcript)
    },
    [runTranscription, runSummarization],
  )

  const deleteMeeting = useCallback(async (meeting: Meeting) => {
    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id))
    if (meeting.audio_url) {
      const marker = `/${AUDIO_BUCKET}/`
      const idx = meeting.audio_url.indexOf(marker)
      if (idx !== -1) {
        const path = meeting.audio_url.slice(idx + marker.length)
        await supabase.storage.from(AUDIO_BUCKET).remove([path])
      }
    }
    await supabase.from('meetings').delete().eq('id', meeting.id)
  }, [])

  return {
    meetings,
    loading,
    createMeetingFromRecording,
    updateMeeting,
    runTranscription,
    runSummarization,
    processMeeting,
    deleteMeeting,
  }
}
