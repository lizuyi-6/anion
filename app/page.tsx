import Link from "next/link";

import { JourneyShell } from "@/components/journey-shell";
import { formatRolePackLabel } from "@/lib/domain";
import {
  formatAudienceSessionStatus,
  formatJourneyStage,
  getJourneyStageFromStatus,
  getJourneySteps,
  getNextRecommendedAction,
  getPrimarySession,
} from "@/lib/journey";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const sessions = ((await store.listSessions(viewer.id)) ?? []).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  const latestSession = getPrimarySession(sessions);
  const nextAction = getNextRecommendedAction(viewer, sessions);
  const currentStage = latestSession
    ? getJourneyStageFromStatus(latestSession.status)
    : nextAction.stage;
  const journeySteps = getJourneySteps();

  return (
    <JourneyShell viewer={viewer} activeHref="/">
      <section className="journey-hero-card">
        <div className="journey-hero-copy">
          <span className="landing-kicker">我的旅程</span>
          <h1>从一次准备，走到持续提升。</h1>
          <p>
            这里不会把功能堆成工具箱，而是根据你当前阶段，只给你最该做的下一步。
          </p>

          <div className="journey-next-card">
            <div className="chip-row">
              <span className="workspace-pill primary">{formatJourneyStage(nextAction.stage)}</span>
              {latestSession ? (
                <span className="workspace-pill">
                  {formatAudienceSessionStatus(latestSession.status)}
                </span>
              ) : null}
            </div>
            <h2>{nextAction.label}</h2>
            <p>{nextAction.description}</p>
            <div className="journey-hero-actions">
              <Link href={nextAction.href} className="primary-button">
                {nextAction.label}
              </Link>
              <Link href="/landing#journey" className="secondary-button">
                查看陪跑方式
              </Link>
            </div>
          </div>
        </div>

        <aside className="journey-summary-card">
          <span className="panel-label">当前概览</span>
          <h2>{latestSession ? "你已经在旅程中" : "你还没开始第一轮准备"}</h2>
          <div className="journey-summary-list">
            <div className="journey-summary-item">
              <strong>默认受众</strong>
              <span>{formatRolePackLabel(viewer.preferredRolePack)}岗位</span>
            </div>
            <div className="journey-summary-item">
              <strong>当前阶段</strong>
              <span>{formatJourneyStage(currentStage)}</span>
            </div>
            <div className="journey-summary-item">
              <strong>最近更新</strong>
              <span>{latestSession ? formatDate(latestSession.updatedAt) : "还没有记录"}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="journey-stage-grid">
        {journeySteps.map((step) => {
          const latestIndex = journeySteps.findIndex((item) => item.id === currentStage);
          const stepIndex = journeySteps.findIndex((item) => item.id === step.id);
          const state =
            stepIndex < latestIndex ? "done" : stepIndex === latestIndex ? "active" : "upcoming";

          return (
            <article key={step.id} className={`journey-stage-card ${state}`}>
              <span className="journey-stage-tag">{step.label}</span>
              <h3>{step.description}</h3>
            </article>
          );
        })}
      </section>

      <section className="journey-support-grid">
        <article className="workspace-card">
          <div className="section-head">
            <div>
              <p className="panel-label">最近进展</p>
              <h3>最近几次训练记录</h3>
            </div>
          </div>
          <div className="overview-session-list">
            {sessions.length === 0 ? (
              <p className="muted-copy">
                还没有开始第一轮训练。先创建准备目标，后面的模拟、复盘和行动计划会自动接上。
              </p>
            ) : (
              sessions.slice(0, 4).map((session) => (
                <Link key={session.id} href={`/report/${session.id}`} className="list-row">
                  <div>
                    <strong>{session.config.targetCompany}</strong>
                    <p className="muted-copy">
                      {session.config.level} · {formatAudienceSessionStatus(session.status)}
                    </p>
                  </div>
                  <small>{formatDate(session.updatedAt)}</small>
                </Link>
              ))
            )}
          </div>
        </article>

        <article className="workspace-card workspace-highlight-card">
          <div className="section-head">
            <div>
              <p className="panel-label">下一步提醒</p>
              <h3>始终只做当前阶段最重要的一件事</h3>
            </div>
          </div>
          <p className="hero-copy">
            {latestSession
              ? `你最近一次准备停留在“${formatJourneyStage(
                  currentStage,
                )}”阶段。先完成这一环，再进入下一步，体验会最连贯。`
              : "如果你是第一次进入，先创建目标岗位和材料。先把目标说清楚，比先开工具更重要。"}
          </p>
        </article>
      </section>
    </JourneyShell>
  );
}
