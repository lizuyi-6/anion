import { describe, expect, it } from "vitest";

import { createInitialDirectorState } from "@/lib/server/services/interview";

describe("session state bootstrapping", () => {
  it("builds a director state with next speaker, open loops, and conflict budget", () => {
    const state = createInitialDirectorState({
      rolePack: "engineering",
      targetCompany: "OpenAI",
      industry: "AI",
      level: "Staff",
      focusGoal: "在高压下先给结论，再补证据和边界",
      jobDescription:
        "Responsible for high-concurrency systems and cross-functional execution.",
      interviewers: ["hacker", "architect", "founder"],
      materials: [],
      candidateName: "Abraham",
    });

    expect(state.nextSpeakerId).toBe("hacker");
    expect(state.openLoops.length).toBeGreaterThanOrEqual(3);
    expect(state.conflictBudget).toBeGreaterThan(0);
  });
});
