// 在庫と発注の決まりごと。
// 在庫の数は開店前チェックの数量入力(daily_records.quantity_value)を使う。
// ここでは「下回っているか」「もう発注したか」「発注文をどう組むか」だけを決める。

export type StockRuleLike = {
  item_id: number
  supplier_id: number | null
  threshold: number
  order_qty: number
  unit: string | null
  active: boolean
}

export type StockOrderLike = {
  item_id: number
  ordered_at: string
}

export type SupplierLike = {
  id: number
  name: string
  email: string | null
}

/**
 * 発注してからこの日数は、同じ品目をもう一度知らせない。
 * 納品が届くまで数は減ったままなので、毎日同じ品目が赤く出続けると
 * 見なくなってしまう。
 */
export const ORDER_COOLDOWN_DAYS = 3

/** 数量入力の文字列を数に読む。「3」「3個」「3.5」は読める。空や文字だけは null。 */
export function parseQuantity(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /-?\d+(?:\.\d+)?/.exec(value.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/** 規定数を下回っているか。数が入っていない日は判定しない(下回りとは言えない)。 */
export function isBelow(rule: StockRuleLike, quantity: number | null): boolean {
  if (quantity === null) return false
  return quantity < rule.threshold
}

/** 直近の発注が、まだ冷却期間の中にあるか。 */
export function recentlyOrdered(orders: StockOrderLike[], itemId: number, now = Date.now()): boolean {
  const latest = orders
    .filter((o) => o.item_id === itemId)
    .map((o) => new Date(o.ordered_at).getTime())
    .sort((a, b) => b - a)[0]
  if (latest === undefined) return false
  return now - latest < ORDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
}

export type StockAlert = {
  item_id: number
  quantity: number
  rule: StockRuleLike
}

/**
 * 発注が必要な品目。
 * 「規定数を下回っている」かつ「まだ発注していない(冷却期間を過ぎている)」もの。
 */
export function pendingAlerts(
  rules: StockRuleLike[],
  quantities: Record<number, number | null>,
  orders: StockOrderLike[],
  now = Date.now(),
): StockAlert[] {
  const out: StockAlert[] = []
  for (const rule of rules) {
    if (!rule.active) continue
    const quantity = quantities[rule.item_id] ?? null
    if (!isBelow(rule, quantity)) continue
    if (recentlyOrdered(orders, rule.item_id, now)) continue
    out.push({ item_id: rule.item_id, quantity: quantity as number, rule })
  }
  return out
}

/** 発注先ごとにまとめる。発注先が未設定のものは「発注先なし」にまとめる。 */
export function groupBySupplier<T extends { rule: StockRuleLike }>(alerts: T[]): Map<number | null, T[]> {
  const map = new Map<number | null, T[]>()
  for (const a of alerts) {
    const key = a.rule.supplier_id
    const list = map.get(key) ?? []
    list.push(a)
    map.set(key, list)
  }
  return map
}

function unitLabel(unit: string | null): string {
  return unit ? unit : '個'
}

/**
 * 発注文。メールの本文にそのまま使う。
 * 数字を1つずつ書き、まとめて「◯点」と書かない。
 * 先方が読み間違えると、こちらが困る。
 */
export function buildOrderText(
  supplierName: string,
  lines: { itemName: string; qty: number; unit: string | null }[],
  storeName = '焼肉GAMIYA',
): string {
  const body = lines.map((l) => `・${l.itemName}　${l.qty}${unitLabel(l.unit)}`).join('\n')
  return (
    `${supplierName} 御中\n\n` +
    `いつもお世話になっております。${storeName}です。\n` +
    `下記のとおり発注いたします。\n\n` +
    `${body}\n\n` +
    `よろしくお願いいたします。\n\n${storeName}`
  )
}

/** メールアプリを開くリンク。宛先・件名・本文が入った状態で開く。 */
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
