import { describe, expect, it } from "vitest";

import { createInterviewSession, generateNextInterviewBeat } from "@/lib/server/services/interview";
import { executeInterviewAnalysis } from "@/lib/server/services/analysis";
import { runCommandMode } from "@/lib/server/services/command-center";
import { MemoryDataStore } from "@/lib/server/store/repository";

describe("interview to command center flow", () => {
  it("runs a full session from interview through hub activation", async () => {
    const store = new MemoryDataStore();
    globalThis.__mobiusStore = store;

    const viewer = store.getDemoViewer("engineering");
    const session = await createInterviewSession(viewer, {
      rolePack: "engineering",
      targetCompany: "OpenAI",
      industry: "AI",
      level: "Senior",
      jobDescription: "Build reliable systems and defend architecture trade-offs under pressure.",
      interviewers: ["hacker", "architect", "founder"],
      materials: [],
      candidateName: "Abraham",
    });
    const initialTurns = await store.listTurns(session.id);

    const beat = await generateNextInterviewBeat({
      store,
      session,
      turns: initialTurns,
      answer:
        "我会先守住接口边界，再用版本化写入保证弱网重试的一致性，因为最先失控的是写路径的并发和回滚成本。",
    });
    expect(beat.events.length).toBeGreaterThan(0);

    const analysis = await executeInterviewAnalysis({
      sessionId: session.id,
      store,
    });
    expect(analysis.report.evidenceAnchors.length).toBeGreaterThan(0);
    expect(analysis.memoryProfile.replayMoments.length).toBeGreaterThan(0);

    await store.updateSession(session.id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });
    await store.setWorkspaceMode(viewer.id, "command_center");
    await store.activateMemoryProfile(session.id, viewer.id);
    await store.updateSession(session.id, {
      status: "hub_active",
    });

    const memoryContext = await store.getActiveMemoryContext(viewer.id);
    const result = await runCommandMode({
      store,
      viewer: {
        ...viewer,
        workspaceMode: "command_center",
      },
      mode: "copilot",
      input: "线上出现一个状态切换后 UI 不刷新的 bug，帮我定位根因。",
      attachments: [],
      memoryContext,
    });

    expect(result.artifact.mode).toBe("copilot");
    if (result.artifact.mode !== "copilot") {
      throw new Error("Expected copilot artifact");
    }
    expect(result.artifact.watchouts.length).toBeGreaterThan(0);
    expect((await store.getSession(session.id))?.status).toBe("hub_active");
  });
});
