'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PostCheck } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'

export type PostCheckResult = { ok: true } | { ok: false; error: string }

type DbError = { code?: string; message?: string } | null

function isMissingTable(error: DbError): boolean {
  return error?.code === '42P01' || /does not exist|Could not find the table/i.test(error?.message ?? '')
}

function describeError(error: DbError): string {
  const message = error?.message ?? ''
  if (isMissingTable(error)) {
    return 'ポスト確認の表がデータベースにまだありません。Supabaseで supabase-migration-post-check.sql を実行してください。'
  }
  if (error?.code === '42501' || /permission denied/i.test(message)) {
    return 'データベースの権限が足りません。supabase-migration-post-check.sql の grant の行を実行してください。'
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return '通信できませんでした。電波を確かめて、もう一度押してください。'
  }
  return `保存できませんでした${message ? `(${message})` : ''}。もう一度押してください。`
}

/**
 * 「ポストの確認をしました」の今日ぶんだけを見る。
 * 店長・赤木のどちらか1人が押せば、その日はもう出ない(共有の確認)。
 * 表がまだ無い(SQL未実行)ときは、出勤を止めないよう missingTable を立てる。
 */
export function usePostCheck() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [todayCheck, setTodayCheck] = useState<PostCheck | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const today = todayKey()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('post_checks').select('*').eq('check_date', today).maybeSingle()
      if (cancelled) return
      if (error) {
        setMissingTable(isMissingTable(error))
        setLoadError(describeError(error))
      } else {
        setTodayCheck((data as PostCheck) ?? null)
        setMissingTable(false)
        setLoadError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [today])

  useEffect(() => {
    const channel = supabase
      .channel('post-check-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_checks' },
        (payload: RealtimePostgresChangesPayload<PostCheck>) => {
          if (payload.eventType === 'DELETE') {
            const row = payload.old as Partial<PostCheck>
            if (row.check_date === today) setTodayCheck(null)
          } else {
            const row = payload.new as PostCheck
            if (row.check_date === today) setTodayCheck(row)
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [today])

  const confirm = useCallback(
    async (staffName: string): Promise<PostCheckResult> => {
      setSaving(true)
      try {
        const { data, error } = await supabase
          .from('post_checks')
          .upsert({ check_date: today, staff_name: staffName.trim() || null }, { onConflict: 'check_date' })
          .select()
          .single()
        if (error) return { ok: false, error: describeError(error) }
        if (data) setTodayCheck(data as PostCheck)
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [today],
  )

  // 通信の不具合などで確認できなかったときも出勤自体は止めない(fail open)。
  const done = !!todayCheck || missingTable || !!loadError

  return { loading, saving, todayCheck, done, missingTable, loadError, confirm }
}
