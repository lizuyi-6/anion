import type {
  InterviewSession,
  InterviewTurn,
  LiveTurnEvent,
  SessionConfig,
  Viewer,
} from "@anion/contracts";
import {
  getInterviewerDefinition,
  getRolePack,
  type RolePackId,
} from "@anion/contracts";
import {
  analyzeAnswerSignals,
  buildDirectorMovePlan,
  type AnswerSignalProfile,
  type DirectorMovePlan,
} from "./interview-director";
import {
  clamp,
  keywordOverlap,
  sentenceSplit,
  summarizeText,
  toId,
} from "@anion/shared/utils";
import type { ApplicationStore, InterviewAiProvider, AnalysisAiProvider } from "./ports";
import {
  initSemanticCache,
  warmSeedVectors,
  isSemanticCacheReady,
  getAnswerEmbedding,
} from "./signal-semantics";

export type InterruptAssessment = {
  shouldInterrupt: boolean;
  reason: string;
  pressureDelta: number;
  kind: LiveTurnEvent["kind"];
};

export function createInitialDirectorState(config: SessionConfig) {
  const rolePack = getRolePack(config.rolePack);

  return {
    openLoops: [
      `Prove ${rolePack.specialtyAxes[0]} with one real example`,
      `Stress-test ${rolePack.specialtyAxes[1]} under degraded conditions`,
      `Explain why this decision style matches ${config.targetCompany}`,
    ],
    pressureScore: 42,
    conflictBudget: Math.min(3, Math.max(1, config.interviewers.length - 1)),
    nextSpeakerId: config.interviewers[0],
    needsInterrupt: false,
    needsConflict: false,
    round: 0,
    latestAssessment: "Start broad, then collapse onto the first weak seam.",
  };
}

export function assessInterruptNeed(
  answer: string,
  context: { lastQuestion?: string; pressureScore: number },
): InterruptAssessment {
  const sentences = sentenceSplit(answer);
  const length = answer.trim().length;
  const overlap = keywordOverlap(answer, context.lastQuestion ?? "");
  const buzzwords = [
    "synergy",
    "platform",
    "ecosystem",
    "enablement",
    "loop",
    "framework",
    "协同",
    "平台",
    "生态",
    "赋能",
    "闭环",
    "抓手",
  ];
  const buzzwordHits = buzzwords.filter((word) =>
    answer.toLowerCase().includes(word.toLowerCase()),
  ).length;
  const causalHits = [
    "because",
    "therefore",
    "so",
    "which means",
    "due to",
    "因为",
    "所以",
    "导致",
    "因此",
  ].filter((word) => answer.toLowerCase().includes(word.toLowerCase())).length;

  if (length > 620 || sentences.length > 6) {
    return {
      shouldInterrupt: true,
      reason: "The answer is too long and the main line is getting buried.",
      pressureDelta: 10,
      kind: "interrupt",
    };
  }

  if ((context.lastQuestion ?? "").length > 0 && overlap < 0.15 && causalHits === 0) {
    return {
      shouldInterrupt: true,
      reason: "The answer drifted off the actual question.",
      pressureDelta: 8,
      kind: "interrupt",
    };
  }

  if (buzzwordHits >= 3 && causalHits === 0) {
    return {
      shouldInterrupt: true,
      reason: "The answer stacks terms without giving a causal chain.",
      pressureDelta: 9,
      kind: "interrupt",
    };
  }

  if (length < 40 && context.pressureScore >= 55 && causalHits === 0) {
    return {
      shouldInterrupt: true,
      reason: "The answer is too short to close the loop under pressure.",
      pressureDelta: 6,
      kind: "follow_up",
    };
  }

  return {
    shouldInterrupt: false,
    reason: "Keep digging on the current seam.",
    pressureDelta: 4,
    kind: "follow_up",
  };
}

