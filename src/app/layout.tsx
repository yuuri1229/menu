import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Roboto } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// 英数字は Roboto、日本語は Noto Sans JP。どちらも可変フォント（太さを自由に選べる）。
// Roboto を先に並べ、Roboto にない日本語の文字だけ Noto Sans JP で表示する
const roboto = Roboto({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-roboto",
  display: "swap",
});

// 日本語の文字は unicode-range ごとに分かれていて、画面に出た文字の分だけ読み込まれる
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  preload: false,
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "こんだて帖",
  description: "1週間の献立・買い物・在庫をひと目で",
  manifest: `${basePath}/manifest.webmanifest`,
  // ホーム画面に追加して全画面で使う前提。ステータスバーの色は theme-color（ライト/ダーク別）に合わせる
  appleWebApp: { capable: true, title: "こんだて帖", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  robots: { index: false, follow: false },
  icons: {
    icon: `${basePath}/icon.svg`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#15120f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${roboto.variable} ${notoSansJp.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
