import type {
  DirectorState,
  InterviewPressurePhase,
  InterviewSession,
  InterviewTurn,
  LiveTurnEvent,
  SessionConfig,
  Viewer,
} from "@/lib/domain";
import {
  getPressureDeadlineSeconds,
  getPressurePhaseForRound,
  getPressurePhaseRound,
  getInterviewerDefinition,
  getRolePack,
  type RolePackId,
} from "@/lib/domain";
import type { DataStore } from "@/lib/server/store/repository";
import { getDataStore } from "@/lib/server/store/repository";
import { getAiProvider } from "@/lib/ai/adapter";
import {
  analyzeAnswerSignals,
  buildDirectorMovePlan,
} from "@/lib/server/services/interview-director";
import {
  clamp,
  keywordOverlap,
  sentenceSplit,
  summarizeText,
  toId,
} from "@/lib/utils";

export type InterruptAssessment = {
  shouldInterrupt: boolean;
  reason: string;
  pressureDelta: number;
  kind: LiveTurnEvent["kind"];
};

export function createInitialDirectorState(config: SessionConfig): DirectorState {
  const rolePack = getRolePack(config.rolePack);
  const phase = getPressurePhaseForRound(1);

  return {
    openLoops: [
      ...(config.focusGoal.trim() ? [`Hold the seam on: ${config.focusGoal.trim()}`] : []),
      `Prove ${rolePack.specialtyAxes[0]} with one real example`,
      `Stress-test ${rolePack.specialtyAxes[1]} under degraded conditions`,
      `Explain why this decision style matches ${config.targetCompany}`,
    ].slice(0, 4),
    pressureScore: 42,
    conflictBudget: 8,
    nextSpeakerId: config.interviewers[0],
    needsInterrupt: false,
    needsConflict: false,
    round: 0,
    latestAssessment: "Start broad, then collapse onto the first weak seam.",
    phase,
    activeSeam: config.focusGoal.trim(),
    phaseRound: 1,
    lastTimerOutcome: "within_window",
    timeoutCount: 0,
    lastPressureReasons: config.focusGoal.trim()
      ? [`首轮优先压测目标：${config.focusGoal.trim()}`]
      : [],
  };
}

export function assessInterruptNeed(
  answer: string,
  context: {
    lastQuestion?: string;
    pressureScore: number;
    phase: InterviewPressurePhase;
    deadlineSeconds: number;
    elapsedSeconds: number;
    timerExpired: boolean;
  },
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

  if (context.timerExpired || context.elapsedSeconds >= context.deadlineSeconds) {
    return {
      shouldInterrupt: true,
      reason: `The answer exceeded the ${context.deadlineSeconds}s limit for ${context.phase}.`,
      pressureDelta: context.phase === "crossfire" ? 12 : 9,
      kind: "interrupt",
    };
  }

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

export async function createInterviewSession(viewer: Viewer, config: SessionConfig) {
  const store = await getDataStore({ viewer });
  const now = new Date().toISOString();
  const directorState = createInitialDirectorState(config);
  const session: InterviewSession = {
    id: toId("session"),
    userId: viewer.id,
    status: "live",
    config,
    directorState,
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
      phase: directorState.phase,
      deadlineSeconds: getPressureDeadlineSeconds(directorState.phase),
      elapsedSeconds: 0,
      timerExpired: false,
      targetAxis: openingInterviewer?.challengeAxis ?? "",
      seamLabel: directorState.activeSeam,
      pressureReason:
        config.focusGoal.trim() || "先校准主决策链路，再逐步加压。",
    },
    sequence: 0,
    createdAt: now,
  };

  await store.appendTurn(openingTurn);

  return session;
}

