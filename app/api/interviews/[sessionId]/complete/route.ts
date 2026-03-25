import { NextResponse } from "next/server";

import { CompleteSessionInputSchema } from "@/lib/domain";
import { getViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { queueInterviewAnalysis } from "@/lib/server/services/analysis";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  CompleteSessionInputSchema.parse(json);

  const store = await getDataStore({ viewer });
  const session = await store.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const analysis = await queueInterviewAnalysis({
    sessionId,
    store,
  });

  return NextResponse.json({
    queued: analysis.queued,
    reportId: analysis.report?.id ?? null,
    memoryProfileId: analysis.memoryProfile?.id ?? null,
  });
}
