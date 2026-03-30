import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { formatDate } from "@/lib/utils";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";

const featureTracks = [
  {
    id: "eng",
    icon: "01",
    title: "Engineering",
    description: "Architecture drills, debugging pressure, and deep implementation follow-ups.",
  },
  {
    id: "prd",
    icon: "02",
    title: "Product",
    description: "Narrative clarity, prioritization trade-offs, and stakeholder positioning.",
  },
  {
    id: "ops",
    icon: "03",
    title: "Operations",
    description: "Execution quality, incident handling, and systemized operational thinking.",
  },
  {
    id: "mgt",
    icon: "04",
    title: "Management",
    description: "Leadership signals, resource judgment, and high-context decision narratives.",
  },
];

const modules = [
  {
    href: "/simulator/new",
    icon: "SIM",
    title: "Launch simulation",
    description: "Spin up a new high-pressure interview run with role packs and custom materials.",
  },
  {
    href: "/hub",
    icon: "HUB",
    title: "Open command center",
    description: "Move from evaluation to execution with guided strategy, sandboxing, and copilot work.",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const sessions = ((await store.listSessions(viewer.id)) ?? []).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  const activeRuns = sessions.filter((session) =>
    ["live", "analyzing"].includes(session.status),
  ).length;
  const completedRuns = sessions.filter((session) =>
    ["report_ready", "accepted", "hub_active"].includes(session.status),
  ).length;
  const latestUpdate = sessions[0]?.updatedAt ?? null;
  const initial = viewer.displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="overview-page">
      <header className="marketing-topbar">
        <div className="marketing-brand">Mobius Project</div>
        <nav className="marketing-nav" aria-label="Primary navigation">
          <Link href="/" className="active">
            Home
          </Link>
          <Link href="/simulator/new">Simulator</Link>
          <Link href="/hub">Hub</Link>
        </nav>
        <div className="marketing-actions">
          <ThemeToggle />
          {!viewer.isDemo ? <Link href="/auth/sign-out">Sign out</Link> : null}
          <div className="marketing-avatar" style={{ width: 38, height: 38 }}>
            {initial}
          </div>
        </div>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-grid">
            <div>
              <span className="marketing-eyebrow">Private workspace</span>
              <h1 className="marketing-title">
                Replace guesswork with
                <br />
                <span>guided pressure</span>
              </h1>
              <p className="marketing-copy">
                Practice interview rounds, surface structured evidence, and move directly into a
                calmer command-center workflow when the session is done.
              </p>
              <div className="marketing-actions-row">
                <Link href="/simulator/new" className="primary-button">
                  Start Simulation
                </Link>
                <Link href="/hub" className="secondary-button">
                  Open Hub
                </Link>
              </div>
              <div className="overview-kpis">
                <div className="overview-kpi">
                  <strong>{sessions.length}</strong>
                  <p>Total sessions</p>
                </div>
                <div className="overview-kpi">
                  <strong>{activeRuns}</strong>
                  <p>Active runs</p>
                </div>
                <div className="overview-kpi">
                  <strong>{completedRuns}</strong>
                  <p>Report-ready or beyond</p>
                </div>
              </div>
              <div className="marketing-proof">
                <div className="marketing-proof-avatars" aria-hidden="true">
                  <div className="marketing-proof-avatar">A</div>
                  <div className="marketing-proof-avatar">I</div>
                  <div className="marketing-proof-avatar">+</div>
                </div>
                <span>
                  {latestUpdate
                    ? `Last updated ${formatDate(latestUpdate)}`
                    : "No session history yet. Start with a fresh simulation."}
                </span>
              </div>
            </div>

            <div className="marketing-hero-visual">
              <div className="marketing-screen">
                <div className="marketing-terminal">
                  <div className="marketing-terminal-window">
                    <strong>Mobius diagnostic console</strong>
                    <p>
                      Capture the signal inside your answer, then translate it into reusable
                      evidence and a cleaner next move.
                    </p>
                  </div>
                </div>
                <div className="marketing-insight-card">
                  <strong>AI insight</strong>
                  <p>
                    When your answer lands well, Mobius preserves the rationale instead of only
                    grading the outcome.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <h2>Career tracks with editorial clarity</h2>
            <p>
              The design follows the stitched direction: breathable cards, tonal layering, and
              clear work surfaces instead of heavy dashboard chrome.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {featureTracks.map((track) => (
              <article key={track.id} className="marketing-feature-card">
                <div className="marketing-feature-icon">{track.icon}</div>
                <h3>{track.title}</h3>
                <p>{track.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="workspace-summary-grid">
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="panel-label">Recent sessions</p>
                  <h3>Latest interview runs</h3>
                </div>
              </div>
              <div className="overview-session-list">
                {sessions.length === 0 ? (
                  <p className="muted-copy">
                    No sessions yet. Start a new run and this space will collect your recent
                    simulations and reports.
                  </p>
                ) : (
                  sessions.slice(0, 4).map((session) => (
                    <Link
                      key={session.id}
                      href={`/report/${session.id}`}
                      className="list-row"
                    >
                      <div>
                        <strong>{session.config.targetCompany}</strong>
                        <p className="muted-copy">
                          {session.config.level} · {session.config.rolePack}
                        </p>
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

            <section className="workspace-card workspace-highlight-card">
              <div className="section-head">
                <div>
                  <p className="panel-label">Command center</p>
                  <h3>Move from diagnosis to action</h3>
                </div>
              </div>
              <div className="workspace-list">
                {modules.map((module) => (
                  <Link key={module.href} href={module.href} className="workspace-list-item">
                    <strong>{module.title}</strong>
                    <p>{module.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-cta-band">
            <div>
              <h2>Start from pressure, end with clarity.</h2>
              <p>
                The stitched redesign keeps the existing data flow intact while making the frontend
                feel more focused, premium, and deliberate.
              </p>
            </div>
            <Link href="/simulator/new" className="primary-button">
              Launch the next run
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
