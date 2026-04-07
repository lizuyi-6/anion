import { describe, it, expect } from "vitest";
import { memoryContextToOpenClawState, careerSummaryToOpenClawContext } from "@/lib/openclaw/bridge";
import { toOpenClawSessionId, fromOpenClawSessionId, buildOpenClawSessionToken } from "@/lib/openclaw/auth";
import { detectCommandMode, inferModeFromContent } from "@/components/command-detector";

describe("OpenClaw Auth", () => {
  it("maps session IDs bidirectionally", () => {
    expect(toOpenClawSessionId("user-123")).toBe("mobius:user-123");
    expect(fromOpenClawSessionId("mobius:user-123")).toBe("user-123");
    expect(fromOpenClawSessionId("other:user-123")).toBeNull();
  });

  it("builds base64url session token", () => {
    const token = buildOpenClawSessionToken({
      id: "user-123",
      displayName: "Test",
      isDemo: true,
      workspaceMode: "command_center",
      preferredRolePack: "engineering",
    });
    expect(token).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    expect(decoded.sessionId).toBe("mobius:user-123");
  });
});

describe("OpenClaw Bridge", () => {
  it("converts null memory context to empty state", () => {
    const state = memoryContextToOpenClawState(null, "user-1");
    expect(state.sessionId).toBe("mobius:user-1");
    expect(state.nodes).toEqual([]);
    expect(state.anchors).toEqual([]);
  });
});

describe("Command Detector", () => {
  it("detects slash commands", () => {
    expect(detectCommandMode("/copilot fix this bug").mode).toBe("copilot");
    expect(detectCommandMode("/strategy make a plan").mode).toBe("strategy");
    expect(detectCommandMode("/sandbox negotiate salary").mode).toBe("sandbox");
    expect(detectCommandMode("just a question").mode).toBe("auto");
  });

  it("infers mode from content keywords", () => {
    expect(inferModeFromContent("线上故障怎么排查")).toBe("copilot");
    expect(inferModeFromContent("下一季度的产品规划")).toBe("strategy");
    expect(inferModeFromContent("和老板谈薪资")).toBe("sandbox");
  });
});
