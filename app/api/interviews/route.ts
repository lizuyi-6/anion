import { NextResponse } from "next/server";

import { CreateSessionInputSchema } from "@/lib/domain";
import { resolveAiProvider } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import { handleError } from "@/lib/server/route-errors";
import { createInterviewSession } from "@/lib/server/services/interview";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const config = CreateSessionInputSchema.parse(json);
    const session = await createInterviewSession(viewer, config);

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    return handleError(error, resolveAiProvider());
  }
}
