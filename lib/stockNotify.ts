// 在庫の発注を知らせるLINEの文面。ルート側に置くとテストしづらいので切り出す。
import { groupBySupplier, type StockAlert, type SupplierLike } from './stock'

export type NamedAlert = StockAlert & { itemName: string }

export function buildStockMessage(
  alerts: NamedAlert[],
  suppliers: SupplierLike[],
  link: string | null,
): string {
  const byId = new Map(suppliers.map((s) => [s.id, s]))
  const groups = groupBySupplier(alerts)

  const lines: string[] = [`📦 発注が必要です(${alerts.length}品目)`]
  for (const [supplierId, list] of groups) {
    const name = supplierId != null ? (byId.get(supplierId)?.name ?? '発注先#' + supplierId) : '発注先が未設定'
    lines.push(`\n【${name}】`)
    for (const a of list) {
      const unit = a.rule.unit ?? '個'
      lines.push(`・${a.itemName}　残り${a.quantity}${unit}(規定${a.rule.threshold}) → ${a.rule.order_qty}${unit}`)
    }
  }
  lines.push('\n「発注」画面から、宛先入りのメールを開けます。発注したら「発注した」を押してください。')
  return lines.join('\n') + (link ? `\n${link}/stock` : '')
}
