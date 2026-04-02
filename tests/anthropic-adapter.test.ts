import { beforeEach, describe, expect, it, vi } from "vitest";

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

function buildAnthropicMessage(text: string) {
  return {
    id: "msg_123",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function getFetchRequest(fetchMock: { mock: { calls: unknown[][] } }) {
  const call = fetchMock.mock.calls[0];
  expect(call).toBeDefined();
  if (!call) {
    throw new Error("Expected fetch to be called.");
  }

  return call as [input: string | URL | Request, init?: RequestInit];
}

describe("Anthropic adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // jsdom triggers Anthropic SDK's browser detection (typeof window !== 'undefined').
    // Stub it so the SDK allows instantiation in Node.js test environment.
    vi.stubGlobal("window", undefined);
  });

  it("uses output_config.format and parsed_output for Anthropic structured calls", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514");
    vi.stubEnv("ANTHROPIC_BASE_URL", "");

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        buildAnthropicMessage(
          JSON.stringify({
            rootCause: "Structured output wins",
            shortestFix: ["step 1", "step 2"],
            optionalRefactors: ["refactor"],
            memoryAnchor: "anchor",
            watchouts: ["watchout"],
          }),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(provider.provider).toBe("anthropic");
    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Structured output wins");

    const [requestUrl, requestInit] = getFetchRequest(fetchMock);
    expect(String(requestUrl)).toContain("/v1/messages");
    const body = JSON.parse(String(requestInit?.body));
    expect(body.output_config?.format).toBeTruthy();
    expect(body).not.toHaveProperty("response_format");
    expect(body).not.toHaveProperty("extraHeaders");
  });

  it("uses gateway-compatible requests without output_config", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "MiniMax-M2.7");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        buildAnthropicMessage(
          [
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
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(provider.provider).toBe("anthropic");
    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Gateway fallback works");

    const [requestUrl, requestInit] = getFetchRequest(fetchMock);
    expect(String(requestUrl)).toContain("/anthropic");
    const body = JSON.parse(String(requestInit?.body));
    expect(body).not.toHaveProperty("output_config");
    expect(body).not.toHaveProperty("response_format");
    expect(body).not.toHaveProperty("extraHeaders");
    expect(body.system).toContain(
      "Only return a raw JSON object with no markdown fences or extra commentary.",
    );
    expect(body.system).toContain("JSON schema:");
    expect(new Headers(requestInit?.headers).get("authorization")).toBe(
      "Bearer anthropic-key",
    );
  });

  it("disables Anthropic web search tools when using a compatible gateway", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "MiniMax-M2.7");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    const fetchMock = vi.fn(async () =>
      jsonResponse(buildAnthropicMessage(JSON.stringify(strategyPayload))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(strategyInput);

    expect(artifact.mode).toBe("strategy");

    const [, requestInit] = getFetchRequest(fetchMock);
    const body = JSON.parse(String(requestInit?.body));
    expect(body.tools).toBeUndefined();
  });

  it("keeps Anthropic precedence when both Anthropic and OpenAI keys are set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");

    const { getAiProvider } = await import("@/lib/ai/adapter");

    expect(getAiProvider().provider).toBe("anthropic");
  });

  it("parses gateway response with trailing commas", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        buildAnthropicMessage(
          JSON.stringify({
            rootCause: "Trailing comma test",
            shortestFix: ["step 1", "step 2"],
            optionalRefactors: ["refactor"],
            memoryAnchor: "anchor",
            watchouts: ["watchout"],
          }) + ",", // Trailing comma after valid JSON
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Trailing comma test");
  });

  it("parses gateway response with literal null value at top level", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    // This tests that extractStructuredJson correctly parses `null` as a JSON value
    const fetchMock = vi.fn(async () =>
      jsonResponse(buildAnthropicMessage("null")),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();

    // When the AI returns just "null", it should parse correctly and then Zod validation
    // should fail (since we expect an object), but the parsing itself shouldn't throw
    await expect(provider.generateCommandArtifact(commandInput)).rejects.toThrow();
  });

  it("parses gateway response with Unicode escapes", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        buildAnthropicMessage(
          JSON.stringify({
            rootCause: "Unicode test: \u4e2d\u6587\u5b57\u7b26",
            shortestFix: ["\u6392\u9664\u6545\u969c", "\u68c0\u67e5\u539f\u56e0"],
            optionalRefactors: ["refactor"],
            memoryAnchor: "anchor",
            watchouts: ["watchout"],
          }),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Unicode test: 中文字符");
    expect(artifact.shortestFix[0]).toBe("排除故障");
  });

  it("parses JSON embedded in markdown fence with trailing comma", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gateway.example.com/anthropic");

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        buildAnthropicMessage(
          "```json\n" +
            JSON.stringify({
              rootCause: "Fenced with trailing comma",
              shortestFix: ["step 1", "step 2"],
              optionalRefactors: ["refactor"],
              memoryAnchor: "anchor",
              watchouts: ["watchout"],
            }).replace(/\}$/, "},") + // Add trailing comma
            "\n```",
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAiProvider } = await import("@/lib/ai/adapter");
    const provider = getAiProvider();
    const artifact = await provider.generateCommandArtifact(commandInput);

    expect(artifact.mode).toBe("copilot");
    if (artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(artifact.rootCause).toBe("Fenced with trailing comma");
  });
});
