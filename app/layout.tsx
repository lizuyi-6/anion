import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Project Möbius",
  description:
    "Interview simulator, diagnostic reports, memory refactoring, and command center for high-pressure career preparation.",
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
