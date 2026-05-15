import type { Metadata, Viewport } from "next";
import { getAppBasePath } from "@/lib/static-export";
import "./globals.css";

const basePath = getAppBasePath();

export const metadata: Metadata = {
  title: "ロマン枠 作戦司令室",
  description: "個人用ロマン枠投資ダッシュボード",
  icons: {
    icon: `${basePath}/icon.svg`,
    apple: `${basePath}/icon.svg`
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ロマン司令室"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#08090a",
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
