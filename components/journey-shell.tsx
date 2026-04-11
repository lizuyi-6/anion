import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import type { Viewer } from "@/lib/domain";

const navItems = [
  { href: "/journey", label: "我的旅程" },
  { href: "/simulator/new", label: "实战演练" },
  { href: "/hub", label: "工作台" },
];

export function JourneyShell({
  viewer,
  activeHref,
  children,
}: {
  viewer: Viewer;
  activeHref: "/journey" | "/simulator/new" | "/hub";
  children: React.ReactNode;
}) {
  const initial = viewer.displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="journey-shell">
      <header className="journey-topbar">
        <div className="journey-brand-row">
          <Link href="/journey" className="journey-brand">
            Mobius
          </Link>
          <span className="journey-brand-copy">工程候选人的职业陪跑平台</span>
        </div>

        <nav className="journey-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href === activeHref ? "active" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="journey-tools">
          {viewer.isDemo ? <span className="journey-badge">演示模式</span> : null}
          <ThemeToggle />
          {!viewer.isDemo ? (
            <Link href="/auth/sign-out" className="journey-signout">
              退出
            </Link>
          ) : null}
          <div className="journey-avatar" aria-hidden="true">
            {initial}
          </div>
        </div>
      </header>

      <main className="journey-main">{children}</main>
    </div>
  );
}
