import Link from "next/link";
import { notFound } from "next/navigation";

import { AcceptOfferButton } from "@/components/accept-offer-button";
import { AppFrame } from "@/components/app-frame";
import { RadarChart } from "@/components/radar-chart";
import { ReportStatusPanel } from "@/components/report-status-panel";
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

  return (
    <AppFrame
      viewer={viewer}
      title="终局透视报告"
      subtitle="雷达、证据锚点、STAR 高光和可复用记忆，都从同一条面试轨迹里提纯出来。"
      shellMode="interview"
    >
      {!report ? (
        <ReportStatusPanel sessionId={sessionId} initialError={session.analysisError ?? null} />
      ) : (
        <div className="stack-lg">
          <RadarChart report={report} />

          {report.evidenceAnchors.length > 0 ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">Evidence Anchors</p>
                  <h3>带证据锚点的关键切片</h3>
                </div>
              </div>
              <div className="card-grid">
                {report.evidenceAnchors.map((anchor) => (
                  <article key={anchor.id} className="report-block">
                    <span className="eyebrow">{anchor.label}</span>
                    <h4>{anchor.speakerLabel}</h4>
                    <p>{anchor.excerpt}</p>
                    <p className="muted-copy">{anchor.note}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="panel-label">Findings</p>
                <h3>Code / logic findings</h3>
              </div>
            </div>
            <div className="stack-md">
              {report.findings.map((finding) => (
                <article key={finding.title} className="report-block">
                  <div className="chip-row">
                    <span className="status-pill">{finding.severity}</span>
                    <span className="status-pill subtle">{finding.category}</span>
                  </div>
                  <h4>{finding.title}</h4>
                  <p>{finding.detail}</p>
                  <p className="muted-copy">{finding.impact}</p>
                  <p className="muted-copy">{finding.recommendation}</p>
                  {report.evidenceAnchors
                    .filter((anchor) => finding.evidenceTurnIds.includes(anchor.sourceTurnId))
                    .map((anchor) => (
                      <blockquote key={anchor.id} className="evidence-quote">
                        <strong>{anchor.label}</strong>
                        <p>{anchor.excerpt}</p>
                      </blockquote>
                    ))}
                </article>
              ))}
            </div>
          </section>

          <section className="card-grid">
            <div className="panel">
              <p className="panel-label">STAR</p>
              <h3>Reverse-engineered highlights</h3>
              {report.starStories.map((story) => (
                <article key={story.title} className="report-block">
                  <h4>{story.title}</h4>
                  <p>S: {story.situation}</p>
                  <p>T: {story.task}</p>
                  <p>A: {story.action}</p>
                  <p>R: {story.result}</p>
                </article>
              ))}
            </div>
            <div className="panel">
              <p className="panel-label">Training Plan</p>
              <h3>Next round training</h3>
              <ul className="flat-list">
                {report.trainingPlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="panel-label">B1 / Memory Refactoring</p>
                <h3>Extracted memory graph</h3>
              </div>
            </div>
            {memoryProfile ? (
              <div className="stack-md">
                <div className="card-grid">
                  <div className="metric-card wide">
                    <strong>Skills</strong>
                    {memoryProfile.skills.map((item) => (
                      <p key={item.label}>{item.label}</p>
                    ))}
                  </div>
                  <div className="metric-card wide">
                    <strong>Gaps</strong>
                    {memoryProfile.gaps.map((item) => (
                      <p key={item.label}>{item.label}</p>
                    ))}
                  </div>
                  <div className="metric-card wide">
                    <strong>Traits</strong>
                    {memoryProfile.behaviorTraits.map((item) => (
                      <p key={item.label}>{item.label}</p>
                    ))}
                  </div>
                  <div className="metric-card wide">
                    <strong>Wins</strong>
                    {memoryProfile.wins.map((item) => (
                      <p key={item.label}>{item.label}</p>
                    ))}
                  </div>
                </div>
                {memoryProfile.replayMoments.length > 0 ? (
                  <div className="memory-reel">
                    {memoryProfile.replayMoments.map((moment) => (
                      <article key={moment.id} className="memory-card">
                        <span className="eyebrow">{moment.title}</span>
                        <p>{moment.summary}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted-copy">Memory profile has not been generated yet.</p>
            )}
          </section>

          <section className="panel transition-panel">
            <div className="section-head">
              <div>
                <p className="panel-label">B2 / State Transition</p>
                <h3>Accept Offer</h3>
              </div>
            </div>
            <p className="hero-copy">
              这一步会把系统从敌对诊断协议切换为忠诚副驾协议，并在转场后激活你的记忆图谱。
            </p>
            <div className="action-row">
              <AcceptOfferButton sessionId={session.id} status={session.status} />
              <Link href="/hub/strategy" className="secondary-button inline-button">
                Peek Command Center
              </Link>
            </div>
          </section>
        </div>
      )}
    </AppFrame>
  );
}
