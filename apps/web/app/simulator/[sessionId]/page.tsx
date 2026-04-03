import { notFound } from "next/navigation";

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
  return <InterviewConsole session={session} turns={turns} />;
}
