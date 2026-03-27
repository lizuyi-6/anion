import { NextResponse } from "next/server";

import { getViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { canActivateCommandCenter } from "@/lib/server/services/session-state";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const store = await getDataStore({ viewer });
  const session = await store.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "未找到会话" }, { status: 404 });
  }

  if (!canActivateCommandCenter(session)) {
    return NextResponse.json(
      { error: "必须先接受录用，才能进入指挥中心" },
      { status: 409 },
    );
  }

  await store.updateSession(sessionId, {
    status: "hub_active",
  });
  await store.setWorkspaceMode(viewer.id, "command_center");
  await store.activateMemoryProfile(sessionId, viewer.id);

  return NextResponse.json({ ok: true, nextStatus: "hub_active" });
}
