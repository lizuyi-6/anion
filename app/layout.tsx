import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "莫比乌斯计划",
  description:
    "面试模拟器、诊断报告、记忆重构与高压职场备战指挥中心。",
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
