import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@300;400;500;600;700&family=Playfair+Display:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}