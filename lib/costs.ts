// メニューごとの原価。材料の「買う量と値段」から1皿の材料費を出し、売価と比べる。
// ここは計算だけ。DBは hooks/useCosts.ts、画面は app/costs/page.tsx。

export type IngredientLike = {
  id: number
  name: string
  unit: string // g / ml / 個 / 枚 / 本 …
  pack_qty: number // 買う量(1000g など)
  pack_price: number // その値段(円)
  active: boolean
}

export type MenuItemLike = {
  id: number
  name: string
  price: number | null // 売価(円)
  target_rate: number | null // 目標原価率(%)
  active: boolean
}

export type MenuLineLike = {
  id: number
  menu_item_id: number
  ingredient_id: number
  qty: number // 1皿に使う量(材料の単位で)
}

/** 材料の単位あたりの値段(円/g など)。買う量が0なら 0。 */
export function unitPrice(ing: Pick<IngredientLike, 'pack_qty' | 'pack_price'>): number {
  if (!ing.pack_qty || ing.pack_qty <= 0) return 0
  return ing.pack_price / ing.pack_qty
}

/** 「1000g 3,800円 → 3.8円/g」の右側。 */
export function unitPriceLabel(ing: IngredientLike): string {
  const p = unitPrice(ing)
  const shown = p >= 10 ? Math.round(p).toLocaleString('ja-JP') : p.toFixed(p >= 1 ? 1 : 2)
  return `${shown}円/${ing.unit}`
}

export type MenuLineCost = { line: MenuLineLike; ingredient: IngredientLike | null; cost: number }

export type MenuCost = {
  menu: MenuItemLike
  lines: MenuLineCost[]
  cost: number // 1皿の材料費(円)
  rate: number | null // 原価率(%)。売価が無ければ null
  overTarget: boolean
  missingIngredient: boolean // 材料が消されている行がある
}

export const DEFAULT_TARGET_RATE = 35

export function costOfMenu(menu: MenuItemLike, lines: MenuLineLike[], ingredientById: Map<number, IngredientLike>): MenuCost {
  const own = lines.filter((l) => l.menu_item_id === menu.id).sort((a, b) => a.id - b.id)
  const lineCosts: MenuLineCost[] = own.map((line) => {
    const ingredient = ingredientById.get(line.ingredient_id) ?? null
    const cost = ingredient ? unitPrice(ingredient) * line.qty : 0
    return { line, ingredient, cost }
  })
  const cost = lineCosts.reduce((s, l) => s + l.cost, 0)
  const rate = menu.price && menu.price > 0 ? (cost / menu.price) * 100 : null
  const target = menu.target_rate ?? DEFAULT_TARGET_RATE
  return {
    menu,
    lines: lineCosts,
    cost,
    rate,
    overTarget: rate !== null && rate > target,
    missingIngredient: lineCosts.some((l) => l.ingredient === null),
  }
}

/** 全メニューの原価。原価率の高い順(売価なしは最後)。 */
export function costsOfAll(menus: MenuItemLike[], lines: MenuLineLike[], ingredients: IngredientLike[]): MenuCost[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  return menus
    .filter((m) => m.active)
    .map((m) => costOfMenu(m, lines, byId))
    .sort((a, b) => {
      if (a.rate === null && b.rate === null) return a.menu.name.localeCompare(b.menu.name, 'ja')
      if (a.rate === null) return 1
      if (b.rate === null) return -1
      return b.rate - a.rate
    })
}

/** 目標原価率に収めるための売価の目安。10円単位で切り上げ。 */
export function suggestedPrice(cost: number, targetRate: number | null): number | null {
  const t = targetRate ?? DEFAULT_TARGET_RATE
  if (cost <= 0 || t <= 0) return null
  return Math.ceil(cost / (t / 100) / 10) * 10
}

export function yen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

export function percent(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(rate >= 10 ? 0 : 1)}%`
}

/** 「3,800」「3800円」「１２００」を数に。読めなければ null。 */
export function parseNumber(raw: string): number | null {
  const s = raw
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，円gｇ\s]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export const UNITS = ['g', 'ml', '個', '枚', '本', '玉', '束', '切れ', '人前', 'kg', 'L'] as const

/** 材料が使われているメニューの数(消す前の確認に使う)。 */
export function usageCount(ingredientId: number, lines: MenuLineLike[]): number {
  return new Set(lines.filter((l) => l.ingredient_id === ingredientId).map((l) => l.menu_item_id)).size
}
