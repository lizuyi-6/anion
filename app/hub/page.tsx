import Link from "next/link";

import { formatAudienceSessionStatus, getNextRecommendedAction, getPrimarySession } from "@/lib/journey";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const sessions = ((await store.listSessions(viewer.id)) ?? []).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const memoryContext = await store.getActiveMemoryContext(viewer.id);

  const latestSession = getPrimarySession(sessions);
  const nextAction = getNextRecommendedAction(viewer, sessions);
  const topGap = memoryContext?.profile.gaps[0];
  const topWin = memoryContext?.profile.wins[0];
  const recentMoments = memoryContext?.timeline.slice(0, 3) ?? [];

  const tasks = [
    {
      href: "/hub/copilot",
      label: "修复一个高风险回答",
      description:
        topGap?.summary ?? "把最近一次训练里最危险的一条回答拆开，找到真正需要改的地方。",
    },
    {
      href: "/hub/strategy",
      label: "生成下一周准备计划",
      description:
        "把复盘结果压成一份下周行动清单，明确先做什么、做到什么算有效。",
    },
    {
      href: "/hub/sandbox",
      label: "练一次高风险沟通场景",
      description:
        "围绕最容易失分的表达或协作场景，先做一次低风险预演。",
    },
  ];

  return (
    <div className="workspace-grid">
      <header className="workspace-page-head">
        <div>
          <p className="panel-label">行动计划</p>
          <h1>把复盘真正变成下周动作</h1>
          <p>
            这里不再是工具中心，而是你把复盘持续推进下去的地方。先看本周重点，再挑一个任务开做。
          </p>
        </div>
        <div className="chip-row">
          <span className="workspace-pill primary">下一步：{nextAction.label}</span>
        </div>
      </header>

      <section className="journey-action-grid">
        <article className="workspace-card workspace-highlight-card">
          <div className="section-head">
            <div>
              <p className="panel-label">本周重点</p>
              <h3>{topGap ? topGap.label : "先完成第一轮模拟"}</h3>
            </div>
          </div>
          <p className="hero-copy">
            {topGap
              ? topGap.summary
              : "你还没有形成可持续的行动计划。先完成一轮模拟和复盘，再回来继续推进。"}
          </p>
          <div className="action-row">
            <Link href={nextAction.href} className="primary-button">
              {nextAction.label}
            </Link>
            {latestSession ? (
              <Link href={`/report/${latestSession.id}`} className="secondary-button">
                回看最近复盘
              </Link>
            ) : null}
          </div>
        </article>

        <article className="workspace-card">
          <div className="section-head">
            <div>
              <p className="panel-label">最近进展</p>
              <h3>{topWin ? topWin.label : "还没有可复用亮点"}</h3>
            </div>
          </div>
          <p className="muted-copy">
            {topWin
              ? topWin.summary
              : "完成第一轮训练后，系统会把你的亮点和短板一起整理出来，方便后续持续追踪。"}
          </p>
          {recentMoments.length > 0 ? (
            <div className="workspace-list">
              {recentMoments.map((moment) => (
                <div key={moment.id} className="workspace-list-item">
                  <strong>{moment.title}</strong>
                  <p>{moment.summary}</p>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="journey-task-grid">
        {tasks.map((task) => (
          <Link key={task.href} href={task.href} className="journey-task-card">
            <span className="panel-label">推荐任务</span>
            <h3>{task.label}</h3>
            <p>{task.description}</p>
          </Link>
        ))}
      </section>

      <section className="workspace-card">
        <div className="section-head">
          <div>
            <p className="panel-label">最近记录</p>
            <h3>最新训练和复盘状态</h3>
          </div>
        </div>
        <div className="workspace-activity-list">
          {sessions.length === 0 ? (
            <p className="muted-copy">
              还没有可用记录。先完成第一轮模拟，行动计划页才会开始变得有内容。
            </p>
          ) : (
            sessions.slice(0, 4).map((session) => (
              <Link key={session.id} href={`/report/${session.id}`} className="workspace-activity-item">
                <div>
                  <strong>{session.config.targetCompany}</strong>
                  <div className="workspace-activity-meta">
                    {session.config.level} · {formatAudienceSessionStatus(session.status)}
                  </div>
                </div>
                <small>{formatDate(session.updatedAt)}</small>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
