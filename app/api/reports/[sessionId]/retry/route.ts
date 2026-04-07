import { NextResponse } from "next/server";

import { resolveAiProvider } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import { handleError } from "@/lib/server/route-errors";
import { getDataStore } from "@/lib/server/store/repository";
import { retryInterviewAnalysis } from "@/lib/server/services/analysis";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const store = await getDataStore({ viewer });

  try {
    const result = await retryInterviewAnalysis({
      sessionId,
      store,
    });

    return NextResponse.json({
      queued: result.queued,
      reportId: result.report?.id ?? null,
      memoryProfileId: result.memoryProfile?.id ?? null,
    });
  } catch (error) {
    return handleError(error, resolveAiProvider());
  }
}
