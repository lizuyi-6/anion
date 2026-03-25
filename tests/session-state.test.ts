import { describe, expect, it } from "vitest";

import type { InterviewSession } from "@/lib/domain";
import {
  canAcceptOffer,
  canActivateCommandCenter,
  isAnalysisRetryable,
} from "@/lib/server/services/session-state";

const baseSession: InterviewSession = {
  id: "session_1",
  userId: "user_1",
  status: "live",
  config: {
    rolePack: "engineering",
    targetCompany: "OpenAI",
    industry: "AI",
    level: "Senior",
    jobDescription: "Build systems and lead technical execution with clear trade-offs.",
    interviewers: ["hacker", "architect", "founder"],
    materials: [],
    candidateName: "Candidate",
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
  },
  currentPressure: 42,
  createdAt: "2026-03-25T00:00:00.000Z",
  updatedAt: "2026-03-25T00:00:00.000Z",
};

describe("session state guards", () => {
  it("only allows accept offer once the report is ready", () => {
    expect(canAcceptOffer(baseSession)).toBe(false);
    expect(canAcceptOffer({ ...baseSession, status: "report_ready" })).toBe(true);
    expect(canAcceptOffer({ ...baseSession, status: "accepted" })).toBe(true);
  });

  it("only activates the command center after the offer is accepted", () => {
    expect(canActivateCommandCenter(baseSession)).toBe(false);
    expect(canActivateCommandCenter({ ...baseSession, status: "accepted" })).toBe(true);
    expect(canActivateCommandCenter({ ...baseSession, status: "hub_active" })).toBe(
      true,
    );
  });

  it("marks failed or unfinished analysis as retryable", () => {
    expect(isAnalysisRetryable({ ...baseSession, status: "analyzing" })).toBe(true);
    expect(
      isAnalysisRetryable({
        ...baseSession,
        status: "analyzing",
        analysisError: "timeout",
      }),
    ).toBe(true);
    expect(isAnalysisRetryable({ ...baseSession, status: "report_ready" })).toBe(false);
  });
});
