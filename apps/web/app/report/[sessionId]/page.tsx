import Link from "next/link";
import { notFound } from "next/navigation";

import { AcceptOfferButton } from "@/components/accept-offer-button";
import { HubShell } from "@/components/hub-shell";
import { RadarChart } from "@/components/radar-chart";
import { ReportActions } from "@/components/report-actions";
import { ReportStatusPanel } from "@/components/report-status-panel";
import { formatFindingCategory, formatFindingSeverity } from "@/lib/domain";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { getSessionDiagnostics } from "@/lib/server/services/analysis";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const { session, report, memoryProfile } = await getSessionDiagnostics(sessionId, store);

  if (!session) {
    notFound();
  }

  if (!report) {
    return (
      <HubShell viewer={viewer} activeTrack={session.config.rolePack}>
        <div className="workspace-grid">
          <header className="workspace-page-head">
            <div>
              <h1>AI Diagnostic Report</h1>
              <p>
                The analysis is still running. This page will refresh itself as soon as the report
                and memory profile are available.
              </p>
            </div>
          </header>
          <ReportStatusPanel sessionId={sessionId} initialError={session.analysisError ?? null} />
        </div>
      </HubShell>
    );
  }

  const overallScore = Math.round(
    report.scores.reduce((total, item) => total + item.score, 0) / report.scores.length,
  );
  const topScores = [...report.scores].sort((left, right) => right.score - left.score).slice(0, 4);
  const quote =
    memoryProfile?.replayMoments[0]?.summary ??
    report.evidenceAnchors[0]?.excerpt ??
    report.findings[0]?.detail;

  return (
    <HubShell viewer={viewer} activeTrack={session.config.rolePack}>
      <div className="workspace-grid">
        <header className="workspace-page-head">
          <div>
            <div className="chip-row">
              <span className="workspace-pill primary">Diagnostic report</span>
            </div>
            <h1>AI Diagnostic Report</h1>
            <p>
              Review the strongest signals from the session, surface what needs work, and transition
              directly into the hub when you are ready to move from feedback to action.
            </p>
          </div>
          <ReportActions />
        </header>

        <section className="report-top-grid">
          <article className="workspace-card report-score-card">
            <p className="panel-label">Readiness score</p>
            <div
              className="report-score-ring"
              style={{ ["--score" as string]: String(overallScore) }}
            >
              <div className="report-score-meta">
                <strong>{overallScore}%</strong>
                <span>Above average</span>
              </div>
            </div>
            <p className="hero-copy">
              Your current diagnostic profile sits in a strong range, with the best signals showing
              up in decision framing, ownership, and strategic structure.
            </p>
          </article>

          <RadarChart report={report} />
        </section>

        <section className="report-highlight-grid">
          <article className="workspace-card">
            <div className="section-head">
              <div>
                <p className="panel-label">Core strengths</p>
                <h3>Where the session was strongest</h3>
              </div>
            </div>
            <div className="metric-grid">
              {topScores.map((score) => (
                <div key={score.key} className="metric-card">
                  <strong>
                    {score.label} · {score.score}
                  </strong>
                  <p>{score.signal}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="workspace-card">
            <div className="section-head">
              <div>
                <p className="panel-label">Growth plan</p>
                <h3>What to sharpen next</h3>
              </div>
            </div>
            <div className="report-actions-list">
              {report.trainingPlan.slice(0, 3).map((item) => (
                <div key={item} className="report-block">
                  <strong>{item}</strong>
                </div>
              ))}
              {report.findings.slice(0, 2).map((finding) => (
                <div key={finding.title} className="report-block">
                  <strong>{finding.title}</strong>
                  <p>{finding.recommendation}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="workspace-card workspace-quote-card">
          <div className="stack-md">
            <div>
              <p className="panel-label">Mobius insight</p>
              <div className="workspace-quote">{quote}</div>
              <p className="workspace-quote-meta">
                Continue into the command center when you want to convert the report into next
                steps, strategy work, or sandbox planning.
              </p>
            </div>
            <div className="action-row">
              <AcceptOfferButton sessionId={session.id} status={session.status} />
              <Link href="/hub" className="secondary-button">
                Open Hub
              </Link>
            </div>
          </div>
          <div className="workspace-art-card" aria-hidden="true" />
        </section>

        <section className="workspace-card">
          <div className="section-head">
            <div>
              <p className="panel-label">Evidence and findings</p>
              <h3>Anchors from the actual session</h3>
            </div>
          </div>
          <div className="workspace-summary-grid">
            <div className="stack-md">
              {report.evidenceAnchors.slice(0, 4).map((anchor) => (
                <blockquote key={anchor.id} className="evidence-quote">
                  <strong>
                    {anchor.label} · {anchor.speakerLabel}
                  </strong>
                  <p>{anchor.excerpt}</p>
                  <p className="muted-copy">{anchor.note}</p>
                </blockquote>
              ))}
            </div>
            <div className="stack-md">
              {report.findings.slice(0, 4).map((finding) => (
                <article key={finding.title} className="report-block">
                  <div className="chip-row">
                    <span className="status-pill">
                      {formatFindingSeverity(finding.severity)}
                    </span>
                    <span className="status-pill subtle">
                      {formatFindingCategory(finding.category)}
                    </span>
                  </div>
                  <h4>{finding.title}</h4>
                  <p>{finding.detail}</p>
                  <p className="muted-copy">{finding.impact}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {memoryProfile ? (
          <section className="workspace-card">
            <div className="section-head">
              <div>
                <p className="panel-label">Memory profile</p>
                <h3>Reusable context pulled from the run</h3>
              </div>
            </div>
            <div className="metric-grid">
              <div className="metric-card">
                <strong>Skills</strong>
                <p>{memoryProfile.skills.slice(0, 3).map((item) => item.label).join(", ")}</p>
              </div>
              <div className="metric-card">
                <strong>Gaps</strong>
                <p>{memoryProfile.gaps.slice(0, 3).map((item) => item.label).join(", ")}</p>
              </div>
              <div className="metric-card">
                <strong>Wins</strong>
                <p>{memoryProfile.wins.slice(0, 3).map((item) => item.label).join(", ")}</p>
              </div>
              <div className="metric-card">
                <strong>Traits</strong>
                <p>
                  {memoryProfile.behaviorTraits
                    .slice(0, 3)
                    .map((item) => item.label)
                    .join(", ")}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </HubShell>
  );
}
