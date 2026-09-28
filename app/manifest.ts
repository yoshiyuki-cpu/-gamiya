import type { MetadataRoute } from 'next'

// Androidの「ホーム画面に追加 / アプリをインストール」用。iPhoneは layout.tsx の appleWebApp を見る。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '焼肉がみやアプリ',
    short_name: 'がみや',
    description: '開店準備・予約・勤怠など、がみやの1日を回すアプリ',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1b1310',
    theme_color: '#1b1310',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
