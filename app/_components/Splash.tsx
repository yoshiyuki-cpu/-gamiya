'use client'

import { useEffect, useState } from 'react'
import { todayKey } from '@/lib/checklist'

// 表紙は1営業日に1回だけ出す。スマホでは開き直すたびにセッションが切れるので、
// 前のように「開くたびに約2秒待つ」と、急いでいるときに邪魔になる。
const SEEN_KEY = 'gamiya-splash-day'
const AUTO_DISMISS_MS = 1200

function readSeenDay(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeenDay() {
  try {
    window.localStorage.setItem(SEEN_KEY, todayKey())
  } catch {
    // 保存できない端末では毎回出るだけ。動作は止めない
  }
}

export default function Splash() {
  const [show, setShow] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    if (readSeenDay() === todayKey()) return
    // 端末の記録はブラウザでしか読めないので、表示に切り替えるのはここ(サーバーでは出さない)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setFadingOut(true)
    writeSeenDay()
    setTimeout(() => setShow(false), 400)
  }

  if (!show) return null

  return (
    <div className={`splash${fadingOut ? ' splash-hide' : ''}`} onClick={dismiss}>
      <img className="splash-img" src="/cover-yakiniku.webp" alt="" />
      <div className="splash-fade" />
      <div className="splash-text">
        <div className="splash-eyebrow">GAMIYA</div>
        <div className="splash-title">焼肉がみや</div>
        <div className="splash-sub">タップして始める</div>
      </div>
    </div>
  )
}
