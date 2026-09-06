'use client'

import Link from 'next/link'
import { useStock } from '@/hooks/useStock'

/**
 * 開店前チェックの上に出す、発注の帯。
 * 在庫を数える画面と同じ場所に「その結果どうなったか」を出す。
 * 発注が必要な品目が無いときは何も出さない。
 */
export default function StockBanner() {
  const { loading, alerts } = useStock()
  if (loading || alerts.length === 0) return null

  const names = alerts.map((a) => a.itemName)
  const shown = names.slice(0, 3).join('、') + (names.length > 3 ? ` ほか${names.length - 3}件` : '')

  return (
    <Link href="/stock" className="st-banner">
      <span className="st-banner-badge">発注</span>
      <span className="st-banner-text">
        規定数を下回っています: <strong>{shown}</strong>
      </span>
      <span className="st-banner-arrow" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
