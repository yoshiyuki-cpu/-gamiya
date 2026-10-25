'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { DailyReport } from '@/lib/supabase'

export function useDailyReports() {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const applyReport = useCallback((row: DailyReport) => {
    setReports((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r))
      return next.slice().sort((a, b) => (a.report_date < b.report_date ? 1 : a.report_date > b.report_date ? -1 : 0))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('daily_reports').select('*').order('report_date', { ascending: false })
      if (cancelled) return
      setReports(data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('daily-reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reports' },
        (payload: RealtimePostgresChangesPayload<DailyReport>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyReport(payload.new as DailyReport)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<DailyReport>).id
            if (oldId != null) setReports((prev) => prev.filter((r) => r.id !== oldId))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyReport])

  const generateTodayReport = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/generate-daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '日報の作成に失敗しました')
      const { mail, ...report } = json as DailyReport & { mail?: { status: string; to?: string[] } }
      applyReport(report as DailyReport)
      if (mail?.status === 'sent') {
        setNotice(`日報をつくりました。全員の良かった事・悪かった事を ${(mail.to ?? []).join('、')} にメールしました。`)
      } else if (mail?.status === 'failed') {
        setNotice('日報はつくりましたが、良かった事・悪かった事のメールを送れませんでした。')
      } else if (mail?.status === 'not_configured') {
        setNotice('日報はつくりました。メールの設定がまだのため、良かった事・悪かった事のメールは送っていません。')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '日報の作成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }, [applyReport])

  return { reports, loading, generating, error, notice, generateTodayReport }
}
