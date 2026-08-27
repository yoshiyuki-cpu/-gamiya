'use client'

import { dayLabel, weekdayOf } from '@/lib/shifts'
import type { ShiftRequest } from '@/lib/supabase'

// 自分の休み希望を出す画面。
// 出せる状態は「休み」と「入りたい」の2つだけで、何も押さない日は
// 「出られる」とみなす。全員が全日入力する運用は続かないため。
export default function RequestSheet({
  name,
  dates,
  requests,
  submitted,
  busy,
  onSet,
  onSubmit,
}: {
  name: string
  dates: string[]
  requests: ShiftRequest[]
  submitted: boolean
  busy: boolean
  onSet: (date: string, kind: 'off' | 'want' | null) => void
  onSubmit: () => void
}) {
  const mine = new Map(requests.filter((r) => r.staff_name === name).map((r) => [r.work_date, r.kind]))
  const offCount = [...mine.values()].filter((k) => k === 'off').length

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">希</div>
        <div>
          <div className="category-name">{name}さんの希望</div>
          <div className="category-sub">休み{offCount}日 ・ 押していない日は「出られる」扱いです</div>
        </div>
      </div>

      <div className="items">
        {dates.map((date) => {
          const kind = mine.get(date)
          const wd = weekdayOf(date)
          return (
            <div key={date} className={`sh-req-row${wd === 0 ? ' sh-sun' : wd === 6 ? ' sh-sat' : ''}`}>
              <span className="sh-req-date">{dayLabel(date)}</span>
              <div className="sh-req-btns">
                <button
                  type="button"
                  className={`sh-pick${kind === undefined ? ' active' : ''}`}
                  disabled={busy}
                  onClick={() => onSet(date, null)}
                >
                  出られる
                </button>
                <button
                  type="button"
                  className={`sh-pick sh-pick-off${kind === 'off' ? ' active' : ''}`}
                  disabled={busy}
                  onClick={() => onSet(date, 'off')}
                >
                  休み
                </button>
                <button
                  type="button"
                  className={`sh-pick sh-pick-want${kind === 'want' ? ' active' : ''}`}
                  disabled={busy}
                  onClick={() => onSet(date, 'want')}
                >
                  入りたい
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="satisfaction-body">
        <button className="next-guest-btn" type="button" disabled={busy} onClick={onSubmit}>
          {submitted ? '提出済み(もう一度出す)' : 'この内容で提出する'}
        </button>
        {submitted ? (
          <div className="sh-submitted-note">提出済みです。締め切りまでは何度でも直せます。</div>
        ) : (
          <div className="sh-submitted-note">提出するまで、店長には「未提出」と表示されます。</div>
        )}
      </div>
    </div>
  )
}
