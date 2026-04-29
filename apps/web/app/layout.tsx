import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ArtDuo",
  description: "Release-backed emotional art curation thin slice.",
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
