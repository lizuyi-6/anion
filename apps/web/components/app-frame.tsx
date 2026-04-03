import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import type { Viewer } from "@/lib/domain";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/simulator/new", label: "New Simulation" },
  { href: "/hub", label: "Hub" },
  { href: "/hub/copilot", label: "Copilot" },
  { href: "/hub/strategy", label: "Strategy" },
  { href: "/hub/sandbox", label: "Sandbox" },
];

const workspaceLabels: Record<Viewer["workspaceMode"], string> = {
  interview: "Interview mode",
  command_center: "Command center",
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
    shellMode === "command"
      ? "Command center"
      : workspaceLabels[viewer.workspaceMode] ?? "Workspace";

  return (
    <div className={cn("app-shell", `shell-${shellMode}`)} data-shell={shellMode}>
      <header className="topbar">
        <div>
          <Link href="/" className="wordmark">
            Mobius Project
          </Link>
          <p className="eyebrow">
            {shellMode === "command"
              ? "Private operating workspace"
              : "Guided interview practice"}
          </p>
        </div>
        <div className="topbar-meta">
          <span className="status-pill">{viewer.isDemo ? "Demo" : "Signed in"}</span>
          <span className="status-pill subtle">{workspaceLabel}</span>
          <ThemeToggle />
          {!viewer.isDemo ? (
            <Link href="/auth/sign-out" className="nav-link">
              Sign out
            </Link>
          ) : null}
        </div>
      </header>

      <div className="layout-grid">
        <aside className="sidebar">
          <div className="panel">
            <p className="panel-label">Viewer</p>
            <h3>{viewer.displayName}</h3>
            <p className="muted-copy">
              Preferred track: {viewer.preferredRolePack.replace("_", " ")}
            </p>
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
              {shellMode === "command" ? "Guided perspective" : "Simulation workspace"}
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
