import type { AiProvider } from "@/lib/env";

export type AiErrorPayload = {
  error: "ai_provider_error";
  message: string;
  provider: AiProvider;
  retryable: boolean;
};

function providerLabel(provider: AiProvider) {
  switch (provider) {
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "mock":
      return "Mock AI";
  }
}

function getStatusCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

function isRetryableStatus(status: number | undefined) {
  if (status === undefined) {
    return false;
  }

  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function normalizeMessage(error: unknown, provider: AiProvider) {
  const prefix = `${providerLabel(provider)} request failed`;
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : "Unknown upstream error.";

  if (detail.startsWith(prefix)) {
    return detail;
  }

  return `${prefix}: ${detail}`;
}

export class AiProviderFailure extends Error {
  readonly provider: AiProvider;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly code = "ai_provider_error" as const;

  constructor(params: {
    provider: AiProvider;
    message: string;
    retryable: boolean;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.name = "AiProviderFailure";
    this.provider = params.provider;
    this.retryable = params.retryable;
    this.statusCode = params.statusCode;
  }
}

export function toAiProviderFailure(error: unknown, provider: AiProvider) {
  if (error instanceof AiProviderFailure) {
    return error;
  }

  const statusCode = getStatusCode(error);

  return new AiProviderFailure({
    provider,
    message: normalizeMessage(error, provider),
    retryable: isRetryableStatus(statusCode),
    statusCode,
    cause: error,
  });
}

export function getAiErrorPayload(error: unknown, provider: AiProvider): AiErrorPayload {
  const failure = toAiProviderFailure(error, provider);

  return {
    error: failure.code,
    message: failure.message,
    provider: failure.provider,
    retryable: failure.retryable,
  };
}
