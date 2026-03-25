import { NextResponse } from "next/server";

import { CommandRequestSchema, commandModes } from "@/lib/domain";
import { getViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { runCommandMode } from "@/lib/server/services/command-center";

export async function POST(
  request: Request,
  context: { params: Promise<{ mode: string }> },
) {
  const { mode } = await context.params;

  if (!commandModes.includes(mode as (typeof commandModes)[number])) {
    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  }

  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = CommandRequestSchema.parse(await request.json());
  const store = await getDataStore({ viewer });
  const memoryContext = await store.getActiveMemoryContext(viewer.id);
  const result = await runCommandMode({
    store,
    viewer,
    mode: mode as (typeof commandModes)[number],
    threadId: payload.threadId,
    input: payload.input,
    attachments: payload.attachments,
    memoryContext,
  });

  return NextResponse.json({
    threadId: result.thread.id,
    artifact: result.artifact,
    history: result.history,
  });
}
