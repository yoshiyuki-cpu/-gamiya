'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Recipe } from '@/lib/supabase'

const PHOTO_BUCKET = 'recipe-photos'

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

  const uploadPhoto = useCallback(async (recipeId: number, file: File): Promise<string | null> => {
    const ext = extensionFor(file.type)
    const path = `recipes/${recipeId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
    if (error) return null
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }, [])

  return { recipes, loading, addRecipe, updateRecipe, deleteRecipe, uploadPhoto }
}
