import { beforeEach, describe, expect, it, vi } from "vitest";

const anthropicMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  parse: vi.fn(),
  create: vi.fn(),
  zodOutputFormat: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(options: unknown) {
      anthropicMocks.constructor(options);
      return {
        options,
        messages: {
          parse: anthropicMocks.parse,
          create: anthropicMocks.create,
        },
      };
    }
  },
}));

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: anthropicMocks.zodOutputFormat,
}));

const commandInput = {
  mode: "copilot" as const,
  viewer: {
    id: "viewer_1",
    displayName: "Abraham",
    isDemo: true,
    workspaceMode: "command_center" as const,
    preferredRolePack: "engineering" as const,
  },
  memoryContext: null,
  prompt: "Find the root cause",
  attachments: [],
  history: [],
};

const strategyInput = {
  ...commandInput,
  mode: "strategy" as const,
};

const strategyPayload = {
  sections: [
    { id: "market", title: "Market", body: "body 1" },
    { id: "problem", title: "Problem", body: "body 2" },
    { id: "feasibility", title: "Feasibility", body: "body 3" },
    { id: "architecture", title: "Architecture", body: "body 4" },
    { id: "timeline", title: "Timeline", body: "body 5" },
    { id: "risks", title: "Risks", body: "body 6" },
  ],
  citations: [],
  diagramSpec: {
    nodes: [
      { id: "signal", label: "Signal", lane: 0 },
      { id: "mvp", label: "MVP", lane: 1 },
    ],
    edges: [{ from: "signal", to: "mvp", label: "validated" }],
  },
  timelineSpec: {
    items: [{ phase: "Explore", startWeek: 1, durationWeeks: 2, owner: "Team" }],
  },
  risks: ["risk 1", "risk 2"],
  deliverables: ["deliverable"],
  successMetrics: ["metric"],
  assumptions: ["assumption"],
  openQuestions: ["question"],
};

describe("Anthropic adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    anthropicMocks.zodOutputFormat.mockImplementation((schema) => ({
      type: "json_schema",
      schema: { mocked: true },
      parse: (content: string) => schema.parse(JSON.parse(content)),
    }));
  });

  it("uses output_config.format and parsed_output for Anthropic structured calls", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514");

    anthropicMocks.parse.mockResolvedValue({
      parsed_output: {
        rootCause: "Structured output wins",
        shortestFix: ["step 1", "step 2"],
        optionalRefactors: ["refactor"],
        memoryAnchor: "anchor",
        watchouts: ["watchout"],
      },
      content: [
        {
          type: "text",
          text: JSON.stringify({
            rootCause: "legacy text path",
            shortestFix: ["bad"],
            optionalRefactors: ["bad"],
            memoryAnchor: "bad",
            watchouts: [],
          }),
        },
      ],
    });

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(provider.provider).toBe("anthropic");
    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Structured output wins");
    expect(anthropicMocks.zodOutputFormat).toHaveBeenCalledTimes(1);
    expect(anthropicMocks.create).not.toHaveBeenCalled();

    const [params, options] = anthropicMocks.parse.mock.calls[0];
    expect(params.output_config?.format).toBeTruthy();
    expect(params).not.toHaveProperty("response_format");
    expect(params).not.toHaveProperty("extraHeaders");
    expect(options).toBeUndefined();
  });

  it("uses messages.create without output_config for compatible gateways", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "MiniMax-M2.7");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    anthropicMocks.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: [
            "Here you go:",
            "```json",
            JSON.stringify({
              rootCause: "Gateway fallback works",
              shortestFix: ["step 1", "step 2"],
              optionalRefactors: ["refactor"],
              memoryAnchor: "anchor",
              watchouts: ["watchout"],
            }),
            "```",
          ].join("\n"),
        },
      ],
    });

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(provider.provider).toBe("anthropic");
    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Gateway fallback works");
    expect(anthropicMocks.parse).not.toHaveBeenCalled();
    expect(anthropicMocks.zodOutputFormat).toHaveBeenCalledTimes(1);

    const [params, options] = anthropicMocks.create.mock.calls[0];
    expect(params).not.toHaveProperty("output_config");
    expect(params).not.toHaveProperty("response_format");
    expect(params).not.toHaveProperty("extraHeaders");
    expect(params.system).toContain(
      "Only return a raw JSON object with no markdown fences or extra commentary.",
    );
    expect(params.system).toContain("JSON schema:");
    expect(options).toEqual({
      headers: {
        Authorization: "Bearer anthropic-key",
      },
    });
  });

  it("disables Anthropic web search tools when using a compatible gateway", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "MiniMax-M2.7");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    anthropicMocks.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(strategyPayload) }],
    });

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(strategyInput);

    expect(artifact.mode).toBe("strategy");

    const [params] = anthropicMocks.create.mock.calls[0];
    expect(params.tools).toBeUndefined();
  });

  it("keeps Anthropic precedence when both Anthropic and OpenAI keys are set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");

    const { getAiProvider } = await import("@/lib/ai/adapter");

    expect(getAiProvider().provider).toBe("anthropic");
  });
});
