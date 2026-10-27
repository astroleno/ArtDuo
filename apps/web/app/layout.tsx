import type { Metadata } from "next";

import "./globals.css";
import "../../../packages/ui/src/experience/experience.css";
import "../../../packages/ui/src/glass/glass-buttons.css";
import { GlassButtonEffects } from "../components/glass-button-effects";

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
      <body><GlassButtonEffects />{children}</body>
    </html>
  );
}
