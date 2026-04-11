import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import type { Viewer } from "@/lib/domain";
import { formatRolePackLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/journey", label: "概览" },
  { href: "/simulator/new", label: "模拟器" },
  { href: "/hub/copilot", label: "副驾" },
  { href: "/hub/strategy", label: "战略" },
  { href: "/hub/sandbox", label: "沙盒" },
];

const workspaceLabels: Record<Viewer["workspaceMode"], string> = {
  interview: "面试协议",
  command_center: "指挥中心",
};

export type AppShellMode = "interview" | "command";

export function AppFrame({
  viewer,
  title,
  subtitle,
  children,
  activeHref,
  shellMode = viewer.workspaceMode === "command_center" ? "command" : "interview",
}: {
  viewer: Viewer;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  activeHref?: string;
  shellMode?: AppShellMode;
}) {
  const workspaceLabel =
    shellMode === "command" ? "指挥中心" : workspaceLabels[viewer.workspaceMode] ?? "默认模式";

  return (
    <div className={cn("app-shell", `shell-${shellMode}`)} data-shell={shellMode}>
      <header className="topbar">
        <div>
          <Link href="/journey" className="wordmark">
            莫比乌斯计划
          </Link>
          <p className="eyebrow">
            {shellMode === "command" ? "个人指挥中心" : "面试模拟器 + 指挥中心"}
          </p>
        </div>
        <div className="topbar-meta">
          <span className="status-pill">{viewer.isDemo ? "演示模式" : "已认证"}</span>
          <span className="status-pill subtle">{workspaceLabel}</span>
          <ThemeToggle />
          {!viewer.isDemo ? (
            <Link href="/auth/sign-out" className="nav-link">
              退出登录
            </Link>
          ) : null}
        </div>
      </header>

      <div className="layout-grid">
        <aside className="sidebar">
          <div className="panel">
            <p className="panel-label">查看者</p>
            <h3>{viewer.displayName}</h3>
            <p className="muted-copy">首选角色包：{formatRolePackLabel(viewer.preferredRolePack)}</p>
          </div>
          <nav className="nav-list">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("nav-link", activeHref === item.href && "active")}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="content">
          <section className="hero-card">
            <p className="eyebrow">
              {shellMode === "command" ? "系统协议 / 忠诚模式" : "系统状态"}
            </p>
            <h1>{title}</h1>
            <p className="hero-copy">{subtitle}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
