import Link from "next/link";

import { PublicShell } from "@/components/public-shell";
import { getViewer } from "@/lib/server/auth";

const journeyCards = [
  {
    id: "goal",
    label: "目标设定",
    title: "先把这轮准备要拿下什么说清楚",
    description: "明确岗位、材料和关注重点，避免一上来就掉进杂乱的工具选择。",
  },
  {
    id: "practice",
    label: "模拟训练",
    title: "在真实压力里练一次",
    description: "围绕岗位目标和材料进入高压模拟，把表达、判断和证据都拉到真实场景里。",
  },
  {
    id: "debrief",
    label: "复盘洞察",
    title: "把一次训练变成看得懂的复盘",
    description: "不是只给分，而是告诉你亮点来自哪里、短板卡在哪一步、下一周先修什么。",
  },
  {
    id: "action",
    label: "行动计划",
    title: "把复盘转成持续提升的动作",
    description: "围绕高风险回答、下周计划和关键沟通场景继续推进，而不是把复盘留在报告里。",
  },
];

export default async function LandingPage() {
  const viewer = await getViewer();
  const hasAccountViewer = viewer && !viewer.isDemo;
  const primaryHref = hasAccountViewer ? "/" : "/auth/sign-in";

  return (
    <PublicShell
      viewer={viewer}
      actions={
        hasAccountViewer ? (
          <Link href="/" className="public-link-button">
            进入我的旅程
          </Link>
        ) : (
          <Link href="/auth/sign-in" className="public-link-button">
            开始准备
          </Link>
        )
      }
    >
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker">工程候选人的职业陪跑平台</span>
          <h1>从一次准备，走到持续提升。</h1>
          <p>
            Mobius 帮你先明确目标，再把模拟训练、复盘洞察和行动计划串成一条连续旅程。
            你看到的不是一堆工具，而是下一步该怎么走。
          </p>
          <div className="landing-hero-actions">
            <Link href={primaryHref} className="primary-button">
              {hasAccountViewer ? "进入我的旅程" : "开始准备"}
            </Link>
            <a href="#journey" className="secondary-button">
              查看陪跑方式
            </a>
          </div>
        </div>

        <div className="landing-hero-card">
          <span className="panel-label">核心旅程</span>
          <h2>目标设定 → 模拟训练 → 复盘洞察 → 行动计划</h2>
          <p className="muted-copy">
            默认先服务工程候选人，把一次面试准备真正做成持续提升的闭环。
          </p>
          <div className="landing-stage-mini-list">
            {journeyCards.map((card) => (
              <div key={card.id} className="landing-stage-mini-item">
                <strong>{card.label}</strong>
                <span>{card.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="journey" className="landing-section">
        <div className="landing-section-head">
          <span className="panel-label">陪跑方式</span>
          <h2>每一页都只服务当前阶段，不让用户在流程里迷路</h2>
          <p>
            这套界面不再把功能并列摆出来，而是根据你所处的阶段，只显示最该做的下一步。
          </p>
        </div>

        <div className="landing-journey-grid">
          {journeyCards.map((card) => (
            <article key={card.id} className="landing-journey-card">
              <span className="landing-journey-index">{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-proof-grid">
        <article className="landing-proof-card">
          <span className="panel-label">为什么不是工具箱</span>
          <h3>首页不会先问你要不要开 Copilot，而是先告诉你该做哪一步。</h3>
          <p className="muted-copy">
            工具能力依然都在，但它们会藏在任务背后。用户先看到任务，再看到完成任务的方法。
          </p>
        </article>

        <article className="landing-proof-card accent">
          <span className="panel-label">默认受众</span>
          <h3>先把工程候选人的旅程打磨清楚，再扩展到其他赛道。</h3>
          <p className="muted-copy">
            产品、运营和管理不会消失，但这一版不会再把四条赛道并列当成首页主卖点。
          </p>
        </article>
      </section>

      <section className="landing-cta-band">
        <div>
          <span className="panel-label">开始进入旅程</span>
          <h2>先创建这轮准备目标，再让系统陪你走完整条路径。</h2>
          <p>
            你只需要先说清楚目标岗位和已有材料，后面的模拟、复盘和行动计划会自动接上。
          </p>
        </div>
        <Link href={primaryHref} className="primary-button">
          {hasAccountViewer ? "继续我的旅程" : "开始准备"}
        </Link>
      </section>
    </PublicShell>
  );
}
