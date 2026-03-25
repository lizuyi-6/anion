import { NextResponse } from "next/server";

import { TurnRequestSchema } from "@/lib/domain";
import { getViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { generateNextInterviewBeat } from "@/lib/server/services/interview";
import { encodeSseEvent } from "@/lib/utils";

export async function POST(
  request: Request,
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

  const json = await request.json();
  const payload = TurnRequestSchema.parse(json);
  const turns = await store.listTurns(sessionId);
  const result = await generateNextInterviewBeat({
    store,
    session,
    turns,
    answer: payload.answer,
  });

  const stream = new ReadableStream({
    start(controller) {
      for (const event of result.events) {
        controller.enqueue(new TextEncoder().encode(encodeSseEvent("turn", event)));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
