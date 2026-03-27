import { describe, expect, it } from "vitest";

import type { InterviewSession } from "@/lib/domain";
import {
  analyzeAnswerSignals,
  buildDirectorMovePlan,
} from "@/lib/server/services/interview-director";

const baseSession: InterviewSession = {
  id: "session_1",
  userId: "user_1",
  status: "live",
  config: {
    rolePack: "engineering",
    targetCompany: "OpenAI",
    industry: "AI",
    level: "Staff",
    jobDescription: "Own architecture, latency, and business trade-offs under pressure.",
    interviewers: ["hacker", "architect", "founder"],
    materials: [],
    candidateName: "候选人",
  },
  directorState: {
    openLoops: ["loop"],
    pressureScore: 52,
    conflictBudget: 2,
    nextSpeakerId: "architect",
    needsInterrupt: false,
    needsConflict: false,
    round: 0,
    latestAssessment: "",
  },
  currentPressure: 52,
  createdAt: "2026-03-25T00:00:00.000Z",
  updatedAt: "2026-03-25T00:00:00.000Z",
};

describe("director move planning", () => {
  it("routes architecture-heavy answers to the architect and creates conflict when proof is thin", () => {
    const plan = buildDirectorMovePlan({
      session: baseSession,
      answer:
        "我会用微服务和异步队列来提速，先把核心链路拆开，后续细节上线时再慢慢补。",
      lastQuestion: "如果预算只够一个主赌注，你怎么做系统设计取舍？",
      forcedKind: "interrupt",
    });

    expect(plan.primarySpeakerId).toBe("architect");
    expect(plan.shouldCreateConflict).toBe(true);
    expect(plan.conflictSpeakerId).toBe("founder");
    expect(plan.openLoops.length).toBeGreaterThan(0);
  });

  it("routes low-level evidence-backed answers to the hacker", () => {
    const signals = analyzeAnswerSignals(
      "我会先把 malloc/free 的悬垂指针复现出来，再把 O(n^2) 的热点改成 O(n log n)。因为锁竞争主要发生在写路径，所以先拆写锁。",
      {
        lastQuestion: "你怎么处理这段 C 代码里的性能和内存问题？",
        pressureScore: 60,
      },
    );
    const plan = buildDirectorMovePlan({
      session: baseSession,
      answer:
        "我会先把 malloc/free 的悬垂指针复现出来，再把 O(n^2) 的热点改成 O(n log n)。因为锁竞争主要发生在写路径，所以先拆写锁。",
      lastQuestion: "你怎么处理这段 C 代码里的性能和内存问题？",
      forcedKind: "follow_up",
    });

    expect(signals.tags).toContain("low_level");
    expect(plan.primarySpeakerId).toBe("hacker");
    expect(plan.shouldCreateConflict).toBe(false);
  });
});
