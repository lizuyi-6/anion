import { describe, expect, it } from "vitest";

import type { MemoryProfile } from "@/lib/domain";
import { DiagnosticFindingSchema } from "@/lib/domain";
import { buildMemoryEvidence } from "@/lib/server/services/analysis";

const profile: MemoryProfile = {
  id: "memory_1",
  sessionId: "session_1",
  skills: [
    {
      label: "Skill A",
      summary: "Explains system boundaries clearly.",
      confidence: 0.8,
      sourceTurnIds: ["turn_1"],
    },
  ],
  gaps: [
    {
      label: "Gap A",
      summary: "Needs denser proof under pressure.",
      confidence: 0.7,
      sourceTurnIds: ["turn_2"],
    },
  ],
  behaviorTraits: [
    {
      label: "Trait A",
      summary: "Explains before deciding.",
      confidence: 0.6,
      sourceTurnIds: ["turn_3"],
    },
  ],
  wins: [
    {
      label: "Win A",
      summary: "Recovers after interruption.",
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
  replayMoments: [],
  generatedAt: "2026-03-25T00:00:00.000Z",
};

describe("memory evidence and report schema", () => {
  it("expands memory profile nodes into evidence entries", () => {
    const evidence = buildMemoryEvidence({
      userId: "user_1",
      profile,
    });

    expect(evidence).toHaveLength(4);
    expect(evidence[0]?.sourceTurnIds).toEqual(["turn_1"]);
  });

  it("requires engineering finding metadata", () => {
    const parsed = DiagnosticFindingSchema.parse({
      title: "Thin trade-off proof",
      severity: "major",
      category: "engineering",
      detail: "The candidate named the trade-off without enough evidence.",
      recommendation: "Answer with constraint, option, trade-off, and cost.",
      evidenceTurnIds: ["turn_2"],
      impact: "The follow-up can still break the answer.",
    });

    expect(parsed.category).toBe("engineering");
    expect(parsed.evidenceTurnIds).toEqual(["turn_2"]);
  });
});
