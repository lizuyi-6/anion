import { NextResponse } from "next/server";

import { getViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { getReportStatus } from "@/lib/server/services/analysis";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const store = await getDataStore({ viewer });
  const status = await getReportStatus(sessionId, store);

  if (!status) {
    return NextResponse.json({ error: "未找到会话" }, { status: 404 });
  }

  return NextResponse.json(status);
}
