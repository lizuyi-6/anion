import { notFound } from "next/navigation";

import { AppFrame } from "@/components/app-frame";
import { InterviewConsole } from "@/components/interview-console";
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
    <AppFrame
      viewer={viewer}
      activeHref="/simulator/new"
      title={`${session.config.targetCompany} / ${session.config.level}`}
      subtitle="用短句、证据和因果链活下来。系统会根据回答实时决定是否打断、是否换人以及是否制造冲突。"
      shellMode="interview"
    >
      <InterviewConsole session={session} turns={turns} />
    </AppFrame>
  );
}
