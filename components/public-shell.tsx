import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import type { Viewer } from "@/lib/domain";

export function PublicShell({
  viewer,
  actions,
  children,
}: {
  viewer: Viewer | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="public-shell">
      <header className="public-topbar">
        <div className="public-brand-row">
          <Link href="/" className="public-brand">
            Mobius
          </Link>
          <span className="public-brand-copy">工程候选人的职业陪跑平台</span>
        </div>

        <div className="public-actions">
          <ThemeToggle />
          {actions ??
            (viewer && !viewer.isDemo ? (
              <Link href="/journey" className="public-link-button">
                进入我的旅程
              </Link>
            ) : (
              <Link href="/auth/sign-in" className="public-link-button">
                开始准备
              </Link>
            ))}
        </div>
      </header>

      <main className="public-main">{children}</main>
    </div>
  );
}
