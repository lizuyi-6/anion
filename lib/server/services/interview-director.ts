import type {
  InterviewSession,
  LiveTurnEvent,
  RolePackDefinition,
} from "@/lib/domain";
import { getRolePack } from "@/lib/domain";
import { keywordOverlap, sentenceSplit, summarizeText } from "@/lib/utils";

const signalKeywords = {
  low_level: [
    "algorithm",
    "complexity",
    "memory",
    "pointer",
    "malloc",
    "free",
    "thread",
    "mutex",
    "lock",
    "cache",
    "动态规划",
    "图论",
    "指针",
    "内存",
    "并发",
    "锁",
    "复杂度",
  ],
  architecture: [
    "architecture",
    "system",
    "service",
    "gateway",
    "queue",
    "latency",
    "network",
    "distributed",
    "api",
    "fallback",
    "弱网",
    "架构",
    "系统",
    "服务",
    "网关",
    "队列",
    "延迟",
    "分布式",
    "降级",
  ],
  business: [
    "revenue",
    "margin",
    "budget",
    "customer",
    "market",
    "pricing",
    "roi",
    "gmv",
    "cost",
    "用户",
    "市场",
    "收入",
    "预算",
    "成本",
    "商业",
    "价值",
  ],
  tradeoff: [
    "trade-off",
    "tradeoff",
    "sacrifice",
    "cut",
    "choice",
    "priority",
    "compromise",
    "取舍",
    "优先级",
    "放弃",
    "折中",
  ],
  metrics: [
    "metric",
    "kpi",
    "sla",
    "slo",
    "latency",
    "throughput",
    "conversion",
    "retention",
    "指标",
    "转化",
    "留存",
    "吞吐",
  ],
  ownership: [
    "owner",
    "ownership",
    "decision",
    "interface",
    "accountability",
    "负责",
    "拍板",
    "控制权",
    "归属",
    "接口",
  ],
  people: [
    "manager",
    "team",
    "stakeholder",
    "feedback",
    "conflict",
    "领导",
    "团队",
    "同事",
    "反馈",
    "冲突",
  ],
  process: [
    "runbook",
    "incident",
    "handoff",
    "rollout",
    "rollback",
    "sop",
    "流程",
    "预案",
    "交接",
    "回滚",
    "上线",
  ],
  data: [
    "event",
    "sample",
    "query",
    "dataset",
    "experiment",
    "日志",
    "埋点",
    "样本",
    "实验",
    "数据集",
  ],
  risk: [
    "risk",
    "failure",
    "downtime",
    "incident",
    "edge",
    "worst case",
    "风险",
    "故障",
    "失败",
    "边界",
  ],
} as const;

const causalityMarkers = [
  "because",
  "therefore",
  "which means",
  "due to",
  "so that",
  "因为",
  "所以",
  "导致",
  "因此",
];

const evidenceMarkers = [
  "for example",
  "for instance",
  "measured",
  "metric",
  "logs",
  "trace",
  "experiment",
  "例如",
  "比如",
  "数据",
  "指标",
  "日志",
  "实验",
];

const contradictionMarkers = [
  "always",
  "never",
  "obviously",
  "definitely",
  "一定",
  "绝不",
  "肯定",
];

type InterviewerDefinition = RolePackDefinition["interviewers"][number];

export type AnswerSignalProfile = {
  tags: string[];
  weaknesses: string[];
  strengths: string[];
  relevance: number;
  causalHits: number;
  evidenceHits: number;
  contradictionRisk: boolean;
  mentionsTradeoff: boolean;
  summary: string;
};

export type DirectorMovePlan = {
  primarySpeakerId: string;
  primarySpeakerLabel: string;
  primaryKind: LiveTurnEvent["kind"];
  primaryDirective: string;
  shouldCreateConflict: boolean;
  conflictSpeakerId?: string;
  conflictSpeakerLabel?: string;
  conflictDirective?: string;
  conflictReason?: string;
  openLoops: string[];
  brief: string;
};

