import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getViewer: vi.fn(),
  getDataStore: vi.fn(),
  resolveAiProvider: vi.fn(() => "anthropic"),
  runCommandMode: vi.fn(),
  generateNextInterviewBeat: vi.fn(),
  queueInterviewAnalysis: vi.fn(),
  retryInterviewAnalysis: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  getViewer: routeMocks.getViewer,
}));

vi.mock("@/lib/server/store/repository", () => ({
  getDataStore: routeMocks.getDataStore,
}));

vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return {
    ...actual,
    resolveAiProvider: routeMocks.resolveAiProvider,
  };
});

vi.mock("@/lib/server/services/command-center", () => ({
  runCommandMode: routeMocks.runCommandMode,
}));

vi.mock("@/lib/server/services/interview", () => ({
  generateNextInterviewBeat: routeMocks.generateNextInterviewBeat,
}));

vi.mock("@/lib/server/services/analysis", () => ({
  queueInterviewAnalysis: routeMocks.queueInterviewAnalysis,
  retryInterviewAnalysis: routeMocks.retryInterviewAnalysis,
}));

const viewer = {
  id: "viewer_1",
  displayName: "Abraham",
  isDemo: true,
  workspaceMode: "command_center" as const,
  preferredRolePack: "engineering" as const,
};

const session = {
  id: "session_1",
  userId: viewer.id,
  status: "live" as const,
  config: {
    rolePack: "engineering" as const,
    targetCompany: "Anthropic",
    industry: "AI",
    level: "Senior",
    jobDescription: "Build reliable systems and explain trade-offs clearly under pressure.",
    interviewers: ["hacker"],
    materials: [],
    candidateName: "Abraham",
  },
  directorState: {
    openLoops: [],
    pressureScore: 42,
    conflictBudget: 1,
    nextSpeakerId: "hacker",
    needsInterrupt: false,
    needsConflict: false,
    round: 0,
    latestAssessment: "",
  },
  currentPressure: 42,
  createdAt: "2026-03-27T00:00:00.000Z",
  updatedAt: "2026-03-27T00:00:00.000Z",
};

describe("AI API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    routeMocks.getViewer.mockResolvedValue(viewer);
  });

  it("returns structured JSON errors for command mode failures", async () => {
    const { AiProviderFailure } = await import("@/lib/ai/errors");
    routeMocks.getDataStore.mockResolvedValue({
      getActiveMemoryContext: vi.fn().mockResolvedValue(null),
    });
    routeMocks.runCommandMode.mockRejectedValue(
      new AiProviderFailure({
        provider: "anthropic",
        message: "Anthropic request failed: invalid API key",
        retryable: false,
      }),
    );

    const { POST } = await import("@/app/api/command/[mode]/route");
    const response = await POST(
      new Request("http://localhost/api/command/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: "debug this issue",
          attachments: [],
        }),
      }),
      { params: Promise.resolve({ mode: "copilot" }) },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "ai_provider_error",
      message: "Anthropic request failed: invalid API key",
      provider: "anthropic",
      retryable: false,
    });
  });

  it("keeps SSE success responses for interview turns", async () => {
    routeMocks.getDataStore.mockResolvedValue({
      getSession: vi.fn().mockResolvedValue(session),
      listTurns: vi.fn().mockResolvedValue([]),
    });
    routeMocks.generateNextInterviewBeat.mockResolvedValue({
      events: [
        {
          id: "event_1",
          sessionId: session.id,
          kind: "follow_up",
          speakerId: "hacker",
          speakerLabel: "Hacker",
          pressureDelta: 5,
          message: "Go deeper.",
          rationale: "Need more detail.",
          timestamp: "2026-03-27T00:00:00.000Z",
        },
      ],
    });

    const { POST } = await import("@/app/api/interviews/[sessionId]/turn/route");
    const response = await POST(
      new Request("http://localhost/api/interviews/session_1/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "I would guard the write path first.",
          elapsedSeconds: 90,
        }),
      }),
      { params: Promise.resolve({ sessionId: session.id }) },
    );

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toContain("data: ");
  });

  it("returns structured JSON errors before starting interview SSE when AI fails", async () => {
    const { AiProviderFailure } = await import("@/lib/ai/errors");
    routeMocks.getDataStore.mockResolvedValue({
      getSession: vi.fn().mockResolvedValue(session),
      listTurns: vi.fn().mockResolvedValue([]),
    });
    routeMocks.generateNextInterviewBeat.mockRejectedValue(
      new AiProviderFailure({
        provider: "anthropic",
        message: "Anthropic request failed: upstream timeout",
        retryable: true,
      }),
    );

    const { POST } = await import("@/app/api/interviews/[sessionId]/turn/route");
    const response = await POST(
      new Request("http://localhost/api/interviews/session_1/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "I would guard the write path first.",
          elapsedSeconds: 90,
        }),
      }),
      { params: Promise.resolve({ sessionId: session.id }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ai_provider_error",
      message: "Anthropic request failed: upstream timeout",
      provider: "anthropic",
      retryable: true,
    });
  });

  it("returns structured JSON errors for complete and retry analysis failures", async () => {
    const { AiProviderFailure } = await import("@/lib/ai/errors");
    routeMocks.getDataStore.mockResolvedValue({
      getSession: vi.fn().mockResolvedValue(session),
    });
    routeMocks.queueInterviewAnalysis.mockRejectedValue(
      new AiProviderFailure({
        provider: "anthropic",
        message: "Anthropic request failed: invalid API key",
        retryable: false,
      }),
    );
    routeMocks.retryInterviewAnalysis.mockRejectedValue(
      new AiProviderFailure({
        provider: "anthropic",
        message: "Anthropic request failed: rate limit",
        retryable: true,
      }),
    );

    const completeRoute = await import("@/app/api/interviews/[sessionId]/complete/route");
    const completeResponse = await completeRoute.POST(
      new Request("http://localhost/api/interviews/session_1/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ sessionId: session.id }) },
    );

    expect(completeResponse.status).toBe(502);
    await expect(completeResponse.json()).resolves.toEqual({
      error: "ai_provider_error",
      message: "Anthropic request failed: invalid API key",
      provider: "anthropic",
      retryable: false,
    });

    const retryRoute = await import("@/app/api/reports/[sessionId]/retry/route");
    const retryResponse = await retryRoute.POST(
      new Request("http://localhost/api/reports/session_1/retry", {
        method: "POST",
      }),
      { params: Promise.resolve({ sessionId: session.id }) },
    );

    expect(retryResponse.status).toBe(503);
    await expect(retryResponse.json()).resolves.toEqual({
      error: "ai_provider_error",
      message: "Anthropic request failed: rate limit",
      provider: "anthropic",
      retryable: true,
    });
  });
});
