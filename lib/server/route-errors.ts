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
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Unexpected server error.";

  return NextResponse.json(
    {
      error: "internal_server_error",
      message,
    },
    { status: 500 },
  );
}