function countKeywordHits(answer: string, keywords: readonly string[]) {
  const lowered = answer.toLowerCase();
  return keywords.reduce(
    (total, keyword) => total + (lowered.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function scoreInterviewer(
  interviewer: InterviewerDefinition,
  signals: AnswerSignalProfile,
  nextSpeakerId: string,
) {
  const focusHits = interviewer.focusSignals.reduce(
    (total, signal) => total + (signals.tags.includes(signal) ? 2 : 0),
    0,
  );
  const weaknessBonus = signals.weaknesses.some((weakness) =>
    interviewer.focusSignals.some((signal) => weakness.toLowerCase().includes(signal)),
  )
    ? 2
    : 0;
  const tieBreaker = interviewer.id === nextSpeakerId ? 1 : 0;

  return focusHits + weaknessBonus + tieBreaker;
}

export function analyzeAnswerSignals(
  answer: string,
  context: { lastQuestion?: string; pressureScore: number },
): AnswerSignalProfile {
  const trimmed = answer.trim();
  const sentences = sentenceSplit(trimmed);
  const relevance = keywordOverlap(trimmed, context.lastQuestion ?? "");
  const causalHits = countKeywordHits(trimmed, causalityMarkers);
  const evidenceHits =
    countKeywordHits(trimmed, evidenceMarkers) +
    (/\b\d+(\.\d+)?%?\b/u.test(trimmed) ? 1 : 0);
  const contradictionRisk =
    countKeywordHits(trimmed, contradictionMarkers) >= 2 && causalHits === 0;

  const tagHits = Object.entries(signalKeywords)
    .map(([tag, keywords]) => ({
      tag,
      hits: countKeywordHits(trimmed, keywords),
    }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const tags = unique(tagHits.map((entry) => entry.tag));
  const weaknesses = unique([
    ...(trimmed.length > 620 || sentences.length > 6
      ? ["The main line is buried under too much setup."]
      : []),
    ...(context.lastQuestion && relevance < 0.16
      ? ["The answer drifted away from the exact question."]
      : []),
    ...(causalHits === 0 ? ["The answer needs a clearer causal chain."] : []),
    ...(evidenceHits === 0 ? ["The answer needs proof, a number, or an observed signal."] : []),
    ...(contradictionRisk ? ["The answer sounds over-certain without proving the boundary."] : []),
  ]);
  const strengths = unique([
    ...(causalHits > 0 ? ["The answer contains usable causality."] : []),
    ...(evidenceHits > 0 ? ["The answer attempts to prove itself with evidence."] : []),
    ...(tags.length > 0 ? [`The candidate is signaling ${tags.slice(0, 2).join(" / ")} depth.`] : []),
  ]);

  return {
    tags: tags.length > 0 ? tags : ["ownership"],
    weaknesses,
    strengths,
    relevance,
    causalHits,
    evidenceHits,
    contradictionRisk,
    mentionsTradeoff: countKeywordHits(trimmed, signalKeywords.tradeoff) > 0,
    summary: summarizeText(trimmed, 88),
  };
}

function choosePrimaryInterviewer(
  session: InterviewSession,
  signals: AnswerSignalProfile,
) {
  const rolePack = getRolePack(session.config.rolePack);

  return session.config.interviewers
    .map((interviewerId) => {
      const interviewer =
        rolePack.interviewers.find((candidate) => candidate.id === interviewerId) ??
        rolePack.interviewers[0];

      return {
        interviewer,
        score: scoreInterviewer(
          interviewer,
          signals,
          session.directorState.nextSpeakerId,
        ),
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.interviewer;
}

function chooseConflictInterviewer(
  session: InterviewSession,
  signals: AnswerSignalProfile,
  primarySpeakerId: string,
) {
  const rolePack = getRolePack(session.config.rolePack);

  if (
    primarySpeakerId !== "founder" &&
    session.config.interviewers.includes("founder") &&
    (signals.mentionsTradeoff ||
      signals.tags.includes("business") ||
      (signals.tags.includes("architecture") && signals.evidenceHits === 0))
  ) {
    return rolePack.interviewers.find((interviewer) => interviewer.id === "founder");
  }

  return session.config.interviewers
    .filter((interviewerId) => interviewerId !== primarySpeakerId)
    .map((interviewerId) => {
      const interviewer =
        rolePack.interviewers.find((candidate) => candidate.id === interviewerId) ??
        rolePack.interviewers[0];

      return {
        interviewer,
        score:
          scoreInterviewer(interviewer, signals, session.directorState.nextSpeakerId) +
          (signals.mentionsTradeoff ? 1 : 0) +
          (signals.contradictionRisk ? 1 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.interviewer;
}

function buildOpenLoops(signals: AnswerSignalProfile, primary: InterviewerDefinition) {
  const loops = [
    `补全这条回答的证据链：${signals.summary}`,
    `${primary.label} 要追的边界：${primary.evidenceDirective}`,
    ...signals.weaknesses.map((weakness) => `待澄清：${weakness}`),
  ];

  return unique(loops).slice(0, 4);
}

export function buildDirectorMovePlan(params: {
  session: InterviewSession;
  answer: string;
  lastQuestion?: string;
  forcedKind: LiveTurnEvent["kind"];
}): DirectorMovePlan {
  const signals = analyzeAnswerSignals(params.answer, {
    lastQuestion: params.lastQuestion,
    pressureScore: params.session.currentPressure,
  });
  const primary =
    choosePrimaryInterviewer(params.session, signals) ??
    getRolePack(params.session.config.rolePack).interviewers[0];
  const shouldCreateConflict =
    params.session.config.interviewers.length > 1 &&
    params.session.directorState.conflictBudget > 0 &&
    (signals.mentionsTradeoff ||
      signals.contradictionRisk ||
      (signals.tags.includes("architecture") && signals.evidenceHits === 0) ||
      ((signals.tags.includes("business") || signals.tags.includes("ownership")) &&
        signals.evidenceHits === 0));
  const challenger = shouldCreateConflict
    ? chooseConflictInterviewer(params.session, signals, primary.id)
    : undefined;
  const openLoops = buildOpenLoops(signals, primary);

  return {
    primarySpeakerId: primary.id,
    primarySpeakerLabel: primary.label,
    primaryKind: params.forcedKind,
    primaryDirective: `${primary.pressureDirective} ${primary.evidenceDirective}`,
    shouldCreateConflict: Boolean(shouldCreateConflict && challenger),
    conflictSpeakerId: challenger?.id,
    conflictSpeakerLabel: challenger?.label,
    conflictDirective: challenger
      ? `${challenger.conflictDirective} ${challenger.evidenceDirective}`
      : undefined,
    conflictReason: challenger
      ? `${challenger.label} should challenge the current answer because ${signals.weaknesses[0] ?? "the trade-off is not fully closed"}.`
      : undefined,
    openLoops,
    brief: [
      `Primary seam: ${signals.weaknesses[0] ?? "Push one level deeper."}`,
      `Primary interviewer: ${primary.label}.`,
      signals.strengths[0] ? `Candidate strength to preserve: ${signals.strengths[0]}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
