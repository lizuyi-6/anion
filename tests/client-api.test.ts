import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeSession,
  retryReport,
  runCommandModeApi,
  streamInterviewTurn,
} from "@/lib/client/api";

describe("client API error handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("surfaces command mode server messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "ai_provider_error",
            message: "Anthropic request failed: invalid API key",
            provider: "anthropic",
            retryable: false,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      runCommandModeApi({
        mode: "copilot",
        input: "debug this issue",
        attachments: [],
      }),
    ).rejects.toThrow("Anthropic request failed: invalid API key");
  });

  it("surfaces interview turn server messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "ai_provider_error",
            message: "Anthropic request failed: upstream timeout",
            provider: "anthropic",
            retryable: true,
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      streamInterviewTurn({
        sessionId: "session_1",
        answer: "go deeper",
        elapsedSeconds: 90,
        onEvent: vi.fn(),
      }),
    ).rejects.toThrow("Anthropic request failed: upstream timeout");
  });

  it("surfaces complete-session server messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "ai_provider_error",
            message: "Anthropic request failed: invalid API key",
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(completeSession("session_1")).rejects.toThrow(
      "Anthropic request failed: invalid API key",
    );
  });

  it("surfaces retry-report server messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "ai_provider_error",
            message: "Anthropic request failed: rate limit",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(retryReport("session_1")).rejects.toThrow(
      "Anthropic request failed: rate limit",
    );
  });
});
