import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '焼肉がみやアプリ',
  description: '牛タン専門焼肉店・焼肉がみやアプリ | 開店準備チェックシート',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>
}
