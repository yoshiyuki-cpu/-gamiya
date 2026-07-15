'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="nav">
      <Link href="/" className={pathname === '/' ? 'active' : ''}>
        <span className="nav-icon" aria-hidden="true">✓</span>
        <span className="nav-label">チェック</span>
      </Link>
      <Link href="/orders" className={pathname?.startsWith('/orders') ? 'active' : ''}>
        <span className="nav-icon" aria-hidden="true">🍖</span>
        <span className="nav-label">壁紙注文</span>
      </Link>
      <Link href="/assistant" className={pathname?.startsWith('/assistant') ? 'active' : ''}>
        <span className="nav-icon" aria-hidden="true">💬</span>
        <span className="nav-label">AI相談</span>
      </Link>
      <Link href="/reports" className={pathname?.startsWith('/reports') ? 'active' : ''}>
        <span className="nav-icon" aria-hidden="true">📋</span>
        <span className="nav-label">日報</span>
      </Link>
      <Link href="/meetings" className={pathname?.startsWith('/meetings') ? 'active' : ''}>
        <span className="nav-icon" aria-hidden="true">🎙</span>
        <span className="nav-label">議事録</span>
      </Link>
    </nav>
  )
}
