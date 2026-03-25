import { NextResponse } from "next/server";

import { CreateSessionInputSchema } from "@/lib/domain";
import { getViewer } from "@/lib/server/auth";
import { createInterviewSession } from "@/lib/server/services/interview";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const config = CreateSessionInputSchema.parse(json);
  const session = await createInterviewSession(viewer, config);

  return NextResponse.json({ sessionId: session.id });
}