export async function generateNextInterviewBeat(params: {
  store: DataStore;
  session: InterviewSession;
  turns: InterviewTurn[];
  answer: string;
  elapsedSeconds: number;
  timerExpired: boolean;
}) {
  const {
    store,
    session,
    turns,
    answer,
    elapsedSeconds,
    timerExpired,
  } = params;
  const ai = getAiProvider();
  const latestInterviewerTurn = turns
    .slice()
    .reverse()
    .find((turn) => turn.role === "interviewer");
  const answerRound = session.directorState.round + 1;
  const currentPhase = getPressurePhaseForRound(answerRound);
  const deadlineSeconds = getPressureDeadlineSeconds(currentPhase);
  const assessment = assessInterruptNeed(answer, {
    lastQuestion: latestInterviewerTurn?.content,
    pressureScore: session.currentPressure,
    phase: currentPhase,
    deadlineSeconds,
    elapsedSeconds,
    timerExpired,
  });
  const signalProfile = analyzeAnswerSignals(answer, {
    lastQuestion: latestInterviewerTurn?.content,
    pressureScore: session.currentPressure,
  });
  const movePlan = buildDirectorMovePlan({
    session,
    answer,
    lastQuestion: latestInterviewerTurn?.content,
    forcedKind: assessment.kind,
    elapsedSeconds,
    timerExpired,
  });

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
      phase: movePlan.phase,
      deadlineSeconds: movePlan.deadlineSeconds,
      elapsedSeconds,
      timerExpired,
      targetAxis: movePlan.targetAxis,
      seamLabel: movePlan.activeSeam,
      pressureReason: movePlan.pressureReasons.join(" / "),
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
    forcedKind: movePlan.primaryKind,
    forcedRationale: movePlan.pressureReasons[0] ?? assessment.reason,
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
    phase: movePlan.phase,
    deadlineSeconds: movePlan.deadlineSeconds,
    elapsedSeconds,
    timerExpired,
    targetAxis: movePlan.targetAxis,
    seamLabel: movePlan.activeSeam,
    pressureReason: movePlan.pressureReasons[0] ?? assessment.reason,
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
      phase: normalizedEvent.phase,
      deadlineSeconds: normalizedEvent.deadlineSeconds,
      elapsedSeconds: normalizedEvent.elapsedSeconds,
      timerExpired: normalizedEvent.timerExpired,
      targetAxis: normalizedEvent.targetAxis,
      seamLabel: normalizedEvent.seamLabel,
      pressureReason: normalizedEvent.pressureReason,
    },
    sequence: turns.length + 1,
    createdAt: normalizedEvent.timestamp,
  };

  await store.appendTurn(nextTurn);

  const emitted = [normalizedEvent];

  if (movePlan.secondarySpeakerId) {
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
      forcedKind: movePlan.secondaryKind ?? "follow_up",
      forcedRationale:
        movePlan.secondaryReason ??
        "Keep pressing on the same seam from a second angle.",
      preferredSpeakerId: movePlan.secondarySpeakerId,
      speakerDirective: movePlan.secondaryDirective,
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
      phase: movePlan.phase,
      deadlineSeconds: movePlan.deadlineSeconds,
      elapsedSeconds,
      timerExpired,
      targetAxis: movePlan.targetAxis,
      seamLabel: movePlan.activeSeam,
      pressureReason:
        movePlan.secondaryReason ??
        movePlan.pressureReasons[0] ??
        assessment.reason,
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
        phase: normalizedConflict.phase,
        deadlineSeconds: normalizedConflict.deadlineSeconds,
        elapsedSeconds: normalizedConflict.elapsedSeconds,
        timerExpired: normalizedConflict.timerExpired,
        targetAxis: normalizedConflict.targetAxis,
        seamLabel: normalizedConflict.seamLabel,
        pressureReason: normalizedConflict.pressureReason,
      },
      sequence: turns.length + 2,
      createdAt: normalizedConflict.timestamp,
    });

    emitted.push(normalizedConflict);
  }

  const updatedPressure = clamp(
    session.currentPressure +
      emitted.reduce((total, event) => total + event.pressureDelta, 0),
    0,
    100,
  );
  const nextInterviewer =
    movePlan.secondarySpeakerId ??
    movePlan.primarySpeakerId ??
    session.config.interviewers[0];
  const nextRound = session.directorState.round + 2;
  const nextPhase = getPressurePhaseForRound(nextRound);

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
      phase: nextPhase,
      activeSeam: movePlan.activeSeam,
      phaseRound: getPressurePhaseRound(nextRound),
      lastTimerOutcome: timerExpired ? "expired" : "within_window",
      timeoutCount: session.directorState.timeoutCount + (timerExpired ? 1 : 0),
      lastPressureReasons: movePlan.pressureReasons,
    },
    status: "live",
  });

  return {
    candidateTurn,
    events: emitted,
  };
}
