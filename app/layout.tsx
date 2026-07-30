import type { Metadata } from "next";
import "./globals.css";
import Nav from "./_components/Nav";
import Splash from "./_components/Splash";

export const metadata: Metadata = {
  title: "焼肉がみやアプリ",
  description: "焼肉がみやアプリ | 開店準備チェックシート",
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
