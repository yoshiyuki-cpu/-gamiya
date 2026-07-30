'use client'

import { useEffect, useState } from 'react'

const SEEN_KEY = 'gamiya-splash-seen'
const AUTO_DISMISS_MS = 1800

export default function Splash() {
  const [show, setShow] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return
    setShow(true)
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setFadingOut(true)
    sessionStorage.setItem(SEEN_KEY, '1')
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
