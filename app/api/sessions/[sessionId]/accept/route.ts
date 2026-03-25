import { NextResponse } from "next/server";

import { getViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { canAcceptOffer } from "@/lib/server/services/session-state";

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

  if (!canAcceptOffer(session)) {
    return NextResponse.json(
      { error: "Report is not ready for acceptance" },
      { status: 409 },
    );
  }

  await store.updateSession(sessionId, {
    status: "accepted",
    acceptedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, nextStatus: "accepted" });
}
