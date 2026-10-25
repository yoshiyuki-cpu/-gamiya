'use client'

import { useDrinkRefills } from '@/hooks/useDrinkRefills'

/**
 * 「ドリンクおかわりの声掛け」の項目の下に出す、今日とれた杯数。
 * 退勤のときに入れた数を人ごとに見せる。列がまだ無いときは何も出さない。
 */
export default function RefillTally() {
  const { loading, available, total, byStaff } = useDrinkRefills()
  if (loading || !available) return null

  return (
    <div className="refill-tally">
      <div className="refill-tally-head">
        <span>今日のおかわり</span>
        <strong>{total}杯</strong>
      </div>
      {byStaff.length === 0 ? (
        <div className="refill-tally-empty">退勤のときに入れた杯数が、ここに出ます。</div>
      ) : (
        <div className="refill-tally-list">
          {byStaff.map((s) => (
            <span key={s.name} className="refill-tally-chip">
              {s.name} <strong>{s.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
