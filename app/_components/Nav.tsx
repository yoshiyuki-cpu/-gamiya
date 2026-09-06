'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type NavItem = {
  href: string
  icon: string
  label: string
  /** メニューの中で出す一言。毎日使う5つには要らない。 */
  desc?: string
}

/**
 * 下のタブは「毎日さわる5つ」だけ。
 * 親指が届く幅に6つまでしか置かない(375pxで1つ60px)。
 */
const PRIMARY: NavItem[] = [
  { href: '/', icon: '✓', label: 'チェック' },
  { href: '/guests', icon: '⭐', label: 'お客様評価' },
  { href: '/reservations', icon: '📅', label: '予約表' },
  { href: '/timecard', icon: '⏱', label: '勤怠' },
  { href: '/reports', icon: '📋', label: '日報' },
]

/** 月に数回・必要なときだけ開くものは「メニュー」の中。 */
const MORE: NavItem[] = [
  { href: '/shifts', icon: '🗓', label: 'シフト', desc: '休み希望・シフト表' },
  { href: '/stock', icon: '📦', label: '発注', desc: '規定数を下回った品目' },
  { href: '/orders', icon: '🍖', label: '壁紙注文', desc: '壁紙メニューの注文' },
  { href: '/meetings', icon: '🎙', label: '議事録', desc: '朝礼・会議の記録' },
  { href: '/recipes', icon: '📖', label: 'レシピ', desc: '肉・サイド・ドリンク' },
  { href: '/assistant', icon: '💬', label: 'AI相談', desc: '店のことを質問' },
]

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export default function Nav() {
  const pathname = usePathname()
  // 「どの画面で開いたか」を覚える。別の画面に移れば自然に閉じる(効果で閉じ直さない)。
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const open = openedAt !== null && openedAt === pathname
  const setOpen = (next: boolean) => setOpenedAt(next ? pathname : null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenedAt(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 今いる画面がメニューの中のものなら、6つ目のタブにその名前を出す。
  const current = MORE.find((m) => isActive(pathname, m.href))

  return (
    <>
      <nav className="nav" aria-label="メインメニュー">
        {PRIMARY.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`nav-more${current || open ? ' active' : ''}`}
          aria-expanded={open}
          aria-controls="nav-menu"
          onClick={() => setOpen(!open)}
        >
          <span className="nav-icon" aria-hidden="true">{current ? current.icon : '☰'}</span>
          <span className="nav-label">{current ? current.label : 'メニュー'}</span>
        </button>
      </nav>

      {open ? (
        <div className="menu-backdrop" onClick={() => setOpen(false)}>
          <div
            id="nav-menu"
            className="menu-sheet"
            role="dialog"
            aria-label="メニュー"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menu-head">
              <div className="menu-title">メニュー</div>
              <button type="button" className="menu-close" onClick={() => setOpen(false)} aria-label="閉じる">
                ×
              </button>
            </div>
            <div className="menu-grid">
              {MORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`menu-item${isActive(pathname, item.href) ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="menu-icon" aria-hidden="true">{item.icon}</span>
                  <span className="menu-text">
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-desc">{item.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