export async function createInterviewSession(params: {
  store: Pick<ApplicationStore, "createSession" | "setPreferredRolePack" | "appendTurn">;
  viewer: Viewer;
  config: SessionConfig;
}) {
  const { store, viewer, config } = params;
  const now = new Date().toISOString();
  const session: InterviewSession = {
    id: toId("session"),
    userId: viewer.id,
    status: "live",
    config,
    directorState: createInitialDirectorState(config),
    currentPressure: 42,
    createdAt: now,
    updatedAt: now,
  };

  await store.createSession(session);
  await store.setPreferredRolePack(viewer.id, config.rolePack);

  const openingInterviewer = getInterviewerDefinition(
    config.rolePack,
    config.interviewers[0],
  );

  const openingTurn: InterviewTurn = {
    id: toId("turn"),
    sessionId: session.id,
    role: "interviewer",
    speakerId: openingInterviewer?.id ?? config.interviewers[0],
    speakerLabel: openingInterviewer?.label ?? config.interviewers[0],
    kind: "question",
    content: `You are already sitting in the ${config.targetCompany} seat. In two minutes, tell me why you are the safer bet to solve the hardest problem in this JD.`,
    meta: {
      title: openingInterviewer?.title ?? "",
    },
    sequence: 0,
    createdAt: now,
  };

  await store.appendTurn(openingTurn);

  return session;
}

/**
 * Phase 1 of interview beat — pure analysis with no side effects.
 * Computes interrupt assessment, signal profile, and director move plan.
 */
export function planInterviewBeat(params: {
  session: InterviewSession;
  turns: InterviewTurn[];
  answer: string;
  answerEmbedding: number[] | null;
}): {
  assessment: InterruptAssessment;
  signalProfile: AnswerSignalProfile;
  movePlan: DirectorMovePlan;
  latestInterviewerTurn: InterviewTurn | undefined;
} {
  const { session, turns, answer, answerEmbedding } = params;

  const latestInterviewerTurn = turns
    .slice()
    .reverse()
    .find((turn) => turn.role === "interviewer");

  const assessment = assessInterruptNeed(answer, {
    lastQuestion: latestInterviewerTurn?.content,
    pressureScore: session.currentPressure,
  });

  const signalProfile = analyzeAnswerSignals(
    answer,
    {
      lastQuestion: latestInterviewerTurn?.content,
      pressureScore: session.currentPressure,
    },
    answerEmbedding ? { answerEmbedding } : undefined,
  );

  const movePlan = buildDirectorMovePlan({
    session,
    answer,
    lastQuestion: latestInterviewerTurn?.content,
    forcedKind: assessment.kind,
  });

  return { assessment, signalProfile, movePlan, latestInterviewerTurn };
}

/**
 * Phase 2 of interview beat — executes AI generation and persists all changes.
 */
