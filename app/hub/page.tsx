import Link from "next/link";

import { formatDate } from "@/lib/utils";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";

const moduleCards = [
  {
    href: "/hub/copilot",
    icon: "AI",
    title: "Copilot",
    description: "Root-cause support, code review framing, and direct action plans.",
  },
  {
    href: "/hub/strategy",
    icon: "FS",
    title: "Strategy",
    description: "Structured feasibility output, operating assumptions, and delivery plans.",
  },
  {
    href: "/hub/sandbox",
    icon: "SB",
    title: "Sandbox",
    description: "Low-risk simulations for negotiation, conflict, and scenario planning.",
  },
];

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const sessions = ((await store.listSessions(viewer.id)) ?? []).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const memoryContext = await store.getActiveMemoryContext(viewer.id);

  const dayKeys = [1, 2, 3, 4, 5, 6, 0];
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = dayKeys.map((weekday) =>
    sessions.filter((session) => new Date(session.updatedAt).getDay() === weekday).length,
  );
  const fallback = [2, 3, 5, 4, 6, 5, 7];
  const bars = (counts.some(Boolean) ? counts : fallback).map((count, index, all) => {
    const max = Math.max(...all, 1);
    const efficiency = 28 + Math.round((count / max) * 62);
    const quality = Math.max(18, efficiency - 14);
    return { label: dayLabels[index], efficiency, quality };
  });

  const highlight =
    memoryContext?.profile.gaps[0]?.summary ??
    "Use the next run to tighten the bridge between decision framing and quantified outcomes.";

  const timeline = memoryContext?.timeline.slice(0, 3) ?? [];
  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="workspace-grid">
      <header className="workspace-page-head">
        <div>
          <h1>
            Command Center <span style={{ color: "var(--muted-soft)", fontWeight: 300 }}>/ Hub</span>
          </h1>
          <p>
            Your stitched hub surface: clean routing, clearer modules, and a calmer place to move
            from diagnosis into action.
          </p>
        </div>
        <div className="chip-row">
          <span className="workspace-pill">v2.4.0</span>
          <span className="workspace-pill primary">AI Copilot online</span>
        </div>
      </header>

      <section className="workspace-module-grid">
        {moduleCards.map((card) => (
          <Link key={card.href} href={card.href} className="workspace-module-link">
            <div className="workspace-module-icon">{card.icon}</div>
            <div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="workspace-analytics">
        <article className="workspace-card">
          <div className="section-head">
            <div>
              <p className="panel-label">Performance analytics</p>
              <h3>Weekly activity pattern</h3>
            </div>
            <div className="chip-row">
              <span className="status-pill subtle">Efficiency</span>
              <span className="status-pill subtle">Quality</span>
            </div>
          </div>
          <div className="workspace-bar-chart" aria-label="Weekly activity chart">
            {bars.map((bar) => (
              <div key={bar.label} className="workspace-bar-wrap">
                <div className="workspace-bar-stack">
                  <div className="workspace-bar" style={{ height: `${bar.efficiency}%` }} />
                  <div
                    className="workspace-bar secondary"
                    style={{ height: `${bar.quality}%` }}
                  />
                </div>
                <span className="workspace-bar-label">{bar.label}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="workspace-grid">
          <article className="workspace-card">
            <div className="section-head">
              <div>
                <p className="panel-label">Roadmap</p>
                <h3>Near-term checkpoints</h3>
              </div>
            </div>
            <div className="workspace-list">
              {timeline.length > 0 ? (
                timeline.map((item) => (
                  <div key={item.id} className="workspace-list-item">
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </div>
                ))
              ) : (
                <div className="workspace-list-item">
                  <strong>Activate a fresh profile</strong>
                  <p>
                    Finish one interview and accept the offer transition to unlock your memory
                    timeline here.
                  </p>
                </div>
              )}
            </div>
          </article>

          <article className="workspace-card workspace-highlight-card">
            <div className="section-head">
              <div>
                <p className="panel-label">Mobius insight</p>
                <h3>Where to focus next</h3>
              </div>
            </div>
            <p className="hero-copy">{highlight}</p>
          </article>
        </div>
      </section>

      <section className="workspace-card">
        <div className="section-head">
          <div>
            <p className="panel-label">Recent activity</p>
            <h3>Latest session updates</h3>
          </div>
        </div>
        <div className="workspace-activity-list">
          {recentSessions.length === 0 ? (
            <p className="muted-copy">
              No recent activity yet. Launch a simulation to seed the hub with live context.
            </p>
          ) : (
            recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/report/${session.id}`}
                className="workspace-activity-item"
              >
                <div>
                  <strong>{session.config.targetCompany}</strong>
                  <div className="workspace-activity-meta">
                    {session.config.level} · {session.config.rolePack}
                  </div>
                </div>
                <div className="list-meta">
                  <span className="status-pill subtle">{session.status}</span>
                  <small>{formatDate(session.updatedAt)}</small>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
