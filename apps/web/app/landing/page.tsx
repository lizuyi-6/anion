import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { getViewer } from "@/lib/server/auth";

const tracks = [
  {
    id: "eng",
    icon: "01",
    title: "Engineering",
    description: "System design pressure tests, production debugging, and technical follow-through.",
  },
  {
    id: "prd",
    icon: "02",
    title: "Product",
    description: "Narrative quality, prioritization frames, and decision communication.",
  },
  {
    id: "ops",
    icon: "03",
    title: "Operations",
    description: "Execution discipline, incident handling, and process judgment under load.",
  },
  {
    id: "mgt",
    icon: "04",
    title: "Management",
    description: "Leadership range, alignment, and strategic confidence in public-facing answers.",
  },
];

export default async function LandingPage() {
  const viewer = await getViewer();
  const homeHref = viewer ? "/" : "/auth/sign-in";

  return (
    <div className="marketing-page">
      <header className="marketing-topbar">
        <div className="marketing-brand">Mobius Project</div>
        <nav className="marketing-nav" aria-label="Primary navigation">
          <Link href="/landing" className="active">
            Home
          </Link>
          <Link href="/simulator/new">Simulator</Link>
          <Link href="/hub">Hub</Link>
        </nav>
        <div className="marketing-actions">
          <ThemeToggle />
          <Link href={homeHref} className="workspace-cta">
            {viewer ? "Open Workspace" : "Sign In"}
          </Link>
        </div>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-grid">
            <div>
              <span className="marketing-eyebrow">AI guided platform</span>
              <h1 className="marketing-title">
                Mobius turns high-pressure
                <br />
                <span>interviews into signal.</span>
              </h1>
              <p className="marketing-copy">
                Rehearse under pressure, capture structured evidence, and carry those insights into
                a command center that is built for action instead of more noise.
              </p>
              <div className="marketing-actions-row">
                <Link href="/simulator/new" className="primary-button">
                  Start Simulation
                </Link>
                <Link href={homeHref} className="secondary-button">
                  {viewer ? "Open Workspace" : "Learn More"}
                </Link>
              </div>
              <div className="marketing-proof">
                <div className="marketing-proof-avatars" aria-hidden="true">
                  <div className="marketing-proof-avatar">M</div>
                  <div className="marketing-proof-avatar">O</div>
                  <div className="marketing-proof-avatar">B</div>
                </div>
                <span>Editorial layouts, tonal depth, and a cleaner guided perspective.</span>
              </div>
            </div>

            <div className="marketing-hero-visual">
              <div className="marketing-screen">
                <div className="marketing-terminal">
                  <div className="marketing-terminal-window">
                    <strong>Simulate. Diagnose. Reframe.</strong>
                    <p>
                      The new stitched frontend trades rigid borders for layered surfaces and clearer
                      movement through the product.
                    </p>
                  </div>
                </div>
                <div className="marketing-insight-card">
                  <strong>Mobius insight</strong>
                  <p>
                    Great preparation is not only repetition. It is remembering why an answer
                    worked, where it broke, and how to reuse the strongest pattern later.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <h2>Built around core career tracks</h2>
            <p>
              Each track keeps the same premium visual system while emphasizing different stress
              patterns and coaching needs.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {tracks.map((track) => (
              <article key={track.id} className="marketing-feature-card">
                <div className="marketing-feature-icon">{track.icon}</div>
                <h3>{track.title}</h3>
                <p>{track.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-split-card">
            <div>
              <p className="panel-label">The Luminary engine</p>
              <h3 style={{ fontSize: "2.25rem", letterSpacing: "-0.06em" }}>
                Feedback that catches more than correctness.
              </h3>
              <p className="marketing-copy" style={{ marginTop: "0.8rem" }}>
                Use the interview flow to extract better STAR material, tighter evidence, and more
                reusable decision logic from the exact answers you already gave.
              </p>
            </div>
            <div className="marketing-luminary">
              <div className="marketing-luminary-card">
                <strong>AI signal capture</strong>
                <p>
                  Mobius keeps the context around delivery quality, pressure, and structure so the
                  final report is useful for your next real conversation.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-cta-band">
            <div>
              <h2>Ready to replace the old interface?</h2>
              <p>
                This stitched landing direction is now aligned with the rest of the workspace:
                lighter surfaces, deeper typography, and less dashboard clutter.
              </p>
            </div>
            <Link href={homeHref} className="primary-button">
              {viewer ? "Enter workspace" : "Request access"}
            </Link>
          </div>

          <footer className="marketing-footer">
            <span>Mobius Project</span>
            <div className="marketing-link-row">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Architecture</span>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
