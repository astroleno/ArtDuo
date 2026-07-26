import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ArtDuo",
  description: "情绪驱动的艺术观展路线。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
