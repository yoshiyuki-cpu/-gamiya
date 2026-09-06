import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl, broadcastLine, KEEP_REMAINING, rejectIfNotCron } from '@/lib/lineNotify'
import { parseQuantity, pendingAlerts } from '@/lib/stock'
import { buildStockMessage } from '@/lib/stockNotify'
import type { DailyRecord, Item, StockOrder, StockRule, Supplier } from '@/lib/supabase'

// Vercel Cron から毎日17時15分(JST)に呼ばれる。開店前チェックで数えた
// 在庫が規定数を下回っていて、まだ発注していない品目があれば知らせる。
// 発注済み(3日以内)の品目は出さないので、毎日同じものが鳴り続けない。
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [ruleRes, supRes, orderRes] = await Promise.all([
    supabase.from('stock_rules').select('*').eq('active', true),
    supabase.from('suppliers').select('*'),
    supabase.from('stock_orders').select('item_id, ordered_at').gte('ordered_at', since),
  ])
  if (ruleRes.error) {
    console.error('notify-stock: supabase read failed', ruleRes.error)
    return NextResponse.json({ error: '在庫の決めごとの取得に失敗しました' }, { status: 500 })
  }
  const rules = (ruleRes.data ?? []) as StockRule[]
  if (rules.length === 0) return NextResponse.json({ notified: false, reason: 'no rules' })

  const itemIds = rules.map((r) => r.item_id)
  const from = new Date()
  from.setDate(from.getDate() - 14)
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
  const [itemRes, recRes] = await Promise.all([
    supabase.from('items').select('id, text').in('id', itemIds),
    supabase
      .from('daily_records')
      .select('item_id, record_date, quantity_value')
      .in('item_id', itemIds)
      .gte('record_date', fromKey)
      .order('record_date', { ascending: false }),
  ])

  const quantities: Record<number, number | null> = {}
  for (const row of (recRes.data ?? []) as Pick<DailyRecord, 'item_id' | 'record_date' | 'quantity_value'>[]) {
    if (row.item_id in quantities) continue
    const n = parseQuantity(row.quantity_value)
    if (n !== null) quantities[row.item_id] = n
  }

  const alerts = pendingAlerts(rules, quantities, (orderRes.data ?? []) as Pick<StockOrder, 'item_id' | 'ordered_at'>[])
  if (alerts.length === 0) return NextResponse.json({ notified: false, reason: 'nothing below threshold' })

  const names = new Map(((itemRes.data ?? []) as Pick<Item, 'id' | 'text'>[]).map((i) => [i.id, i.text]))
  const text = buildStockMessage(
    alerts.map((a) => ({ ...a, itemName: names.get(a.item_id) ?? `品目#${a.item_id}` })),
    (supRes.data ?? []) as Supplier[],
    appUrl(),
  )

  const result = await broadcastLine(text, { keepRemaining: KEEP_REMAINING.stock })
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  if (!result.sent) return NextResponse.json({ notified: false, reason: 'quota', remaining: result.remaining })
  return NextResponse.json({ notified: true, count: alerts.length })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
