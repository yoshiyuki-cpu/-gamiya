import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "./_components/Nav";
import Splash from "./_components/Splash";

export const metadata: Metadata = {
  title: "焼肉がみやアプリ",
  description: "焼肉がみやアプリ | 開店準備チェックシート",
  // スマホの「ホーム画面に追加」から、アプリのように全画面で開けるようにする
  applicationName: "がみや",
  appleWebApp: {
    capable: true,
    title: "がみや",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

// 画面の端(iPhoneの上の時計・下のバー)まで使い、その分は CSS の safe-area でよける。
// 拡大縮小は止めない(文字が見えにくい人が指で広げられるように)。入力欄は16pxにしてあるので勝手には拡大されない。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b1310",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;800&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Splash />
        <Nav />
        {children}
      </body>
    </html>
  );
}
