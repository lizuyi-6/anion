import { NextResponse } from "next/server";

import { getAiErrorPayload, toAiProviderFailure } from "@/lib/ai/errors";
import type { AiProvider } from "@/lib/env";

export function createAiErrorResponse(error: unknown, provider: AiProvider) {
  const failure = toAiProviderFailure(error, provider);

  return NextResponse.json(getAiErrorPayload(failure, provider), {
    status: failure.retryable ? 503 : 502,
  });
}

export function createUnexpectedErrorResponse(error: unknown) {
  console.error("Unexpected server error:", error);

  return NextResponse.json(
    {
      error: "internal_server_error",
      message: "服务器内部错误，请稍后重试。",
    },
    { status: 500 },
  );
}
