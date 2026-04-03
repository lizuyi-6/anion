import { notFound } from "next/navigation";

import { InterviewConsole } from "@/components/interview-console";
import { SessionShell } from "@/components/session-shell";
import { formatSessionStatus } from "@/lib/domain";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";

export const dynamic = "force-dynamic";

export default async function SimulatorSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const session = await store.getSession(sessionId);

  if (!session) {
    notFound();
  }

  const turns = await store.listTurns(sessionId);

  return (
    <SessionShell
      viewer={viewer}
      activeHref="/simulator/new"
      stage="practice"
      eyebrow="模拟训练"
      title={`${session.config.targetCompany} · ${session.config.level}`}
      description="这一页只做一件事：在压力里把答案说清楚。结束后会自动进入本轮复盘，不需要再切工具。"
      supportingMeta={[
        { label: "当前状态", value: formatSessionStatus(session.status) },
        { label: "目标岗位", value: session.config.targetCompany },
        { label: "完成后", value: "自动生成本轮复盘" },
      ]}
    >
      <InterviewConsole session={session} turns={turns} />
    </SessionShell>
  );
}
