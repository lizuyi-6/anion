import { NextResponse } from "next/server";

import { TurnRequestSchema } from "@/lib/domain";
import { resolveAiProvider } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import {
  createAiErrorResponse,
  createUnexpectedErrorResponse,
} from "@/lib/server/route-errors";
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
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const store = await getDataStore({ viewer });
    const session = await store.getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "未找到会话" }, { status: 404 });
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
  } catch (error) {
    if (error instanceof Error && error.name === "AiProviderFailure") {
      return createAiErrorResponse(error, resolveAiProvider());
    }
    return createUnexpectedErrorResponse(error);
  }
}
