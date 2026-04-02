import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  viewer: {
    id: "viewer_1",
    displayName: "Abraham",
    isDemo: true,
    workspaceMode: "command_center" as const,
    preferredRolePack: "engineering" as const,
  },
  getDataStore: vi.fn(),
  getAiProvider: vi.fn(() => ({ provider: "mock" })),
  createJobQueue: vi.fn(() => undefined),
  runCommandMode: vi.fn(),
  generateNextInterviewBeat: vi.fn(),
  queueInterviewAnalysis: vi.fn(),
  retryInterviewAnalysis: vi.fn(),
}));

vi.mock("@anion/infrastructure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anion/infrastructure")>();
  return {
    ...actual,
    buildLocalViewer: vi.fn(() => routeMocks.viewer),
    createJobQueue: routeMocks.createJobQueue,
    getAiProvider: routeMocks.getAiProvider,
    getDataStore: routeMocks.getDataStore,
  };
});

vi.mock("@anion/application", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anion/application")>();
  return {
    ...actual,
    runCommandMode: routeMocks.runCommandMode,
    generateNextInterviewBeat: routeMocks.generateNextInterviewBeat,
    queueInterviewAnalysis: routeMocks.queueInterviewAnalysis,
    retryInterviewAnalysis: routeMocks.retryInterviewAnalysis,
  };
});

const session = {
  id: "session_1",
  userId: routeMocks.viewer.id,
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
  let app: Awaited<ReturnType<(typeof import("../apps/api/src/server"))["buildApiServer"]>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { buildApiServer } = await import("../apps/api/src/server");
    app = buildApiServer();
  });

  afterEach(async () => {
    await app.close();
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

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/command/copilot",
      payload: {
        input: "debug this issue",
        attachments: [],
      },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
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

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/interviews/${session.id}/turn`,
      payload: {
        answer: "I would guard the write path first.",
        elapsedSeconds: 90,
      },
    });

    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain("data: ");
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

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/interviews/${session.id}/turn`,
      payload: {
        answer: "I would guard the write path first.",
        elapsedSeconds: 90,
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
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

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/interviews/${session.id}/complete`,
      payload: {},
    });

    expect(completeResponse.statusCode).toBe(502);
    expect(completeResponse.json()).toEqual({
      error: "ai_provider_error",
      message: "Anthropic request failed: invalid API key",
      provider: "anthropic",
      retryable: false,
    });

    const retryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/reports/${session.id}/retry`,
    });

    expect(retryResponse.statusCode).toBe(503);
    expect(retryResponse.json()).toEqual({
      error: "ai_provider_error",
      message: "Anthropic request failed: rate limit",
      provider: "anthropic",
      retryable: true,
    });
  });
});
