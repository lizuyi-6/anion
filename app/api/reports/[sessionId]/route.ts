import { NextResponse } from "next/server";

import { getViewer } from "@/lib/server/auth";
import { createUnexpectedErrorResponse } from "@/lib/server/route-errors";
import { getDataStore } from "@/lib/server/store/repository";
import { getSessionDiagnostics } from "@/lib/server/services/analysis";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const { sessionId } = await context.params;
    const store = await getDataStore({ viewer });
    const diagnostics = await getSessionDiagnostics(sessionId, store);

    if (!diagnostics.session) {
      return NextResponse.json({ error: "未找到会话" }, { status: 404 });
    }

    return NextResponse.json(diagnostics);
  } catch (error) {
    return createUnexpectedErrorResponse(error);
  }
}
