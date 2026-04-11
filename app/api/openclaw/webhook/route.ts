import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { runtimeEnv } from "@/lib/env";
import type { OpenClawWebhookPayload } from "@/lib/openclaw/types";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Validate HMAC-SHA256 signature if shared secret is configured
    if (runtimeEnv.openclawSharedSecret) {
      const signature = request.headers.get("x-openclaw-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      const expected = createHmac("sha256", runtimeEnv.openclawSharedSecret)
        .update(rawBody)
        .digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody) as OpenClawWebhookPayload;

    // TODO: store notification in DataStore when Phase 4 DataStore methods are ready

    console.log("[openclaw-webhook]", payload.event, payload.cronJobName, payload.timestamp);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
