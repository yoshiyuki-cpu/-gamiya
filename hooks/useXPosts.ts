'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { XPost } from '@/lib/supabase'
import { recentBusinessDayKeys, todayKey } from '@/lib/checklist'

// ドットで振り返る日数と、読み込む履歴の日数。
export const STREAK_DAYS = 14
const HISTORY_DAYS = 62

export function useXPosts() {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<XPost[]>([])
  const [saving, setSaving] = useState(false)

  const applyPost = useCallback((row: XPost) => {
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((p) => (p.id === row.id ? row : p))
      return next.slice().sort((a, b) => (a.post_date < b.post_date ? 1 : a.post_date > b.post_date ? -1 : 0))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const since = recentBusinessDayKeys(HISTORY_DAYS)[0]
      const { data } = await supabase.from('x_posts').select('*').gte('post_date', since).order('post_date', { ascending: false })
      if (cancelled) return
      setPosts((data ?? []) as XPost[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('x-posts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'x_posts' },
        (payload: RealtimePostgresChangesPayload<XPost>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyPost(payload.new as XPost)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<XPost>).id
            if (oldId != null) setPosts((prev) => prev.filter((p) => p.id !== oldId))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyPost])

  const postedDates = useMemo(() => new Set(posts.map((p) => p.post_date)), [posts])
  const today = todayKey()
  const todayPost = posts.find((p) => p.post_date === today) ?? null

  const streak = useMemo(
    () => recentBusinessDayKeys(STREAK_DAYS).map((key) => ({ key, posted: postedDates.has(key) })),
    [postedDates],
  )

  // 「今月」は暦月。月次の目標を振り返るときの単位に合わせている。
  const monthCount = useMemo(() => {
    const prefix = today.slice(0, 7)
    return posts.filter((p) => p.post_date.startsWith(prefix)).length
  }, [posts, today])

  const markPosted = useCallback(
    async (staffName: string, memo: string) => {
      setSaving(true)
      try {
        const row = {
          post_date: today,
          posted_at: new Date().toISOString(),
          staff_name: staffName.trim() || null,
          memo: memo.trim() || null,
        }
        const { data } = await supabase.from('x_posts').upsert(row, { onConflict: 'post_date' }).select().single()
        if (data) applyPost(data as XPost)
      } finally {
        setSaving(false)
      }
    },
    [today, applyPost],
  )

  const unmarkPosted = useCallback(async () => {
    setSaving(true)
    try {
      setPosts((prev) => prev.filter((p) => p.post_date !== today))
      await supabase.from('x_posts').delete().eq('post_date', today)
    } finally {
      setSaving(false)
    }
  }, [today])

  return { loading, saving, todayPost, streak, monthCount, markPosted, unmarkPosted }
}
