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
  "resulted in",
  "led to",
  "contributed to",
  "因为",
  "所以",
  "导致",
  "因此",
  "造成",
  "引起",
  "使得",
  "从而",
  "最终",
  "结果是",
  "带来的",
  "因为...所以",
  "由于...因此",
];

const projectCasePatterns = [
  /在我参与的|在我负责的|我主导的|我参与过的|曾经做过|做过一个/,
  /项目名称|项目背景|项目规模|项目周期|项目结果|项目经验/,
  /当时我们|当时的情况|当时遇到|当时面临/,
  /上线后|部署后|运行后|使用后|实施后/,
  /我们采用了|我们选择了|我们决定|最终方案/,
  /年|月|周|天|小时/,
  /提升了|降低了|减少了|增加了|改进了/,
  /%|\d+%|百分之/,
  /\d+倍|\d+次|\d+个/,
];

const boundaryPatterns = [
  /除非|除了|如果不|只有当|在.*情况下|边界条件/,
  /最大|最小|最高|最低|最多|最少/,
  /不能超过|不能低于|必须满足|前提是/,
  /限制|约束|瓶颈|短板/,
];

const evidenceMarkers = [
  "for example",
  "for instance",
  "measured",
  "metric",
  "logs",
  "trace",
  "experiment",
  "sample",
  "observation",
  "result",
  "outcome",
  "performance",
  "data",
  "case study",
  "项目",
  "案例",
  "经验",
  "结果",
  "数据",
  "指标",
  "日志",
  "实验",
  "证明",
  "验证",
  "测试",
  "观察",
  "案例分析",
  "例如",
  "比如",
  "具体来说",
  "以我参与的",
  "在我的项目中",
  "实际我们",
  "当时的情况",
  "具体数据",
  "性能指标",
  "上线后",
  "测试结果",
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

function countPatternHits(answer: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + (pattern.test(answer) ? 1 : 0), 0);
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
  const patternHits = countPatternHits(trimmed, projectCasePatterns);
  const boundaryHits = countPatternHits(trimmed, boundaryPatterns);
  const evidenceHits =
    countKeywordHits(trimmed, evidenceMarkers) +
    (/\b\d+(\.\d+)?%?\b/u.test(trimmed) ? 1 : 0) +
    (patternHits > 0 ? patternHits : 0) +
    (boundaryHits > 0 ? 1 : 0);
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
  const hasEvidence = evidenceHits > 0 || patternHits > 0 || boundaryHits > 0;
  const hasCausal = causalHits > 0;
  
  const weaknesses = unique([
    ...(trimmed.length > 620 || sentences.length > 6
      ? ["The main line is buried under too much setup."]
      : []),
    ...(context.lastQuestion && relevance < 0.16
      ? ["The answer drifted away from the exact question."]
      : []),
    ...(!hasCausal && sentences.length > 2 ? ["The answer could benefit from a clearer causal chain."] : []),
    ...(!hasEvidence && sentences.length > 3 && patternHits === 0 ? ["The answer could be strengthened with a concrete example or case."] : []),
    ...(contradictionRisk ? ["The answer sounds over-certain without proving the boundary."] : []),
    ...(tags.includes("architecture") && !hasEvidence ? ["Could you walk through a specific architecture decision?"] : []),
    ...(tags.includes("business") && !hasEvidence ? ["What was the measurable impact?"] : []),
    ...(tags.includes("process") && !hasEvidence ? ["How did you handle the handover in practice?"] : []),
  ]);
  
  const strengths = unique([
    ...(hasCausal ? ["The answer contains usable causality."] : []),
    ...(hasEvidence ? ["The answer attempts to prove itself with evidence."] : []),
    ...(patternHits > 0 ? ["The answer includes concrete project experience."] : []),
    ...(boundaryHits > 0 ? ["The answer acknowledges important constraints."] : []),
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

function buildOpenLoops(
  signals: AnswerSignalProfile,
  primary: InterviewerDefinition,
  answer: string
) {
  const hasEvidence = signals.evidenceHits > 0 || signals.causalHits > 0;
  const loops: string[] = [];
  
  if (signals.tags.includes("architecture") && !hasEvidence) {
    loops.push(`追问架构决策：${primary.evidenceDirective}`);
  } else if (signals.tags.includes("business") && !hasEvidence) {
    loops.push(`追问商业影响：请量化这个决策的价值`);
  } else if (signals.tags.includes("people") && !hasEvidence) {
    loops.push(`追问团队协作：这个决定影响了哪些相关方？`);
  } else if (signals.tags.includes("process") && !hasEvidence) {
    loops.push(`追问执行细节：这个流程在实际中是怎么落地的？`);
  } else if (signals.tags.includes("data") && !hasEvidence) {
    loops.push(`追问数据依据：这个判断背后的数据是什么？`);
  }
  
  if (signals.weaknesses.length > 0) {
    loops.push(...signals.weaknesses.slice(0, 2).map(w => `待澄清：${w}`));
  }
  
  if (signals.strengths.length > 0) {
    loops.push(`继续深入：${signals.strengths[0]}`);
  }
  
  loops.push(`${primary.label} 继续追问：${primary.pressureDirective}`);
  
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
  const openLoops = buildOpenLoops(signals, primary, params.answer);

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
      ? `${challenger.label} 应该挑战当前回答，因为${signals.weaknesses[0] ?? "这笔取舍还没有真正闭环"}。`
      : undefined,
    openLoops,
    brief: [
      `主缝隙：${signals.weaknesses[0] ?? "继续往下一层。"} `,
      `主讲面试官：${primary.label}。`,
      signals.strengths[0] ? `需要保留的候选人优势：${signals.strengths[0]}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
