import { NextResponse } from "next/server";
import type { OpenClawWebhookPayload } from "@/lib/openclaw/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as OpenClawWebhookPayload;

    // TODO: validate signature from OPENCLAW_SHARED_SECRET
    // TODO: store notification in DataStore when Phase 4 DataStore methods are ready

    console.log("[openclaw-webhook]", payload.event, payload.cronJobName, payload.timestamp);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
