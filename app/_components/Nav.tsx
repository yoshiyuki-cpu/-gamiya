'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="nav">
      <Link href="/" className={pathname === '/' ? 'active' : ''}>
        チェックリスト
      </Link>
      <Link href="/orders" className={pathname?.startsWith('/orders') ? 'active' : ''}>
        壁紙メニュー
      </Link>
      <Link href="/assistant" className={pathname?.startsWith('/assistant') ? 'active' : ''}>
        AI相談
      </Link>
      <Link href="/reports" className={pathname?.startsWith('/reports') ? 'active' : ''}>
        日報
      </Link>
      <Link href="/meetings" className={pathname?.startsWith('/meetings') ? 'active' : ''}>
        議事録
      </Link>
    </nav>
  )
}
