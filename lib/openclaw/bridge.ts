import type { ActiveMemoryContext, CareerSummary } from "@/lib/domain";
import type {
  OpenClawMemoryState,
  OpenClawMemoryNode,
  OpenClawContextualData,
} from "./types";
import { toOpenClawSessionId } from "./auth";

export function memoryContextToOpenClawState(
  ctx: ActiveMemoryContext | null,
  userId: string,
): OpenClawMemoryState {
  if (!ctx) {
    return { sessionId: toOpenClawSessionId(userId), nodes: [], anchors: [], updatedAt: new Date().toISOString() };
  }

  const nodes: OpenClawMemoryNode[] = [
    ...ctx.profile.skills.map((s) => ({
      key: `skill:${s.label}`,
      value: s.summary,
      confidence: s.confidence,
      kind: "skill" as const,
      sourceTurnIds: s.sourceTurnIds,
    })),
    ...ctx.profile.gaps.map((g) => ({
      key: `gap:${g.label}`,
      value: g.summary,
      confidence: g.confidence,
      kind: "gap" as const,
      sourceTurnIds: g.sourceTurnIds,
    })),
    ...ctx.profile.behaviorTraits.map((b) => ({
      key: `behavior:${b.label}`,
      value: b.summary,
      confidence: b.confidence,
      kind: "behavior" as const,
      sourceTurnIds: b.sourceTurnIds,
    })),
    ...ctx.profile.wins.map((w) => ({
      key: `win:${w.label}`,
      value: w.summary,
      confidence: w.confidence,
      kind: "win" as const,
      sourceTurnIds: w.sourceTurnIds,
    })),
  ];

  const anchors = ctx.profile.evidenceSpans.map((e) => ({
    label: e.label,
    excerpt: e.excerpt,
    sourceTurnId: e.sourceTurnId,
  }));

  return {
    sessionId: toOpenClawSessionId(userId),
    nodes,
    anchors,
    updatedAt: ctx.profile.generatedAt,
  };
}

export function careerSummaryToOpenClawContext(
  summary: CareerSummary,
): OpenClawContextualData {
  return {
    totalSessions: summary.totalSessions,
    skillTrends: summary.skillsTrend.map((s) => ({
      label: s.label,
      trend: s.trend,
      latestConfidence: s.confidenceHistory.length > 0
        ? s.confidenceHistory[s.confidenceHistory.length - 1].confidence
        : 0,
    })),
    recurringGaps: summary.recurringGaps.map((g) => ({
      label: g.label,
      summary: g.summary,
    })),
    milestones: summary.milestones.map((m) => ({
      kind: m.kind,
      title: m.title,
    })),
    daysSinceLastSession: summary.daysSinceLastSession,
    streakDays: summary.streakDays,
  };
}
