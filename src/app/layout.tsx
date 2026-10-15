import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const zenMaru = Zen_Maru_Gothic({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru",
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
    <html lang="ja" className={zenMaru.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
