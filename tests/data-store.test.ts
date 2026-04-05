import { describe, expect, it } from "vitest";

import type { MemoryProfile } from "@/lib/domain";
import { MemoryDataStore } from "@/lib/server/store/repository";

describe("MemoryDataStore", () => {
  it("activates and resolves the current memory context", async () => {
    const store = new MemoryDataStore();
    const viewer = store.getDemoViewer("engineering");
    const now = "2026-03-25T00:00:00.000Z";

    await store.createSession({
      id: "session_1",
      userId: viewer.id,
      status: "report_ready",
      config: {
        rolePack: "engineering",
        targetCompany: "OpenAI",
        industry: "AI",
        level: "Senior",
        focusGoal: "在 60 秒内守住架构取舍主线",
        jobDescription: "Build systems and own the architecture trade-offs.",
        interviewers: ["hacker", "architect", "founder"],
        materials: [],
        candidateName: "候选人",
      },
      directorState: {
        openLoops: ["loop"],
        pressureScore: 42,
        conflictBudget: 2,
        nextSpeakerId: "hacker",
        needsInterrupt: false,
        needsConflict: false,
        round: 0,
        latestAssessment: "",
        phase: "calibrate",
        activeSeam: "在 60 秒内守住架构取舍主线",
        phaseRound: 1,
        lastTimerOutcome: "within_window",
        timeoutCount: 0,
        lastPressureReasons: [],
      },
      currentPressure: 42,
      createdAt: now,
      updatedAt: now,
    });
    await store.createSession({
      id: "session_2",
      userId: viewer.id,
      status: "accepted",
      config: {
        rolePack: "engineering",
        targetCompany: "Anthropic",
        industry: "AI",
        level: "Staff",
        focusGoal: "被追问时补上 owner 和风险",
        jobDescription: "Own platform architecture and cross-functional execution.",
        interviewers: ["hacker", "architect", "founder"],
        materials: [],
        candidateName: "候选人",
      },
      directorState: {
        openLoops: ["loop"],
        pressureScore: 55,
        conflictBudget: 1,
        nextSpeakerId: "architect",
        needsInterrupt: false,
        needsConflict: false,
        round: 0,
        latestAssessment: "",
        phase: "calibrate",
        activeSeam: "被追问时补上 owner 和风险",
        phaseRound: 1,
        lastTimerOutcome: "within_window",
        timeoutCount: 0,
        lastPressureReasons: [],
      },
      currentPressure: 55,
      createdAt: now,
      updatedAt: now,
    });

    const profile: MemoryProfile = {
      id: "memory_1",
      sessionId: "session_1",
      skills: [
        {
          label: "Skill",
          summary: "Understands architecture boundaries.",
          confidence: 0.8,
          sourceTurnIds: ["turn_1"],
        },
      ],
      gaps: [
        {
          label: "Gap",
          summary: "Needs more evidence density.",
          confidence: 0.7,
          sourceTurnIds: ["turn_2"],
        },
      ],
      behaviorTraits: [
        {
          label: "Trait",
          summary: "Explains before deciding.",
          confidence: 0.6,
          sourceTurnIds: ["turn_3"],
        },
      ],
      wins: [
        {
          label: "Win",
          summary: "Recovers after interruptions.",
          confidence: 0.9,
          sourceTurnIds: ["turn_4"],
        },
      ],
      evidenceSpans: [
        {
          label: "Evidence",
          excerpt: "Recovered the line under pressure.",
          sourceTurnId: "turn_4",
        },
      ],
      replayMoments: [
        {
          id: "replay_1",
          sessionId: "session_1",
          title: "Opening recovery",
          summary: "Recovered the main line under pressure.",
          sourceTurnIds: ["turn_1"],
          createdAt: now,
        },
      ],
      generatedAt: now,
    };
    const olderProfile: MemoryProfile = {
      ...profile,
      id: "memory_2",
      sessionId: "session_2",
      replayMoments: [
        {
          id: "replay_2",
          sessionId: "session_2",
          title: "Second session",
          summary: "Held the architecture line against pushback.",
          sourceTurnIds: ["turn_5"],
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      generatedAt: "2026-03-24T00:00:00.000Z",
    };

    await store.saveMemoryProfile(profile);
    await store.saveMemoryProfile(olderProfile);
    await store.saveMemoryEvidence([
      {
        id: "evidence_1",
        memoryProfileId: profile.id,
        userId: viewer.id,
        label: "Gap",
        summary: "Needs more evidence density.",
        kind: "gap",
        confidence: 0.7,
        sourceTurnIds: ["turn_2"],
        createdAt: now,
      },
      {
        id: "evidence_2",
        memoryProfileId: olderProfile.id,
        userId: viewer.id,
        label: "Win",
        summary: "Held architecture line.",
        kind: "win",
        confidence: 0.8,
        sourceTurnIds: ["turn_5"],
        createdAt: "2026-03-24T00:00:00.000Z",
      },
    ]);
    await store.activateMemoryProfile("session_1", viewer.id);

    const context = await store.getActiveMemoryContext(viewer.id);
    expect(context?.profile.id).toBe("memory_1");
    expect(context?.evidence).toHaveLength(2);
    expect(context?.relatedProfiles).toHaveLength(1);
    expect(context?.timeline).toHaveLength(2);
  });
});
