import { NextResponse } from "next/server";

import { CompleteSessionInputSchema } from "@/lib/domain";
import { resolveAiProvider } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import { handleError } from "@/lib/server/route-errors";
import { getDataStore } from "@/lib/server/store/repository";
import { queueInterviewAnalysis } from "@/lib/server/services/analysis";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const json = await request.json();
    CompleteSessionInputSchema.parse(json);

    const store = await getDataStore({ viewer });
    const session = await store.getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "未找到会话" }, { status: 404 });
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
  } catch (error) {
    return handleError(error, resolveAiProvider());
  }
}
