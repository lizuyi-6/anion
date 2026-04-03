import Link from "next/link";
import { notFound } from "next/navigation";

import { AcceptOfferButton } from "@/components/accept-offer-button";
import { RadarChart } from "@/components/radar-chart";
import { ReportStatusPanel } from "@/components/report-status-panel";
import { SessionShell } from "@/components/session-shell";
import { formatFindingCategory, formatFindingSeverity, formatSessionStatus } from "@/lib/domain";
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

  const strongestScore = report
    ? [...report.scores].sort((left, right) => right.score - left.score)[0]
    : null;
  const weakestScore = report
    ? [...report.scores].sort((left, right) => left.score - right.score)[0]
    : null;

  return (
    <SessionShell
      viewer={viewer}
      activeHref="/"
      stage="debrief"
      eyebrow="复盘洞察"
      title="把这一轮训练真正读懂"
      description="这里不只是展示结果，而是把亮点证据、关键短板和下一周行动建议整理成可继续推进的闭环。"
      supportingMeta={[
        { label: "当前状态", value: formatSessionStatus(session.status) },
        { label: "目标公司", value: session.config.targetCompany },
        { label: "下一步", value: "生成行动计划" },
      ]}
    >
      {!report ? (
        <ReportStatusPanel sessionId={sessionId} initialError={session.analysisError ?? null} />
      ) : (
        <div className="workspace-grid">
          <section className="workspace-summary-grid">
            <article className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="panel-label">本轮结论</p>
                  <h3>{report.findings[0]?.title ?? "继续推进下一步"}</h3>
                </div>
              </div>
              <p className="hero-copy">
                {strongestScore && weakestScore
                  ? `你在「${strongestScore.label}」上表现最好，目前最值得优先修正的是「${weakestScore.label}」。`
                  : "这轮训练已经完成，下面的复盘会告诉你最该优先调整的地方。"}
              </p>
            </article>

            <article className="workspace-card workspace-highlight-card">
              <div className="section-head">
                <div>
                  <p className="panel-label">下一步</p>
                  <h3>把复盘转成行动计划</h3>
                </div>
              </div>
              <p className="hero-copy">
                不要把这份复盘留在报告页。先把高风险回答、下周计划和关键场景练习接进后续行动。
              </p>
              <div className="action-row">
                <AcceptOfferButton sessionId={session.id} status={session.status} />
                <Link href="/hub" className="secondary-button">
                  查看行动计划页
                </Link>
              </div>
            </article>
          </section>

          <RadarChart report={report} />

          <section className="workspace-summary-grid">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">亮点证据</p>
                  <h3>这轮训练里最值得保留的内容</h3>
                </div>
              </div>
              <div className="stack-md">
                {report.evidenceAnchors.slice(0, 3).map((anchor) => (
                  <article key={anchor.id} className="report-block">
                    <strong>{anchor.label}</strong>
                    <p>{anchor.excerpt}</p>
                    <p className="muted-copy">{anchor.note}</p>
                  </article>
                ))}
                {report.starStories.slice(0, 2).map((story) => (
                  <article key={story.title} className="report-block">
                    <strong>{story.title}</strong>
                    <p>{story.result}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">下一周行动建议</p>
                  <h3>先做这些，再继续下一轮训练</h3>
                </div>
              </div>
              <ul className="flat-list">
                {report.trainingPlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="panel-label">关键短板</p>
                <h3>这些问题会直接影响下一次真实对话</h3>
              </div>
            </div>
            <div className="stack-md">
              {report.findings.map((finding) => (
                <article key={finding.title} className="report-block">
                  <div className="chip-row">
                    <span className="status-pill">{formatFindingSeverity(finding.severity)}</span>
                    <span className="status-pill subtle">
                      {formatFindingCategory(finding.category)}
                    </span>
                  </div>
                  <h4>{finding.title}</h4>
                  <p>{finding.detail}</p>
                  <p className="muted-copy">{finding.impact}</p>
                  <p className="muted-copy">{finding.recommendation}</p>
                </article>
              ))}
            </div>
          </section>

          {memoryProfile ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">可复用信号</p>
                  <h3>这轮训练沉淀下来的长期信息</h3>
                </div>
              </div>
              <div className="card-grid">
                <div className="metric-card wide">
                  <strong>优势</strong>
                  {memoryProfile.skills.map((item) => (
                    <p key={item.label}>{item.label}</p>
                  ))}
                </div>
                <div className="metric-card wide">
                  <strong>短板</strong>
                  {memoryProfile.gaps.map((item) => (
                    <p key={item.label}>{item.label}</p>
                  ))}
                </div>
                <div className="metric-card wide">
                  <strong>行为特征</strong>
                  {memoryProfile.behaviorTraits.map((item) => (
                    <p key={item.label}>{item.label}</p>
                  ))}
                </div>
                <div className="metric-card wide">
                  <strong>高光时刻</strong>
                  {memoryProfile.wins.map((item) => (
                    <p key={item.label}>{item.label}</p>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </SessionShell>
  );
}
