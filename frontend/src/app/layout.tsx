import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

// 字体配置 - 优化加载策略
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["system-ui", "arial"]
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["Georgia", "serif"]
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["PingFang SC", "Microsoft YaHei", "sans-serif"]
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["SimSun", "serif"]
});

export const metadata: Metadata = {
  title: "ArtDuo - 艺遇",
  description: "AI 驱动的沉浸式情感艺术策展网站",
  keywords: ["艺术", "策展", "AI", "情感", "展览"],
  authors: [{ name: "ArtDuo Team" }],
  openGraph: {
    title: "ArtDuo - 艺遇",
    description: "AI 驱动的沉浸式情感艺术策展网站",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArtDuo - 艺遇",
    description: "AI 驱动的沉浸式情感艺术策展网站",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${playfair.variable} ${notoSansSC.variable} ${notoSerifSC.variable} dark`}>
      <head>
        {/* 字体预连接优化 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased font-sans`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}