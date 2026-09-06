'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Ingredient, MenuIngredient, MenuItem } from '@/lib/supabase'
import { costsOfAll } from '@/lib/costs'

export type CostResult = { ok: true } | { ok: false; error: string }

type DbError = { code?: string; message?: string } | null

function isMissingTable(error: DbError): boolean {
  return error?.code === '42P01' || /does not exist|Could not find the table/i.test(error?.message ?? '')
}

function describeError(error: DbError): string {
  const message = error?.message ?? ''
  if (isMissingTable(error)) {
    return '原価の表がデータベースにまだありません。Supabaseで supabase-migration-costs.sql を実行してください。'
  }
  if (error?.code === '42501' || /permission denied/i.test(message)) {
    return 'データベースの権限が足りません。supabase-migration-costs.sql の grant の行を実行してください。'
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return '通信できませんでした。電波を確かめて、もう一度押してください。'
  }
  return `保存できませんでした${message ? `(${message})` : ''}。もう一度押してください。`
}

function upsertInto<T extends { id: number }>(list: T[], row: T): T[] {
  const idx = list.findIndex((r) => r.id === row.id)
  return idx === -1 ? [...list, row] : list.map((r) => (r.id === row.id ? row : r))
}

export function useCosts() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [lines, setLines] = useState<MenuIngredient[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [ing, men, lin] = await Promise.all([
        supabase.from('ingredients').select('*').order('name'),
        supabase.from('menu_items').select('*').order('sort_order').order('id'),
        supabase.from('menu_ingredients').select('*').order('id'),
      ])
      if (cancelled) return
      const err = ing.error ?? men.error ?? lin.error
      if (err) {
        setMissingTable(isMissingTable(err))
        setLoadError(describeError(err))
      } else {
        setIngredients((ing.data ?? []) as Ingredient[])
        setMenus((men.data ?? []) as MenuItem[])
        setLines((lin.data ?? []) as MenuIngredient[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('costs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, (p: RealtimePostgresChangesPayload<Ingredient>) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as Partial<Ingredient>).id
          if (id != null) setIngredients((prev) => prev.filter((r) => r.id !== id))
        } else setIngredients((prev) => upsertInto(prev, p.new as Ingredient))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (p: RealtimePostgresChangesPayload<MenuItem>) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as Partial<MenuItem>).id
          if (id != null) setMenus((prev) => prev.filter((r) => r.id !== id))
        } else setMenus((prev) => upsertInto(prev, p.new as MenuItem))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_ingredients' }, (p: RealtimePostgresChangesPayload<MenuIngredient>) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as Partial<MenuIngredient>).id
          if (id != null) setLines((prev) => prev.filter((r) => r.id !== id))
        } else setLines((prev) => upsertInto(prev, p.new as MenuIngredient))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const costs = useMemo(() => costsOfAll(menus, lines, ingredients), [menus, lines, ingredients])
  const ingredientById = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])

  const run = useCallback(async <T,>(op: () => PromiseLike<{ data: T | null; error: DbError }>, apply: (row: T) => void): Promise<CostResult> => {
    setSaving(true)
    try {
      const { data, error } = await op()
      if (error) return { ok: false, error: describeError(error) }
      if (data) apply(data)
      return { ok: true }
    } finally {
      setSaving(false)
    }
  }, [])

  const addIngredient = useCallback(
    (input: Pick<Ingredient, 'name' | 'unit' | 'pack_qty' | 'pack_price'>) =>
      run<Ingredient>(
        () => supabase.from('ingredients').insert(input).select().single(),
        (row) => setIngredients((prev) => upsertInto(prev, row)),
      ),
    [run],
  )

  const updateIngredient = useCallback(
    (id: number, patch: Partial<Ingredient>) =>
      run<Ingredient>(
        () => supabase.from('ingredients').update(patch).eq('id', id).select().single(),
        (row) => setIngredients((prev) => upsertInto(prev, row)),
      ),
    [run],
  )

  const addMenu = useCallback(
    (input: Pick<MenuItem, 'name' | 'category' | 'price' | 'target_rate'>) =>
      run<MenuItem>(
        () => supabase.from('menu_items').insert(input).select().single(),
        (row) => setMenus((prev) => upsertInto(prev, row)),
      ),
    [run],
  )

  const updateMenu = useCallback(
    (id: number, patch: Partial<MenuItem>) =>
      run<MenuItem>(
        () => supabase.from('menu_items').update(patch).eq('id', id).select().single(),
        (row) => setMenus((prev) => upsertInto(prev, row)),
      ),
    [run],
  )

  /** 試算からメニューを登録する。メニューを作ってから材料の行をまとめて入れる。 */
  const addMenuWithLines = useCallback(
    async (name: string, price: number | null, input: { ingredientId: number; qty: number }[]): Promise<CostResult> => {
      setSaving(true)
      try {
        const { data: menu, error } = await supabase
          .from('menu_items')
          .insert({ name, category: 'meat', price, target_rate: null })
          .select()
          .single()
        if (error || !menu) return { ok: false, error: describeError(error) }
        setMenus((prev) => upsertInto(prev, menu as MenuItem))
        const { data: rows, error: lineError } = await supabase
          .from('menu_ingredients')
          .insert(input.map((l) => ({ menu_item_id: (menu as MenuItem).id, ingredient_id: l.ingredientId, qty: l.qty })))
          .select()
        if (lineError) return { ok: false, error: `メニューは作りましたが材料を保存できませんでした(${lineError.message})。「メニュー」タブで足してください。` }
        setLines((prev) => (rows ?? []).reduce((acc, r) => upsertInto(acc, r as MenuIngredient), prev))
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  /** 材料の行を足す。同じ材料がもうあれば量を書き換える。 */
  const setLine = useCallback(
    (menuItemId: number, ingredientId: number, qty: number) => {
      const existing = lines.find((l) => l.menu_item_id === menuItemId && l.ingredient_id === ingredientId)
      return run<MenuIngredient>(
        () =>
          existing
            ? supabase.from('menu_ingredients').update({ qty }).eq('id', existing.id).select().single()
            : supabase.from('menu_ingredients').insert({ menu_item_id: menuItemId, ingredient_id: ingredientId, qty }).select().single(),
        (row) => setLines((prev) => upsertInto(prev, row)),
      )
    },
    [lines, run],
  )

  const removeLine = useCallback(async (lineId: number): Promise<CostResult> => {
    setSaving(true)
    try {
      const { error } = await supabase.from('menu_ingredients').delete().eq('id', lineId)
      if (error) return { ok: false, error: describeError(error) }
      setLines((prev) => prev.filter((l) => l.id !== lineId))
      return { ok: true }
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    loading,
    saving,
    ingredients,
    menus,
    lines,
    costs,
    ingredientById,
    loadError,
    missingTable,
    addIngredient,
    updateIngredient,
    addMenu,
    addMenuWithLines,
    updateMenu,
    setLine,
    removeLine,
  }
}
