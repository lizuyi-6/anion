import { NextResponse } from "next/server";

import { ChatRequestSchema } from "@/lib/domain";
import { resolveAiProvider } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import { handleError } from "@/lib/server/route-errors";
import { getDataStore } from "@/lib/server/store/repository";
import { runCommandMode } from "@/lib/server/services/command-center";
import { inferModeFromContent } from "@/components/command-detector";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { threadId, message, mode, attachments } = parsed.data;

    const viewer = await getViewer();
    if (!viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await getDataStore({ viewer });

    // Resolve actual command mode
    const resolvedMode = mode === "auto"
      ? inferModeFromContent(message)
      : mode;

    const memoryContext = await store.getActiveMemoryContext(viewer.id);

    const result = await runCommandMode({
      store,
      viewer,
      mode: resolvedMode,
      threadId,
      input: message,
      attachments,
      memoryContext,
    });

    return NextResponse.json({
      threadId: result.thread.id,
      mode: resolvedMode,
      detectedMode: mode === "auto" ? resolvedMode : undefined,
      artifact: result.artifact,
      history: result.history,
    });
  } catch (error) {
    return handleError(error, resolveAiProvider());
  }
}
