'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyRecord, Item, StockOrder, StockRule, Supplier } from '@/lib/supabase'
import { todayKey } from '@/lib/checklist'
import { parseQuantity, pendingAlerts, type StockAlert } from '@/lib/stock'

export type StockResult = { ok: true } | { ok: false; error: string }

type DbError = { message?: string; code?: string } | null

function describeError(error: DbError): string {
  const message = error?.message ?? ''
  if (error?.code === '42P01' || /does not exist|Could not find the table/i.test(message)) {
    return '在庫の表がデータベースにまだありません。Supabaseで supabase-migration-stock.sql を実行してください。'
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return '通信できませんでした。電波を確かめて、もう一度押してください。'
  }
  return `保存できませんでした${message ? `(${message})` : ''}。もう一度押してください。`
}

/** 発注が必要な品目に、表示用の名前や発注先を足したもの。 */
export type StockAlertRow = StockAlert & {
  itemName: string
  supplier: Supplier | null
}

/**
 * 在庫と発注。
 * 在庫の数は開店前チェックの数量入力(今日の daily_records)から取る。
 * 今日まだ数えていない品目は、直近に数えた日の値を使う。
 */
export function useStock() {
  const [loading, setLoading] = useState(true)
  const [missingTable, setMissingTable] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rules, setRules] = useState<StockRule[]>([])
  const [orders, setOrders] = useState<StockOrder[]>([])
  const [quantities, setQuantities] = useState<Record<number, number | null>>({})
  const [countedOn, setCountedOn] = useState<Record<number, string>>({})

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [itemRes, supRes, ruleRes, orderRes] = await Promise.all([
      supabase.from('items').select('*').eq('has_quantity', true).order('sort_order'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('stock_rules').select('*'),
      supabase.from('stock_orders').select('*').gte('ordered_at', since).order('ordered_at', { ascending: false }),
    ])
    // 表がまだ無い(SQL未実行)ときは、その旨を画面に出して止まらないようにする。
    if (ruleRes.error && /does not exist|Could not find/i.test(ruleRes.error.message)) {
      setMissingTable(true)
      setItems((itemRes.data ?? []) as Item[])
      return
    }
    setMissingTable(false)
    const itemList = (itemRes.data ?? []) as Item[]
    setItems(itemList)
    setSuppliers((supRes.data ?? []) as Supplier[])
    setRules((ruleRes.data ?? []) as StockRule[])
    setOrders((orderRes.data ?? []) as StockOrder[])

    // 数量は「今日」を優先し、無ければ直近14日で最後に数えた日の値。
    if (itemList.length > 0) {
      const from = new Date()
      from.setDate(from.getDate() - 14)
      const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
      const { data } = await supabase
        .from('daily_records')
        .select('item_id, record_date, quantity_value')
        .in('item_id', itemList.map((i) => i.id))
        .gte('record_date', fromKey)
        .order('record_date', { ascending: false })
      const q: Record<number, number | null> = {}
      const d: Record<number, string> = {}
      for (const row of (data ?? []) as Pick<DailyRecord, 'item_id' | 'record_date' | 'quantity_value'>[]) {
        if (row.item_id in q) continue // 新しい日が先に来るので、最初の1件だけ
        const n = parseQuantity(row.quantity_value)
        if (n === null) continue
        q[row.item_id] = n
        d[row.item_id] = row.record_date
      }
      setQuantities(q)
      setCountedOn(d)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  // 数を入れた端末とは別の端末で発注画面を見ていることがあるので、変更を拾う。
  useEffect(() => {
    const channel = supabase
      .channel('stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_records' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_rules' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_orders' }, () => void reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])

  const alerts: StockAlertRow[] = useMemo(
    () =>
      pendingAlerts(rules, quantities, orders).map((a) => ({
        ...a,
        itemName: itemById.get(a.item_id)?.text ?? `品目#${a.item_id}`,
        supplier: a.rule.supplier_id != null ? (supplierById.get(a.rule.supplier_id) ?? null) : null,
      })),
    [rules, quantities, orders, itemById, supplierById],
  )

  const today = todayKey()

  const saveSupplier = useCallback(
    async (patch: Partial<Supplier> & { name: string }, id?: number): Promise<StockResult> => {
      const query = id
        ? supabase.from('suppliers').update(patch).eq('id', id)
        : supabase.from('suppliers').insert({ ...patch, active: true })
      const { error } = await query
      if (error) return { ok: false, error: describeError(error) }
      await reload()
      return { ok: true }
    },
    [reload],
  )

  const saveRule = useCallback(
    async (rule: Omit<StockRule, 'id' | 'created_at' | 'updated_at'>): Promise<StockResult> => {
      const { error } = await supabase.from('stock_rules').upsert(rule, { onConflict: 'item_id' })
      if (error) return { ok: false, error: describeError(error) }
      await reload()
      return { ok: true }
    },
    [reload],
  )

  /** 発注した、と記録する。これで冷却期間のあいだ一覧から消える。 */
  const markOrdered = useCallback(
    async (alertsToMark: StockAlertRow[], staffName: string | null): Promise<StockResult> => {
      const rows = alertsToMark.map((a) => ({
        item_id: a.item_id,
        supplier_id: a.rule.supplier_id,
        qty: a.rule.order_qty,
        unit: a.rule.unit,
        staff_name: staffName,
      }))
      if (rows.length === 0) return { ok: true }
      const { error } = await supabase.from('stock_orders').insert(rows)
      if (error) return { ok: false, error: describeError(error) }
      await reload()
      return { ok: true }
    },
    [reload],
  )

  return {
    loading,
    missingTable,
    today,
    items,
    suppliers,
    rules,
    orders,
    quantities,
    countedOn,
    alerts,
    itemById,
    supplierById,
    saveSupplier,
    saveRule,
    markOrdered,
    reload,
  }
}
