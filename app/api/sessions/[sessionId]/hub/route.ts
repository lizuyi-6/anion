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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await getDataStore({ viewer });
  const session = await store.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!canActivateCommandCenter(session)) {
    return NextResponse.json(
      { error: "Offer must be accepted before entering the command center" },
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
