import { getAiErrorPayload, toAiProviderFailure } from "../ai/errors";
import type { AiProvider } from "@anion/config";

export function createAiErrorResponse(error: unknown, provider: AiProvider) {
  const failure = toAiProviderFailure(error, provider);

  return Response.json(getAiErrorPayload(failure, provider), {
    status: failure.retryable ? 503 : 502,
  });
}

export function createUnexpectedErrorResponse(error: unknown) {
  console.error("Unexpected server error:", error);

  return Response.json(
    {
      error: "internal_server_error",
      message: "Internal server error",
    },
    { status: 500 },
  );
}
