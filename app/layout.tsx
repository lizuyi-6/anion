import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Mobius | 工程候选人的职业陪跑平台",
  description:
    "面向工程候选人的职业陪跑平台，把目标设定、模拟训练、复盘洞察和行动计划串成一条连续旅程。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