async function executeInterviewBeat(params: {
  store: Pick<ApplicationStore, "appendTurn" | "updateSession">;
  ai: Pick<InterviewAiProvider, "generateInterviewEvent">;
  session: InterviewSession;
  turns: InterviewTurn[];
  answer: string;
  plan: ReturnType<typeof planInterviewBeat>;
}): Promise<{
  candidateTurn: InterviewTurn;
  events: LiveTurnEvent[];
}> {
  const { store, ai, session, turns, answer, plan } = params;
  const { assessment, signalProfile, movePlan } = plan;

  const candidateTurn: InterviewTurn = {
    id: toId("turn"),
    sessionId: session.id,
    role: "candidate",
    speakerId: "candidate",
    speakerLabel: session.config.candidateName ?? "候选人",
    kind: "system",
    content: answer,
    meta: {
      summarized: summarizeText(answer, 180),
    },
    sequence: turns.length,
    createdAt: new Date().toISOString(),
  };

  await store.appendTurn(candidateTurn);

  const event = await ai.generateInterviewEvent({
    session: {
      ...session,
      directorState: {
        ...session.directorState,
        needsInterrupt: assessment.shouldInterrupt,
        round: session.directorState.round + 1,
      },
    },
    turns: [...turns, candidateTurn],
    candidateAnswer: answer,
    forcedKind: assessment.kind,
    forcedRationale: assessment.reason,
    preferredSpeakerId: movePlan.primarySpeakerId,
    speakerDirective: movePlan.primaryDirective,
    directorBrief: movePlan.brief,
    openLoops: movePlan.openLoops,
  });

  const interviewerDefinition = getInterviewerDefinition(
    session.config.rolePack,
    event.speakerId,
  );
  const normalizedEvent: LiveTurnEvent = {
    ...event,
    speakerLabel: interviewerDefinition?.label ?? event.speakerLabel,
  };

  const nextTurn: InterviewTurn = {
    id: toId("turn"),
    sessionId: session.id,
    role: "interviewer",
    speakerId: normalizedEvent.speakerId,
    speakerLabel: normalizedEvent.speakerLabel,
    kind: normalizedEvent.kind,
    content: normalizedEvent.message,
    meta: {
      rationale: normalizedEvent.rationale,
      pressureDelta: normalizedEvent.pressureDelta,
    },
    sequence: turns.length + 1,
    createdAt: normalizedEvent.timestamp,
  };

  await store.appendTurn(nextTurn);

  const emitted = [normalizedEvent];

  if (movePlan.shouldCreateConflict && movePlan.conflictSpeakerId) {
    const conflictEvent = await ai.generateInterviewEvent({
      session: {
        ...session,
        directorState: {
          ...session.directorState,
          needsConflict: true,
          round: session.directorState.round + 1,
        },
      },
      turns: [...turns, candidateTurn, nextTurn],
      candidateAnswer: answer,
      forcedKind: "conflict",
      forcedRationale:
        movePlan.conflictReason ??
        "Insert interviewer disagreement to expose the unresolved trade-off.",
      preferredSpeakerId: movePlan.conflictSpeakerId,
      speakerDirective: movePlan.conflictDirective,
      directorBrief: movePlan.brief,
      openLoops: movePlan.openLoops,
    });
    const challenger = getInterviewerDefinition(
      session.config.rolePack as RolePackId,
      conflictEvent.speakerId,
    );
    const normalizedConflict: LiveTurnEvent = {
      ...conflictEvent,
      speakerLabel: challenger?.label ?? conflictEvent.speakerLabel,
    };

    await store.appendTurn({
      id: toId("turn"),
      sessionId: session.id,
      role: "interviewer",
      speakerId: normalizedConflict.speakerId,
      speakerLabel: normalizedConflict.speakerLabel,
      kind: normalizedConflict.kind,
      content: normalizedConflict.message,
      meta: {
        rationale: normalizedConflict.rationale,
        pressureDelta: normalizedConflict.pressureDelta,
      },
      sequence: turns.length + 2,
      createdAt: normalizedConflict.timestamp,
    });

    emitted.push(normalizedConflict);
  }

  const updatedPressure = clamp(
    session.currentPressure +
      emitted.reduce((total, evt) => total + evt.pressureDelta, 0),
    0,
    100,
  );
  const nextInterviewer =
    movePlan.conflictSpeakerId ??
    movePlan.primarySpeakerId ??
    session.config.interviewers[0];

  await store.updateSession(session.id, {
    currentPressure: updatedPressure,
    directorState: {
      openLoops: movePlan.openLoops,
      pressureScore: updatedPressure,
      conflictBudget: movePlan.shouldCreateConflict
        ? Math.max(0, session.directorState.conflictBudget - 1)
        : session.directorState.conflictBudget,
      nextSpeakerId: nextInterviewer,
      needsInterrupt: false,
      needsConflict: false,
      round: session.directorState.round + 1,
      latestAssessment: `${movePlan.brief} Tags: ${signalProfile.tags.join(", ")}`,
    },
    status: "live",
  });

  return { candidateTurn, events: emitted };
}

/**
 * Orchestrates a single interview beat: plan + execute.
 * This is the facade that wires phase 1 (plan) and phase 2 (execute) together.
 */
export async function generateNextInterviewBeat(params: {
  store: Pick<ApplicationStore, "appendTurn" | "updateSession">;
  ai: Pick<InterviewAiProvider, "generateInterviewEvent">;
  /** Optional AI provider with generateEmbeddings for semantic signal analysis. */
  semanticsAi?: Pick<AnalysisAiProvider, "generateEmbeddings">;
  session: InterviewSession;
  turns: InterviewTurn[];
  answer: string;
}) {
  const { store, session, turns, answer, ai, semanticsAi } = params;

  // Lazily initialize semantic cache on first use (fire-and-forget, does not block)
  if (semanticsAi?.generateEmbeddings && !isSemanticCacheReady()) {
    initSemanticCache(semanticsAi as unknown as Parameters<typeof initSemanticCache>[0]);
    warmSeedVectors().catch((err) =>
      console.warn("[signal-semantics] Seed vector warming failed:", err),
    );
  }

  // Pre-compute answer embedding for semantic signal analysis
  let answerEmbedding: number[] | null = null;
  if (isSemanticCacheReady()) {
    answerEmbedding = await getAnswerEmbedding(answer).catch(() => null);
  }

  // Phase 1: Pure analysis — no side effects
  const plan = planInterviewBeat({ session, turns, answer, answerEmbedding });

  // Phase 2: Execute AI generation and persist
  return executeInterviewBeat({ store, ai, session, turns, answer, plan });
}
