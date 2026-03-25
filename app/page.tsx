import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const sessions = await store.listSessions(viewer.id);

  return (
    <AppFrame
      viewer={viewer}
      activeHref="/"
      title="Project Möbius"
      subtitle="从高压面试沙盒切换到专属职场外脑。首版支持模拟面试、终局报告、Accept Offer 转场与三种中枢工作台。"
    >
      <div className="card-grid">
        <section className="panel">
          <p className="panel-label">A / 面试模拟器</p>
          <h3>千面考官沙盒</h3>
          <p className="hero-copy">
            非线性追问、群面冲突、规则先行的打断机制，以及可沉淀成能力图谱的报告。
          </p>
          <Link href="/simulator/new" className="primary-button inline-button">
            Create New Session
          </Link>
        </section>
        <section className="panel">
          <p className="panel-label">B / Singularity</p>
          <h3>Accept Offer 状态切换</h3>
          <p className="hero-copy">
            当报告确认后，把冷峻考场切换成高科技中枢，系统目标从“找漏洞”改为“补短板并赢下战役”。
          </p>
        </section>
        <section className="panel">
          <p className="panel-label">C / Command Center</p>
          <h3>工程 / 战略 / 沙盒</h3>
          <p className="hero-copy">
            工程副驾、可行性研究生成器和职场博弈沙盘共享同一份长期记忆图谱。
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">Recent Sessions</p>
            <h3>历史会话</h3>
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="muted-copy">
            还没有面试记录。先创建一场会话，把压力测试和记忆图谱跑起来。
          </p>
        ) : (
          <div className="stack-sm">
            {sessions.map((session) => (
              <Link key={session.id} href={`/report/${session.id}`} className="list-row">
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
            ))}
          </div>
        )}
      </section>
    </AppFrame>
  );
}
