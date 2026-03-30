"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import type { RolePackId, Viewer } from "@/lib/domain";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/simulator/new", label: "Simulator" },
  { href: "/hub", label: "Hub" },
];

const tracks: Array<{ id: RolePackId; label: string }> = [
  { id: "engineering", label: "Engineering" },
  { id: "product", label: "Product" },
  { id: "operations", label: "Operations" },
  { id: "management", label: "Management" },
];

export function HubShell({
  children,
  viewer,
  activeTrack,
}: {
  children: React.ReactNode;
  viewer: Viewer;
  activeTrack?: RolePackId;
}) {
  const pathname = usePathname();
  const initial = viewer.displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-brand-row">
          <Link href="/" className="workspace-brand">
            Mobius Project
          </Link>
          <nav className="workspace-primary-nav" aria-label="Primary navigation">
            {primaryLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("workspace-primary-link", isActive && "active")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="workspace-user-tools">
          <Link href="/simulator/new" className="workspace-cta">
            Launch Simulation
          </Link>
          <ThemeToggle />
          <div className="workspace-avatar" aria-hidden="true">
            {initial}
          </div>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar-card">
            <div className="workspace-sidebar-icon">+</div>
            <div>
              <p className="workspace-sidebar-title">Hub</p>
              <p className="workspace-sidebar-copy">Career tracks</p>
            </div>
          </div>

          <div className="workspace-track-list" aria-label="Career tracks">
            {tracks.map((track) => (
              <div
                key={track.id}
                className={cn("workspace-track", activeTrack === track.id && "active")}
              >
                <span className="workspace-track-dot" aria-hidden="true" />
                <span>{track.label}</span>
              </div>
            ))}
          </div>

          <div className="workspace-sidebar-footer">
            <div className="workspace-support-link">Settings</div>
            <div className="workspace-support-link">Support</div>
            {!viewer.isDemo ? (
              <Link href="/auth/sign-out" className="workspace-support-link workspace-signout">
                Sign out
              </Link>
            ) : null}
          </div>
        </aside>

        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
