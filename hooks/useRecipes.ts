'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Recipe } from '@/lib/supabase'
import { resizeImageFile } from '@/lib/image'

const PHOTO_BUCKET = 'recipe-photos'

export type PhotoUploadResult = { url: string } | { error: string }

// Supabaseの生のエラー文は英語で原因も分かりにくいので、現場で読んで
// 次の一手が分かる日本語にして返す。
function describeUploadError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('bucket not found')) {
    return '写真の保存先(recipe-photos)がまだ用意されていません。Supabaseの Storage での作成が必要です。'
  }
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('403')) {
    return '写真の保存が許可されていません。Supabaseの Storage の権限設定を確認してください。'
  }
  if (m.includes('payload too large') || m.includes('maximum allowed size')) {
    return '写真のサイズが大きすぎて保存できませんでした。'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return '通信が不安定で保存できませんでした。電波の良い場所でもう一度お試しください。'
  }
  return `写真を保存できませんでした(${message})`
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  const applyRecipe = useCallback((row: Recipe) => {
    setRecipes((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      if (idx === -1) return [...prev, row]
      if (prev[idx].updated_at && row.updated_at < prev[idx].updated_at) return prev
      const next = prev.slice()
      next[idx] = row
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('recipes').select('*').order('sort_order')
      if (cancelled) return
      setRecipes(data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('recipes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes' },
        (payload: RealtimePostgresChangesPayload<Recipe>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyRecipe(payload.new as Recipe)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<Recipe>).id
            if (oldId != null) setRecipes((prev) => prev.filter((r) => r.id !== oldId))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyRecipe])

  const addRecipe = useCallback(
    async (category: string, name: string): Promise<Recipe | null> => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const categoryRecipes = recipes.filter((r) => r.category === category)
      const nextSortOrder = categoryRecipes.length ? Math.max(...categoryRecipes.map((r) => r.sort_order)) + 1 : 1
      const { data, error } = await supabase
        .from('recipes')
        .insert({ category, name: trimmed, sort_order: nextSortOrder })
        .select()
        .single()
      if (error || !data) return null
      applyRecipe(data as Recipe)
      return data as Recipe
    },
    [recipes, applyRecipe],
  )

  const updateRecipe = useCallback(
    async (id: number, patch: Partial<Recipe>) => {
      setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      const { data } = await supabase.from('recipes').update(patch).eq('id', id).select().single()
      if (data) applyRecipe(data as Recipe)
    },
    [applyRecipe],
  )

  const deleteRecipe = useCallback(async (id: number, name: string) => {
    const ok = window.confirm(`「${name}」のレシピを削除します。よろしいですか?`)
    if (!ok) return false
    setRecipes((prev) => prev.filter((r) => r.id !== id))
    await supabase.from('recipes').delete().eq('id', id)
    return true
  }, [])

  const uploadPhoto = useCallback(async (recipeId: number, file: File): Promise<PhotoUploadResult> => {
    let upload: File
    try {
      upload = await resizeImageFile(file)
    } catch {
      upload = file
    }
    const ext = extensionFor(upload.type)
    const path = `recipes/${recipeId}/${Date.now()}.${ext}`
    try {
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, upload, { upsert: false, contentType: upload.type || 'image/jpeg' })
      if (error) {
        console.error('recipe photo upload failed', error)
        return { error: describeUploadError(error.message) }
      }
      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
      return { url: data.publicUrl }
    } catch (err) {
      console.error('recipe photo upload threw', err)
      return { error: describeUploadError(err instanceof Error ? err.message : String(err)) }
    }
  }, [])

  return { recipes, loading, addRecipe, updateRecipe, deleteRecipe, uploadPhoto }
}
