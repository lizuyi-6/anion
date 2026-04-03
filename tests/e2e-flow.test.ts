import { describe, expect, it } from "vitest";

import { MockAiProvider } from "@/lib/ai/adapter";
import { createInterviewSession, generateNextInterviewBeat } from "@/lib/server/services/interview";
import { executeInterviewAnalysis } from "@/lib/server/services/analysis";
import { runCommandMode } from "@/lib/server/services/command-center";
import { MemoryDataStore } from "@/lib/server/store/repository";

describe("interview to command center flow", () => {
  it("runs a full session from interview through hub activation", async () => {
    const store = new MemoryDataStore();
    const ai = new MockAiProvider();

    const viewer = store.getDemoViewer("engineering");
    const session = await createInterviewSession({
      store,
      viewer,
      config: {
        rolePack: "engineering",
        targetCompany: "OpenAI",
        industry: "AI",
        level: "Senior",
        jobDescription: "Build reliable systems and defend architecture trade-offs under pressure.",
        interviewers: ["hacker", "architect", "founder"],
        materials: [],
        candidateName: "Abraham",
      },
    });
    const initialTurns = await store.listTurns(session.id);

    const beat = await generateNextInterviewBeat({
      store,
      ai,
      session,
      turns: initialTurns,
      answer:
        "I would protect the write boundary first, then use versioned writes to keep retries idempotent because the highest-cost failure mode is concurrent corruption and rollback drag.",
    });
    expect(beat.events.length).toBeGreaterThan(0);

    const analysis = await executeInterviewAnalysis({
      sessionId: session.id,
      store,
      ai,
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
      ai,
      viewer: {
        ...viewer,
        workspaceMode: "command_center",
      },
      mode: "copilot",
      input: "The UI stops refreshing after a status transition. Find the root cause.",
      attachments: [],
      memoryContext,
    });

    expect(result.artifact.mode).toBe("copilot");
    if (result.artifact.mode !== "copilot") {
      throw new Error("Expected a copilot artifact");
    }
    expect(result.artifact.watchouts.length).toBeGreaterThan(0);
    expect((await store.getSession(session.id))?.status).toBe("hub_active");
  });
});
