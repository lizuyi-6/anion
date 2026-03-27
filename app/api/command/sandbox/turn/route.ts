import { NextResponse } from "next/server";

import { AiProviderFailure } from "@/lib/ai/errors";
import { SandboxTurnRequestSchema } from "@/lib/domain";
import { resolveAiProvider } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import {
  createAiErrorResponse,
  createUnexpectedErrorResponse,
} from "@/lib/server/route-errors";
import { getDataStore } from "@/lib/server/store/repository";
import { generateSandboxBeat } from "@/lib/server/services/command-center";
import { encodeSseEvent } from "@/lib/utils";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const store = await getDataStore({ viewer });
    const payload = SandboxTurnRequestSchema.parse(await request.json());

    const thread = await store.getThread(payload.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const memoryContext = await store.getActiveMemoryContext(viewer.id);

    const event = await generateSandboxBeat({
      store,
      viewer,
      threadId: payload.threadId,
      userMessage: payload.userMessage,
      counterpartRole: payload.counterpartRole,
      counterpartIncentives: payload.counterpartIncentives,
      userRedLine: payload.userRedLine,
      memoryContext,
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(encodeSseEvent("sandbox-turn", event)));
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
