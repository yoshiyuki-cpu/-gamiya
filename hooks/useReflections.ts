'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Reflection, ReflectionKind } from '@/lib/supabase'
import { recentBusinessDayKeys, todayKey } from '@/lib/checklist'
import { countRows, normalizeBody } from '@/lib/reflections'

/** 一覧に出す日数。それより前のものはDBに残るが画面には出さない。 */
export const HISTORY_DAYS = 60
/** 見出しの集計に使う日数。 */
export const SUMMARY_DAYS = 30

export type ReflectionResult = { ok: true } | { ok: false; error: string }

type DbError = { code?: string; message?: string } | null

function describeError(error: DbError): string {
  const message = error?.message ?? ''
  if (error?.code === '42P01' || /does not exist|Could not find the table/i.test(message)) {
    return 'ふりかえりの表がデータベースにまだありません。Supabaseで supabase-migration-reflections.sql を実行してください。'
  }
  if (error?.code === '42501' || /permission denied/i.test(message)) {
    return 'データベースの権限が足りません。supabase-migration-reflections.sql の grant の行を実行してください。'
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return '通信できませんでした。電波を確かめて、もう一度押してください。'
  }
  return `保存できませんでした${message ? `(${message})` : ''}。もう一度押してください。`
}

export function useReflections() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<Reflection[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)

  const applyRow = useCallback((row: Reflection) => {
    setRows((prev) => {
      if (row.hidden) return prev.filter((r) => r.id !== row.id)
      const idx = prev.findIndex((r) => r.id === row.id)
      return idx === -1 ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const since = recentBusinessDayKeys(HISTORY_DAYS)[0]
      const { data, error } = await supabase
        .from('reflections')
        .select('*')
        .eq('hidden', false)
        .gte('note_date', since)
        .order('note_date', { ascending: false })
        .order('id', { ascending: false })
      if (cancelled) return
      if (error) {
        setMissingTable(error.code === '42P01' || /does not exist|Could not find the table/i.test(error.message ?? ''))
        setLoadError(describeError(error))
      } else {
        setRows((data ?? []) as Reflection[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('reflections-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reflections' },
        (payload: RealtimePostgresChangesPayload<Reflection>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyRow(payload.new as Reflection)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<Reflection>).id
            if (oldId != null) setRows((prev) => prev.filter((r) => r.id !== oldId))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyRow])

  /** 今日(営業日)の分。 */
  const today = useMemo(() => {
    const key = todayKey()
    return rows.filter((r) => r.note_date === key).sort((a, b) => a.id - b.id)
  }, [rows])

  const counts = useMemo(() => countRows(rows, recentBusinessDayKeys(SUMMARY_DAYS)[0]), [rows])

  const add = useCallback(
    async (kind: ReflectionKind, rawBody: string, staffName: string): Promise<ReflectionResult> => {
      const body = normalizeBody(rawBody)
      if (!body) return { ok: false, error: '内容を入れてください。' }
      setSaving(true)
      try {
        const { data, error } = await supabase
          .from('reflections')
          .insert({ note_date: todayKey(), kind, body, staff_name: staffName.trim() || null })
          .select()
          .single()
        if (error) return { ok: false, error: describeError(error) }
        if (data) applyRow(data as Reflection)
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [applyRow],
  )

  const update = useCallback(
    async (id: number, patch: Partial<Reflection>): Promise<ReflectionResult> => {
      setSaving(true)
      try {
        const { data, error } = await supabase.from('reflections').update(patch).eq('id', id).select().single()
        if (error) return { ok: false, error: describeError(error) }
        if (data) applyRow(data as Reflection)
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [applyRow],
  )

  const editBody = useCallback(
    (id: number, rawBody: string) => {
      const body = normalizeBody(rawBody)
      if (!body) return Promise.resolve<ReflectionResult>({ ok: false, error: '内容を入れてください。' })
      return update(id, { body })
    },
    [update],
  )

  /** 悪かった事を「直した」にする。 */
  const resolve = useCallback(
    (id: number, by: string, note: string) =>
      update(id, {
        resolved_at: new Date().toISOString(),
        resolved_by: by.trim() || null,
        resolve_note: normalizeBody(note) || null,
      }),
    [update],
  )

  const reopen = useCallback(
    (id: number) => update(id, { resolved_at: null, resolved_by: null, resolve_note: null }),
    [update],
  )

  /** 消さずに隠す。 */
  const hide = useCallback((id: number) => update(id, { hidden: true }), [update])

  return { loading, saving, rows, today, counts, loadError, missingTable, add, editBody, resolve, reopen, hide }
}
