import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { toAiProviderFailure } from "@/lib/ai/errors";
import { hasOpenAi, hasAnthropic, runtimeEnv } from "@/lib/env";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
  DiagnosticReport,
  InterviewSession,
  InterviewTurn,
  LiveTurnEvent,
  MemoryProfile,
  SandboxTurnEvent,
  UploadReference,
  Viewer,
} from "@/lib/domain";
import {
  CopilotResponseSchema,
  DiagnosticReportSchema,
  DiagnosticFindingSchema,
  EvidenceSpanSchema,
  LiveTurnEventSchema,
  MemoryNodeSchema,
  MemoryProfileSchema,
  MemoryReplayMomentSchema,
  PressureDrillSchema,
  PressureMomentSchema,
  RecoveryMomentSchema,
  ReportScoreSchema,
  SandboxOutcomeSchema,
  SandboxTurnEventSchema,
  StarStorySchema,
  StrategyReportSchema,
  getRolePack,
} from "@/lib/domain";
import { sentenceSplit, summarizeText, toId } from "@/lib/utils";

// Relaxed schemas for AI parsing (without .min() constraints that cause validation failures)
// These allow empty arrays, then we fill with fallbacks before final validation
export const RelaxedDiagnosticReportSchema = z.object({
  scores: z.array(ReportScoreSchema).default([]),
  evidence: z.array(z.string()).default([]),
  evidenceAnchors: z.array(z.object({
    id: z.string(),
    label: z.string(),
    excerpt: z.string(),
    sourceTurnId: z.string(),
    speakerLabel: z.string(),
    note: z.string(),
  })).default([]),
  findings: z.array(DiagnosticFindingSchema).default([]),
  starStories: z.array(StarStorySchema).default([]),
  pressureMoments: z.array(PressureMomentSchema).default([]),
  recoveryMoments: z.array(RecoveryMomentSchema).default([]),
  pressureDrills: z.array(PressureDrillSchema).default([]),
  trainingPlan: z.array(z.string()).default([]),
});

export const RelaxedMemoryProfileSchema = z.object({
  skills: z.array(MemoryNodeSchema).default([]),
  gaps: z.array(MemoryNodeSchema).default([]),
  behaviorTraits: z.array(MemoryNodeSchema).default([]),
  wins: z.array(MemoryNodeSchema).default([]),
  evidenceSpans: z.array(EvidenceSpanSchema).default([]),
  replayMoments: z.array(MemoryReplayMomentSchema).default([]),
});

const pressurePhases = ["calibrate", "surround", "crossfire"] as const;
type PressurePhase = (typeof pressurePhases)[number];

function isPressurePhase(value: unknown): value is PressurePhase {
  return typeof value === "string" && pressurePhases.includes(value as PressurePhase);
}

function readPressureMeta(turn: InterviewTurn) {
  const meta = turn.meta ?? {};
  return {
    phase: isPressurePhase(meta.phase) ? meta.phase : "calibrate",
    deadlineSeconds:
      typeof meta.deadlineSeconds === "number" ? meta.deadlineSeconds : 120,
    elapsedSeconds:
      typeof meta.elapsedSeconds === "number" ? meta.elapsedSeconds : 0,
    timerExpired: meta.timerExpired === true,
    targetAxis: typeof meta.targetAxis === "string" ? meta.targetAxis : "",
    seamLabel: typeof meta.seamLabel === "string" ? meta.seamLabel : "",
    pressureReason:
      typeof meta.pressureReason === "string" ? meta.pressureReason : "",
  };
}

type InterviewGenerationInput = {
  session: InterviewSession;
  turns: InterviewTurn[];
  candidateAnswer?: string;
  forcedKind?: LiveTurnEvent["kind"];
  forcedRationale?: string;
  preferredSpeakerId?: string;
  speakerDirective?: string;
  directorBrief?: string;
  openLoops?: string[];
};

type ReportInput = {
  session: InterviewSession;
  turns: InterviewTurn[];
};

type CommandInput = {
  mode: CommandMode;
  viewer: Viewer;
  memoryContext: ActiveMemoryContext | null;
  prompt: string;
  attachments: UploadReference[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

type SandboxTurnInput = {
  threadId: string;
  history: Array<{ role: "user" | "counterpart"; content: string }>;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  memoryContext: ActiveMemoryContext | null;
};

function requireParsedOutput<T>(value: T | null | undefined, label: string): T {
  if (!value) {
    throw new Error(`${label} returned no structured output.`);
  }

  return value;
}

function formatMemoryContextForPrompt(memoryContext: ActiveMemoryContext | null) {
  if (!memoryContext) {
    return "没有活跃的记忆上下文";
  }

  return JSON.stringify({
    activeProfile: {
      sessionId: memoryContext.profile.sessionId,
      skills: memoryContext.profile.skills.slice(0, 3),
      gaps: memoryContext.profile.gaps.slice(0, 3),
      traits: memoryContext.profile.behaviorTraits.slice(0, 2),
      wins: memoryContext.profile.wins.slice(0, 2),
    },
    relatedProfiles: memoryContext.relatedProfiles.slice(0, 2).map((profile) => ({
      sessionId: profile.sessionId,
      wins: profile.wins.slice(0, 1),
      gaps: profile.gaps.slice(0, 1),
    })),
    replay: memoryContext.timeline.slice(0, 5),
  });
}

function buildEvidenceAnchors(turns: InterviewTurn[]) {
  return turns
    .filter((turn) => turn.role === "candidate")
    .slice(0, 4)
    .map((turn, index) => ({
      id: `anchor_${index + 1}`,
      label: `证据锚点 ${index + 1}`,
      excerpt: summarizeText(turn.content, 180),
      sourceTurnId: turn.id,
      speakerLabel: turn.speakerLabel,
      note:
        index === 0
          ? "这是候选人主动立论的起点。"
          : "这是后续追问里最容易被继续深挖的回答切口。",
    }));
}

function buildReplayMoments(session: InterviewSession, turns: InterviewTurn[]) {
  return turns
    .filter((turn) => turn.role === "candidate")
    .slice(0, 3)
    .map((turn, index) => ({
      id: toId("replay"),
      sessionId: session.id,
      title:
        index === 0
          ? "开场立论"
          : index === 1
            ? "被追问后的修正"
            : "压力下的最终落点",
      summary: summarizeText(turn.content, 140),
      sourceTurnIds: [turn.id],
      createdAt: turn.createdAt,
    }));
}

function buildPressureSnapshot(turns: InterviewTurn[]) {
  return turns
    .map((turn) => ({
      id: turn.id,
      role: turn.role,
      kind: turn.kind,
      speakerLabel: turn.speakerLabel,
      excerpt: summarizeText(turn.content, 120),
      ...readPressureMeta(turn),
    }))
    .filter(
      (turn) =>
        turn.timerExpired ||
        turn.kind === "interrupt" ||
        turn.kind === "conflict" ||
        Boolean(turn.seamLabel) ||
        Boolean(turn.pressureReason),
    )
    .slice(-8);
}

function buildPressureMoments(turns: InterviewTurn[]) {
  const moments = turns
    .filter((turn) => turn.role === "candidate" || turn.role === "interviewer")
    .map((turn) => ({ turn, meta: readPressureMeta(turn) }))
    .filter(
      ({ turn, meta }) =>
        meta.timerExpired || turn.kind === "interrupt" || turn.kind === "conflict",
    )
    .map(({ turn, meta }, index) => ({
      id: `pressure_${index + 1}`,
      title: meta.timerExpired
        ? "超时后被继续追压"
        : turn.kind === "conflict"
          ? "多面试官交叉质疑"
          : "主线被打断并重压",
      summary: summarizeText(turn.content, 120),
      phase: meta.phase,
      trigger:
        meta.pressureReason ||
        (meta.timerExpired ? "回答超时" : turn.kind === "conflict" ? "证据薄弱或取舍未闭环" : "回答主线偏移"),
      severity: meta.timerExpired || turn.kind === "conflict" ? "high" : "medium",
      evidenceTurnIds: [turn.id],
      recommendation:
        meta.seamLabel || meta.targetAxis
          ? `下一轮优先围绕“${meta.seamLabel || meta.targetAxis}”做 60-90 秒压测复练。`
          : "下一轮先缩短开头背景，再把证据和边界提前。",
    }));

  return moments.slice(0, 3);
}

function buildRecoveryMoments(turns: InterviewTurn[]) {
  const candidateTurns = turns
    .filter((turn) => turn.role === "candidate")
    .map((turn) => ({ turn, meta: readPressureMeta(turn) }))
    .filter(
      ({ turn, meta }) =>
        !meta.timerExpired &&
        turn.content.trim().length >= 48 &&
        (Boolean(meta.seamLabel) || Boolean(meta.targetAxis)),
    );

  return candidateTurns.slice(0, 2).map(({ turn, meta }, index) => ({
    id: `recovery_${index + 1}`,
    title: index === 0 ? "被打断后仍能拉回主线" : "在高压里补上了关键证据",
    summary: summarizeText(turn.content, 120),
    phase: meta.phase,
    evidenceTurnIds: [turn.id],
    whyItWorked:
      meta.seamLabel || meta.targetAxis
        ? `这段回答重新对准了“${meta.seamLabel || meta.targetAxis}”，没有继续发散。`
        : "这段回答直接补了结论、证据和边界，所以恢复有效。",
  }));
}

function buildPressureDrills(
  session: InterviewSession,
  pressureMoments: Array<{
    phase: PressurePhase;
    title: string;
    trigger: string;
    evidenceTurnIds: string[];
  }>,
  findings: Array<{
    title: string;
    recommendation: string;
    evidenceTurnIds: string[];
  }>,
) {
  const fallbackFocus = session.config.focusGoal.trim();
  const drills = [
    ...pressureMoments.map((moment, index) => ({
      id: `drill_${index + 1}`,
      title: moment.title,
      goal: `${moment.trigger}，把回答重新拉回主决策链路。`,
      focusGoal: fallbackFocus || moment.trigger,
      recommendedDurationMinutes:
        moment.phase === "calibrate" ? 20 : moment.phase === "surround" ? 25 : 30,
      successCriteria:
        moment.phase === "crossfire"
          ? "在 60 秒内先给判断，再补一条证据和一条代价，不被第二位面试官击穿。"
          : "在时限内给出结论、证据和边界，不被打断后仍能守住主线。",
      sourceTurnIds: moment.evidenceTurnIds,
    })),
    ...findings.map((finding, index) => ({
      id: `finding_drill_${index + 1}`,
      title: `围绕「${finding.title}」复练`,
      goal: finding.recommendation,
      focusGoal: fallbackFocus || finding.title,
      recommendedDurationMinutes: 25,
      successCriteria: "连续 3 轮回答都能保持结构完整，并给出可核验的证明点。",
      sourceTurnIds: finding.evidenceTurnIds,
    })),
  ];

  return drills.slice(0, 3);
}

function buildTrainingPlanFromDrills(drills: Array<{ goal: string; successCriteria: string }>) {
  const plan = drills.map(
    (drill) => `${drill.goal} 通过标准：${drill.successCriteria}`,
  );

  while (plan.length < 3) {
    plan.push("围绕最容易失守的一条回答链路做 20 分钟限时复练。");
  }

  return plan.slice(0, 3);
}

function buildFallbackScores(): Array<{ key: string; label: string; score: number; signal: string }> {
  return [
    { key: "structure", label: "结构清晰度", score: 50, signal: "有待提升" },
    { key: "evidence", label: "证据充分性", score: 50, signal: "有待提升" },
    { key: "boundary", label: "边界意识", score: 50, signal: "有待提升" },
    { key: "pressure", label: "抗压能力", score: 50, signal: "有待提升" },
    { key: "recovery", label: "恢复能力", score: 50, signal: "有待提升" },
    { key: "conciseness", label: "简洁度", score: 50, signal: "有待提升" },
    { key: "tradeoff", label: "取舍表达", score: 50, signal: "有待提升" },
    { key: "closure", label: "闭环意识", score: 50, signal: "有待提升" },
  ];
}

function buildFallbackEvidence(turns: InterviewTurn[]): string[] {
  const evidence: string[] = [];
  for (const turn of turns) {
    if (turn.role === "candidate" && turn.content.trim().length > 30) {
      evidence.push(summarizeText(turn.content, 100));
      if (evidence.length >= 3) break;
    }
  }
  while (evidence.length < 3) {
    evidence.push("本次面试暂无足够证据，建议进行更多轮次后重新分析。");
  }
  return evidence;
}

function buildFallbackFinding(session: InterviewSession): Array<{
  title: string;
  severity: "critical" | "major" | "medium" | "minor";
  category: string;
  detail: string;
  recommendation: string;
  evidenceTurnIds: string[];
  impact: string;
}> {
  return [
    {
      title: "需要更多练习数据",
      severity: "medium",
      category: "综合评估",
      detail: "当前面试数据不足以生成精准诊断，建议完成更多轮次。",
      recommendation: "继续进行模拟面试，积累更多回答样本后再查看详细分析。",
      evidenceTurnIds: [],
      impact: "诊断报告的准确性依赖于足够的面试数据。",
    },
  ];
}

function buildFallbackStarStories(): Array<{
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}> {
  return [
    {
      title: "待挖掘的 STAR 案例",
      situation: "本次面试暂未识别出完整的 STAR 案例。",
      task: "建议在后续模拟中重点练习结构化表达。",
      action: "使用 STAR 框架重新组织关键经历。",
      result: "形成可复用的面试故事库。",
    },
  ];
}

function buildFallbackMemoryNode(label: string, summary: string): {
  label: string;
  summary: string;
  confidence: number;
  sourceTurnIds: string[];
} {
  return {
    label,
    summary,
    confidence: 0.5,
    sourceTurnIds: [],
  };
}

function buildFallbackMemoryNodes(turns: InterviewTurn[]): {
  skills: Array<{ label: string; summary: string; confidence: number; sourceTurnIds: string[] }>;
  gaps: Array<{ label: string; summary: string; confidence: number; sourceTurnIds: string[] }>;
  behaviorTraits: Array<{ label: string; summary: string; confidence: number; sourceTurnIds: string[] }>;
  wins: Array<{ label: string; summary: string; confidence: number; sourceTurnIds: string[] }>;
} {
  // Try to extract from turns, otherwise use defaults
  const candidateTurns = turns.filter(t => t.role === "candidate");

  return {
    skills: [
      buildFallbackMemoryNode(
        "结构化表达",
        candidateTurns.length > 0 ? "能在高压下保持回答结构。" : "需要更多面试数据来识别技能亮点。"
      ),
    ],
    gaps: [
      buildFallbackMemoryNode(
        "证据密度",
        candidateTurns.length > 0 ? "部分回答的证据支撑不够充分。" : "需要更多面试数据来识别待提升领域。"
      ),
    ],
    behaviorTraits: [
      buildFallbackMemoryNode(
        "抗压节奏",
        candidateTurns.length > 0 ? "在追问下能保持基本节奏。" : "需要更多面试数据来识别行为特征。"
      ),
    ],
    wins: [
      buildFallbackMemoryNode(
        "核心亮点",
        candidateTurns.length > 0 ? "本次面试有待提炼的优势项。" : "需要更多面试数据来识别成功案例。"
      ),
    ],
  };
}

function buildFallbackEvidenceSpans(): Array<{
  label: string;
  excerpt: string;
  sourceTurnId: string;
}> {
  return [
    {
      label: "待补充证据",
      excerpt: "需要更多面试轮次来提取关键证据片段。",
      sourceTurnId: "",
    },
  ];
}

export interface AiProviderAdapter {
  provider: "openai" | "anthropic";
  generateInterviewEvent(input: InterviewGenerationInput): Promise<LiveTurnEvent>;
  generateDiagnosticReport(input: ReportInput): Promise<DiagnosticReport>;
  generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }): Promise<MemoryProfile>;
  generateCommandArtifact(input: CommandInput): Promise<CommandArtifact>;
  generateSandboxTurn(input: SandboxTurnInput): Promise<SandboxTurnEvent>;
  generateEmbeddings?(input: string[]): Promise<number[][] | null>;
}

class OpenAiProvider implements AiProviderAdapter {
  provider = "openai" as const;
  private client = new OpenAI({
    apiKey: runtimeEnv.openAiApiKey,
    baseURL: runtimeEnv.openAiBaseUrl,
  });

  private async safeCall<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      console.log("[AI_SUCCESS]", JSON.stringify({
        provider: "openai",
        duration: Date.now() - startTime,
      }));
      return result;
    } catch (error) {
      console.error("[AI_ERROR]", JSON.stringify({
        provider: "openai",
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw toAiProviderFailure(error, this.provider);
    }
  }

  private async chatComplete<T>(system: string, userMessage: string, schema: z.ZodType<T>, tools?: unknown): Promise<T> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: system + "\n\nIMPORTANT: You must respond with valid JSON that matches the schema exactly. Use the exact field names specified." },
      { role: "user", content: userMessage },
    ];

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: runtimeEnv.openAiModel,
      messages,
    };

    if (tools) {
      (params as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming).tools = tools as OpenAI.Chat.ChatCompletionTool[];
    }

    const response = await this.client.chat.completions.create(params);
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in chat completion response");
    }

    // Try to extract and parse JSON
    const jsonStr = this.extractJson(content);
    try {
      const parsed = JSON.parse(jsonStr);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      console.warn("[AI_PARSE_WARN] Schema validation failed, attempting field mapping:", result.error.issues.slice(0, 3));
      // Try intelligent field mapping
      const mapped = this.mapFieldsToSchema(parsed, schema);
      return mapped;
    } catch (e) {
      console.error("[AI_PARSE_ERROR]", e);
      throw e;
    }
  }

  private extractJson(content: string): string {
    const trimmed = content.trim();
    // Find JSON object or array
    const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      // Validate it's actually JSON by finding proper closing bracket
      const jsonStr = match[1];
      try {
        JSON.parse(jsonStr);
        return jsonStr;
      } catch {
        // Invalid JSON, return as-is
        return trimmed;
      }
    }
    return trimmed;
  }

  private mapFieldsToSchema<T>(parsed: Record<string, unknown>, schema: z.ZodType<T>): T {
    // Try to extract field values even if field names don't match exactly
    const result: Record<string, unknown> = {};
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;

    if (!shape) {
      return parsed as T;
    }

    // Build a mapping of common field variations
    const fieldMappings: Record<string, string[]> = {
      rootCause: ["rootCause", "root_cause", "root_cause_analysis", "cause", "analysis"],
      shortestFix: ["shortestFix", "shortest_fix", "fix", "solution", "steps", "solutions"],
      optionalRefactors: ["optionalRefactors", "optional_refactors", "refactors", "improvements"],
      memoryAnchor: ["memoryAnchor", "memory_anchor", "anchor", "memory"],
      watchouts: ["watchouts", "warnings", "cautions", "attention"],
      techForesight: ["techForesight", "tech_foresight", "foresight", "future"],
      greeting: ["greeting", "greet", "hello", "response"],
    };

    for (const [canonicalName, variations] of Object.entries(fieldMappings)) {
      if (canonicalName in parsed) {
        result[canonicalName] = parsed[canonicalName];
        continue;
      }
      // Try variations
      for (const variation of variations) {
        if (variation in parsed) {
          result[canonicalName] = parsed[variation];
          break;
        }
      }
    }

    // Copy any remaining fields that match exactly
    for (const key of Object.keys(parsed)) {
      if (key in shape || !(key in result)) {
        result[key] = parsed[key];
      }
    }

    // Try to parse the result
    const parseResult = schema.safeParse(result);
    if (parseResult.success) {
      return parseResult.data;
    }

    // Last resort: fill missing array fields with [] so callers don't crash on .length
    if (shape) {
      for (const [key, fieldSchema] of Object.entries(shape)) {
        // Ensure all fields that should be arrays ARE arrays
        const value = result[key];
        if (value === undefined || value === null) {
          if (fieldSchema instanceof z.ZodArray) {
            result[key] = [];
          } else if (fieldSchema instanceof z.ZodDefault) {
            try { result[key] = fieldSchema.parse(undefined); } catch { result[key] = []; }
          }
        } else if (!Array.isArray(value)) {
          // Field exists but is not an array — coerce to []
          result[key] = [];
        }
      }
    }

    console.warn("[AI_MAP] Using partial data, some fields may be missing");
    return result as T;
  }

  async generateInterviewEvent(input: InterviewGenerationInput) {
    return this.safeCall(async () => {
    console.log("[AI_REQUEST]", JSON.stringify({
      provider: "openai",
      method: "generateInterviewEvent",
      model: runtimeEnv.openAiModel,
      sessionId: input.session.id,
      round: input.session.directorState.round,
    }));

    const prompt = [
      "你是莫比乌斯计划的面试指挥官。",
      `目标公司：${input.session.config.targetCompany}`,
      `角色包：${input.session.config.rolePack}`,
      `岗位级别：${input.session.config.level}`,
      `职位描述：${summarizeText(input.session.config.jobDescription, 1500)}`,
      `导演状态：${JSON.stringify(input.session.directorState)}`,
      `最近轮次：${JSON.stringify(input.turns.slice(-4))}`,
      input.directorBrief ? `导演提示：${input.directorBrief}` : "",
      input.openLoops?.length ? `待补闭环：${JSON.stringify(input.openLoops)}` : "",
      input.candidateAnswer ? `最新回答：${input.candidateAnswer}` : "",
      input.preferredSpeakerId ? `指定发言人 ID：${input.preferredSpeakerId}` : "",
      input.speakerDirective ? `发言人契约：${input.speakerDirective}` : "",
      input.forcedKind ? `指定下一个事件类型：${input.forcedKind}` : "",
      input.forcedRationale ? `必须保留的理由：${input.forcedRationale}` : "",
      "只返回一个中文结构化事件。保持尖锐、高压、聚焦因果，并与发言人身份一致。",
      "以JSON格式输出，包含 id, kind, speakerId, speakerLabel, pressureDelta, message, rationale, timestamp 字段。",
    ]
      .filter(Boolean)
      .join("\n");

    const parsed = await this.chatComplete(
      "你是一个专业的面试模拟器，输出JSON格式。",
      prompt,
      LiveTurnEventSchema.omit({ sessionId: true }),
    );

    return LiveTurnEventSchema.parse({
      ...parsed,
      sessionId: input.session.id,
      timestamp: new Date().toISOString(),
    });
    });
  }

  async generateDiagnosticReport(input: ReportInput) {
    return this.safeCall(async () => {
    console.log("[AI_REQUEST]", JSON.stringify({
      provider: "openai",
      method: "generateDiagnosticReport",
      model: runtimeEnv.openAiModel,
      sessionId: input.session.id,
      turnCount: input.turns.length,
    }));

    const pressureSnapshot = buildPressureSnapshot(input.turns);
    const prompt = [
      "你是莫比乌斯计划的诊断报告引擎。",
      `角色包：${input.session.config.rolePack}`,
      `会话配置：${JSON.stringify(input.session.config)}`,
      `面试轮次：${JSON.stringify(input.turns)}`,
      `压力元数据快照：${JSON.stringify(pressureSnapshot)}`,
      "只输出中文。保持直接、怀疑、可执行。",
      "每条 finding 都必须指向 evidenceTurnIds；evidenceAnchors 必须包含 excerpt、speakerLabel 和 note。",
      "必须显式输出 pressureMoments、recoveryMoments、pressureDrills，并优先使用 turn meta 中的 phase、timerExpired、pressureReason、seamLabel，不要凭空猜测压力轨迹。",
      "以JSON格式输出诊断报告。",
    ].join("\n");

    const parsed = await this.chatComplete(
      "你是一个专业的面试诊断引擎，输出JSON格式。",
      prompt,
      RelaxedDiagnosticReportSchema,
    );

    // Validate array items individually — ARK API may return items with all-undefined fields
    const validFindings = parsed.findings.filter(
      (f: Record<string, unknown>) => typeof f.title === "string" && f.title.trim().length > 0,
    );
    const validPressureMoments = parsed.pressureMoments.filter(
      (m: Record<string, unknown>) => typeof m.title === "string" && m.title.trim().length > 0,
    );
    const validPressureDrills = parsed.pressureDrills.filter(
      (d: Record<string, unknown>) => typeof d.title === "string" && d.title.trim().length > 0,
    );
    const validRecoveryMoments = parsed.recoveryMoments.filter(
      (m: Record<string, unknown>) => typeof m.summary === "string" && m.summary.trim().length > 0,
    );
    const validStarStories = parsed.starStories.filter(
      (s: Record<string, unknown>) => typeof s.title === "string" && s.title.trim().length > 0,
    );
    const validScores = parsed.scores.filter(
      (s: Record<string, unknown>) => typeof s.label === "string" && typeof s.score === "number",
    );

    const pressureMoments =
      validPressureMoments.length > 0
        ? validPressureMoments
        : buildPressureMoments(input.turns);
    const pressureDrills =
      validPressureDrills.length > 0
        ? validPressureDrills
        : buildPressureDrills(input.session, pressureMoments, validFindings);

    const reportData = {
      id: toId("report"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      scores: validScores.length >= 8 ? validScores : buildFallbackScores(),
      evidence: parsed.evidence.length >= 3 ? parsed.evidence : buildFallbackEvidence(input.turns),
      evidenceAnchors: parsed.evidenceAnchors,
      findings: validFindings.length >= 1 ? validFindings : buildFallbackFinding(input.session),
      starStories: validStarStories.length >= 1 ? validStarStories : buildFallbackStarStories(),
      pressureMoments,
      recoveryMoments:
        validRecoveryMoments.length > 0
          ? validRecoveryMoments
          : buildRecoveryMoments(input.turns),
      pressureDrills,
      trainingPlan: parsed.trainingPlan.length >= 3 ? parsed.trainingPlan : buildTrainingPlanFromDrills(pressureDrills),
    };

    try {
      return DiagnosticReportSchema.parse(reportData);
    } catch (parseError) {
      console.warn("[AI_REPORT_FALLBACK] Final parse failed, rebuilding with all fallbacks:", parseError instanceof Error ? parseError.message : String(parseError));
      // Last resort: rebuild entirely from fallback data
      const fallbackPressureMoments = buildPressureMoments(input.turns);
      const fallbackPressureDrills = buildPressureDrills(input.session, fallbackPressureMoments, []);
      return DiagnosticReportSchema.parse({
        id: toId("report"),
        sessionId: input.session.id,
        generatedAt: new Date().toISOString(),
        scores: buildFallbackScores(),
        evidence: buildFallbackEvidence(input.turns),
        evidenceAnchors: buildEvidenceAnchors(input.turns),
        findings: buildFallbackFinding(input.session),
        starStories: buildFallbackStarStories(),
        pressureMoments: fallbackPressureMoments,
        recoveryMoments: buildRecoveryMoments(input.turns),
        pressureDrills: fallbackPressureDrills,
        trainingPlan: buildTrainingPlanFromDrills(fallbackPressureDrills),
      });
    }
    });
  }

  async generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }) {
    return this.safeCall(async () => {
    console.log("[AI_REQUEST]", JSON.stringify({
      provider: "openai",
      method: "generateMemoryProfile",
      model: runtimeEnv.openAiModel,
      sessionId: input.session.id,
      turnCount: input.turns.length,
    }));

    const prompt = [
      "你是莫比乌斯计划的记忆重构引擎。",
      `会话配置：${JSON.stringify(input.session.config)}`,
      `诊断报告：${JSON.stringify(input.report)}`,
      `面试全文：${JSON.stringify(input.turns)}`,
      "输出一份可检索的中文记忆画像。每个节点都必须包含 sourceTurnIds。replayMoments 要提炼出后续可重放的关键切片。",
      "以JSON格式输出记忆画像。",
    ].join("\n");

    const parsed = await this.chatComplete(
      "你是一个专业的记忆重构引擎，输出JSON格式。",
      prompt,
      RelaxedMemoryProfileSchema,
    );

    const fallbackNodes = buildFallbackMemoryNodes(input.turns);

    // Validate memory node items — ARK API may return items with undefined fields
    const hasValidNode = (arr: Array<Record<string, unknown>>) =>
      arr.some((n) => typeof n.label === "string" && n.label.trim().length > 0);
    const filterValidNodes = (arr: Array<Record<string, unknown>>) =>
      arr.filter((n) => typeof n.label === "string" && n.label.trim().length > 0);

    const validSkills = filterValidNodes(parsed.skills);
    const validGaps = filterValidNodes(parsed.gaps);
    const validTraits = filterValidNodes(parsed.behaviorTraits);
    const validWins = filterValidNodes(parsed.wins);
    const validEvidenceSpans = parsed.evidenceSpans.filter(
      (e: Record<string, unknown>) => typeof e.label === "string" && e.label.trim().length > 0,
    );

    const memoryData = {
      id: toId("memory"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      skills: validSkills.length >= 1 ? validSkills : fallbackNodes.skills,
      gaps: validGaps.length >= 1 ? validGaps : fallbackNodes.gaps,
      behaviorTraits: validTraits.length >= 1 ? validTraits : fallbackNodes.behaviorTraits,
      wins: validWins.length >= 1 ? validWins : fallbackNodes.wins,
      evidenceSpans: validEvidenceSpans.length >= 1 ? validEvidenceSpans : buildFallbackEvidenceSpans(),
    };

    try {
      return MemoryProfileSchema.parse(memoryData);
    } catch {
      // Last resort: use all fallbacks
      return MemoryProfileSchema.parse({
        id: toId("memory"),
        sessionId: input.session.id,
        generatedAt: new Date().toISOString(),
        ...fallbackNodes,
        evidenceSpans: buildFallbackEvidenceSpans(),
        replayMoments: buildReplayMoments(input.session, input.turns),
      });
    }
    });
  }

  async generateCommandArtifact(input: CommandInput) {
    return this.safeCall(async () => {
    const attachmentContext = input.attachments
      .map((attachment) => {
        const preview = attachment.textContent
          ? summarizeText(attachment.textContent, 800)
          : attachment.originalName;
        return `${attachment.originalName}: ${preview}`;
      })
      .join("\n");
    const memoryContext = formatMemoryContextForPrompt(input.memoryContext);

    if (input.mode === "copilot") {
      const prompt = [
        "你是用户忠诚的工程副驾。",
        `查看者：${input.viewer.displayName}`,
        `活跃记忆上下文：${memoryContext}`,
        `最近历史：${JSON.stringify(input.history.slice(-4))}`,
        `用户输入：${input.prompt}`,
        attachmentContext ? `附件：${attachmentContext}` : "",
        "只返回中文。先给根因，再给最短修复路径，再给可选重构，最后给注意事项。尽量把建议锚定到记忆中的短板或优势。另外，在 techForesight 中给出 2-4 个前瞻性技术风险预判：考虑用户的运行环境和当前代码栈，推测未来 3-6 个月可能出现的技术债、架构瓶颈或以及具体的升级/规避建议。",
        "以JSON格式输出工程副驾建议。必须包含所有字段：rootCause, shortestFix (数组), optionalRefactors (数组), memoryAnchor, techForesight (数组，每项包含 technology, risk, timeline, recommendation), watchouts (数组)。",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const parsed = await this.chatComplete(
          "你是一个专业的工程副驾，输出JSON格式。",
          prompt,
          CopilotResponseSchema.omit({ id: true, mode: true }),
        );

        return CopilotResponseSchema.parse({
          id: toId("copilot"),
          mode: "copilot",
          ...parsed,
        });
      } catch (e) {
        console.error("[AI_PARSE_ERROR] copilot:", e);
        throw toAiProviderFailure(e, this.provider);
      }
    }

    if (input.mode === "strategy") {
      const prompt = [
        "你是莫比乌斯计划的可行性与战略引擎。",
        `活跃记忆上下文：${memoryContext}`,
        `用户输入：${input.prompt}`,
        attachmentContext ? `附件：${attachmentContext}` : "",
        "只返回中文。必须包含市场背景、问题定义、可行性判断、架构/流程图 DSL、排期与资源、风险与前置条件，并补充 deliverables、successMetrics、assumptions 和 openQuestions。",
        "以JSON格式输出战略报告。",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const parsed = await this.chatComplete(
          "你是一个专业的战略分析引擎，输出JSON格式。",
          prompt,
          StrategyReportSchema.omit({ id: true, mode: true }),
        );

        return StrategyReportSchema.parse({
          id: toId("strategy"),
          mode: "strategy",
          ...parsed,
        });
      } catch (e) {
        console.error("[AI_PARSE_ERROR] strategy:", e);
        throw toAiProviderFailure(e, this.provider);
      }
    }

    const prompt = [
      "你是莫比乌斯计划的职场博弈沙盒。",
      `活跃记忆上下文：${memoryContext}`,
      `最近历史：${JSON.stringify(input.history.slice(-4))}`,
      `用户输入：${input.prompt}`,
      "只返回中文。必须包含当前均衡、激励、推荐动作、长期成本、pressurePoints、scenarioBranches，以及 3-5 条可直接带进会议的话术。",
      "以JSON格式输出博弈沙盒结果。",
    ].join("\n");

    try {
      const parsed = await this.chatComplete(
        "你是一个专业的职场博弈分析引擎，输出JSON格式。",
        prompt,
        SandboxOutcomeSchema.omit({ id: true, mode: true }),
      );

      return SandboxOutcomeSchema.parse({
        id: toId("sandbox"),
        mode: "sandbox",
        ...parsed,
      });
    } catch (e) {
      console.error("[AI_PARSE_ERROR] sandbox:", e);
      throw toAiProviderFailure(e, this.provider);
    }
    });
  }

  async generateSandboxTurn(input: SandboxTurnInput): Promise<SandboxTurnEvent> {
    return this.safeCall(async () => {
    const memoryContext = formatMemoryContextForPrompt(input.memoryContext);
    const historyContext = input.history.length > 0
      ? `对话历史：\n${input.history.map((h) => `[${h.role === "user" ? "你" : "对手"}] ${h.content}`).join("\n")}`
      : "";

    const prompt = [
      `你的角色：${input.counterpartRole}`,
      `你的激励/动机：${input.counterpartIncentives}`,
      `对方的红线：${input.userRedLine}`,
      memoryContext ? `活跃记忆上下文：${memoryContext}` : "",
      historyContext,
      `对方刚说：${input.userMessage}`,
      "",
      "以对手的口吻回复（counterpartMessage），然后给出战术分析（strategicCommentary）。",
      "counterpartMessage：用对手的语气说话，保持职场真实感。",
      "counterpartTone：一句话描述对手这一轮的策略意图。",
      "strategicCommentary：站在第三方视角分析策略和应对建议。",
      "pressureLevel：0-10，对手这一轮的施压程度。",
      "只返回中文。以JSON格式输出。",
    ].filter(Boolean).join("\n");

    const parsed = await this.chatComplete(
      "你是莫比乌斯计划的职场博弈沙盒对手角色扮演引擎，输出JSON格式。",
      prompt,
      SandboxTurnEventSchema.omit({ id: true, threadId: true, timestamp: true }),
    );

    return SandboxTurnEventSchema.parse({
      id: toId("sandbox-turn"),
      threadId: input.threadId,
      ...parsed,
      timestamp: new Date().toISOString(),
    });
    });
  }

  async generateEmbeddings(input: string[]) {
    return this.safeCall(async () => {
    if (input.length === 0) {
      return [];
    }

    const response = await this.client.embeddings.create({
      model: runtimeEnv.openAiEmbeddingModel,
      input,
    });

    return response.data.map((item) => item.embedding);
    });
  }
}

function extractTextFromAnthropicContent(content: Anthropic.Message["content"]) {
  return content
    .map((block) =>
      "text" in block && typeof block.text === "string" ? block.text : "",
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractStructuredJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Anthropic gateway response was empty.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to fenced and substring parsing.
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Fall through to balanced JSON parsing.
    }
  }

  const start = trimmed.search(/[{\[]/);
  if (start === -1) {
    throw new Error("Anthropic gateway response did not contain JSON.");
  }

  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === "\\") {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}") {
      if (stack.at(-1) !== "{") {
        throw new Error("Anthropic gateway response contained malformed JSON.");
      }
      stack.pop();
    } else if (char === "]") {
      if (stack.at(-1) !== "[") {
        throw new Error("Anthropic gateway response contained malformed JSON.");
      }
      stack.pop();
    } else {
      continue;
    }

    if (stack.length === 0) {
      return JSON.parse(trimmed.slice(start, index + 1));
    }
  }

  throw new Error("Anthropic gateway response was not valid JSON.");
}

class AnthropicProvider implements AiProviderAdapter {
  provider = "anthropic" as const;
  private client = new Anthropic({
    apiKey: runtimeEnv.anthropicApiKey,
    baseURL: runtimeEnv.anthropicBaseUrl ?? undefined,
    dangerouslyAllowBrowser: true,
  });

  private getRequestOptions() {
    if (!runtimeEnv.anthropicBaseUrl) {
      return undefined;
    }

    return {
      headers: {
        Authorization: `Bearer ${runtimeEnv.anthropicApiKey}`,
      },
    };
  }

  private async callWithSchema<T extends object>(params: {
    model: string;
    maxTokens: number;
    system: string;
    messages: Anthropic.MessageCreateParamsNonStreaming["messages"];
    schema: z.ZodType<T>;
    tools?: Anthropic.MessageCreateParamsNonStreaming["tools"];
  }): Promise<T> {
    const startTime = Date.now();
    const method = runtimeEnv.anthropicBaseUrl ? "gateway" : "native";

    try {
      const outputFormat = zodOutputFormat(params.schema);

      if (!runtimeEnv.anthropicBaseUrl) {
        console.log("[AI_REQUEST]", JSON.stringify({
          provider: "anthropic",
          method: "native",
          model: params.model,
          maxTokens: params.maxTokens,
        }));

        const response = await this.client.messages.parse(
          {
            model: params.model,
            max_tokens: params.maxTokens,
            system: params.system,
            messages: params.messages,
            tools: params.tools,
            output_config: {
              format: outputFormat,
            },
          },
          this.getRequestOptions(),
        );

        if (!response.parsed_output) {
          throw new Error("Anthropic response did not include parsed output.");
        }

        console.log("[AI_RESPONSE]", JSON.stringify({
          provider: "anthropic",
          method: "native",
          duration: Date.now() - startTime,
          hasParsedOutput: true,
        }));

        return params.schema.parse(response.parsed_output);
      }

      console.log("[AI_REQUEST]", JSON.stringify({
        provider: "anthropic",
        method: "gateway",
        model: params.model,
        maxTokens: params.maxTokens,
        baseUrl: runtimeEnv.anthropicBaseUrl,
      }));

      const response = await this.client.messages.create(
        {
          model: params.model,
          max_tokens: params.maxTokens,
          system: [
            params.system,
            "Only return a raw JSON object with no markdown fences or extra commentary.",
            "Use the exact field names and nesting from the schema. Do not translate keys, rename fields, or wrap the object in another object.",
            "If a field is not applicable, return an empty string or empty array that still satisfies the schema constraints.",
            `JSON schema: ${JSON.stringify(outputFormat.schema)}`,
          ].join("\n"),
          messages: params.messages,
          tools: params.tools,
        },
        this.getRequestOptions(),
      );

      const text = extractTextFromAnthropicContent(response.content);
      if (!text) {
        console.error("[AI_RESPONSE_ERROR]", JSON.stringify({
          provider: "anthropic",
          method: "gateway",
          duration: Date.now() - startTime,
          error: "No text content in response",
          responseBlocks: response.content.length,
        }));
        throw new Error(
          "Anthropic gateway response did not include text content.",
        );
      }

      console.log("[AI_RESPONSE]", JSON.stringify({
        provider: "anthropic",
        method: "gateway",
        duration: Date.now() - startTime,
        textLength: text.length,
      }));

      try {
        return params.schema.parse(extractStructuredJson(text));
      } catch (parseError) {
        console.error("[AI_PARSE_ERROR]", JSON.stringify({
          provider: "anthropic",
          method: "gateway",
          duration: Date.now() - startTime,
          textPreview: text.slice(0, 500),
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        }));
        throw parseError;
      }
    } catch (error) {
      throw toAiProviderFailure(error, this.provider);
    }
  }

  async generateInterviewEvent(input: InterviewGenerationInput) {
    const prompt = [
      "你是莫比乌斯计划的面试指挥官。",
      `目标公司：${input.session.config.targetCompany}`,
      `角色包：${input.session.config.rolePack}`,
      `岗位级别：${input.session.config.level}`,
      `职位描述：${summarizeText(input.session.config.jobDescription, 1500)}`,
      `导演状态：${JSON.stringify(input.session.directorState)}`,
      `最近轮次：${JSON.stringify(input.turns.slice(-4))}`,
      input.directorBrief ? `导演提示：${input.directorBrief}` : "",
      input.openLoops?.length ? `待补闭环：${JSON.stringify(input.openLoops)}` : "",
      input.candidateAnswer ? `最新回答：${input.candidateAnswer}` : "",
      input.preferredSpeakerId ? `指定发言人 ID：${input.preferredSpeakerId}` : "",
      input.speakerDirective ? `发言人契约：${input.speakerDirective}` : "",
      input.forcedKind ? `指定下一个事件类型：${input.forcedKind}` : "",
      input.forcedRationale ? `必须保留的理由：${input.forcedRationale}` : "",
      "只返回一个中文结构化事件。保持尖锐、高压、聚焦因果，并与发言人身份一致。",
      "以JSON格式输出，包含 id, kind, speakerId, speakerLabel, pressureDelta, message, rationale, timestamp 字段。",
    ]
      .filter(Boolean)
      .join("\n");

    const schema = LiveTurnEventSchema.omit({ sessionId: true });
    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 1024,
      system: "你是一个专业的面试模拟器，输出JSON格式。",
      messages: [{ role: "user", content: prompt }],
      schema,
    });

    return LiveTurnEventSchema.parse({
      ...result,
      sessionId: input.session.id,
      timestamp: new Date().toISOString(),
    });
  }

  async generateDiagnosticReport(input: ReportInput) {
    const pressureSnapshot = buildPressureSnapshot(input.turns);
    const prompt = [
      "你是莫比乌斯计划的诊断报告引擎。",
      `角色包：${input.session.config.rolePack}`,
      `会话配置：${JSON.stringify(input.session.config)}`,
      `面试轮次：${JSON.stringify(input.turns)}`,
      `压力元数据快照：${JSON.stringify(pressureSnapshot)}`,
      "只输出中文。保持直接、怀疑、可执行。",
      "每条 finding 都必须指向 evidenceTurnIds；evidenceAnchors 必须包含 excerpt、speakerLabel 和 note。",
      "必须显式输出 pressureMoments、recoveryMoments、pressureDrills，并优先使用 turn meta 中的 phase、timerExpired、pressureReason、seamLabel，不要凭空猜测压力轨迹。",
      "以JSON格式输出诊断报告。",
    ].join("\n");

    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 4096,
      system: "你是一个专业的面试诊断引擎，输出JSON格式。",
      messages: [{ role: "user", content: prompt }],
      schema: RelaxedDiagnosticReportSchema,
    });

    const pressureMoments =
      result.pressureMoments.length > 0
        ? result.pressureMoments
        : buildPressureMoments(input.turns);
    const pressureDrills =
      result.pressureDrills.length > 0
        ? result.pressureDrills
        : buildPressureDrills(input.session, pressureMoments, result.findings);

    return DiagnosticReportSchema.parse({
      id: toId("report"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      ...result,
      scores: result.scores.length >= 8 ? result.scores : buildFallbackScores(),
      evidence: result.evidence.length >= 3 ? result.evidence : buildFallbackEvidence(input.turns),
      findings: result.findings.length >= 1 ? result.findings : buildFallbackFinding(input.session),
      starStories: result.starStories.length >= 1 ? result.starStories : buildFallbackStarStories(),
      pressureMoments,
      recoveryMoments:
        result.recoveryMoments.length > 0
          ? result.recoveryMoments
          : buildRecoveryMoments(input.turns),
      pressureDrills,
      trainingPlan: result.trainingPlan.length >= 3 ? result.trainingPlan : buildTrainingPlanFromDrills(pressureDrills),
    });
  }

  async generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }) {
    const prompt = [
      "你是莫比乌斯计划的记忆重构引擎。",
      `会话配置：${JSON.stringify(input.session.config)}`,
      `诊断报告：${JSON.stringify(input.report)}`,
      `面试全文：${JSON.stringify(input.turns)}`,
      "输出一份可检索的中文记忆画像。每个节点都必须包含 sourceTurnIds。replayMoments 要提炼出后续可重放的关键切片。",
      "以JSON格式输出记忆画像。",
    ].join("\n");

    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 4096,
      system: "你是一个专业的记忆重构引擎，输出JSON格式。",
      messages: [{ role: "user", content: prompt }],
      schema: RelaxedMemoryProfileSchema,
    });

    const fallbackNodes = buildFallbackMemoryNodes(input.turns);

    return MemoryProfileSchema.parse({
      id: toId("memory"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      ...result,
      skills: result.skills.length >= 1 ? result.skills : fallbackNodes.skills,
      gaps: result.gaps.length >= 1 ? result.gaps : fallbackNodes.gaps,
      behaviorTraits: result.behaviorTraits.length >= 1 ? result.behaviorTraits : fallbackNodes.behaviorTraits,
      wins: result.wins.length >= 1 ? result.wins : fallbackNodes.wins,
      evidenceSpans: result.evidenceSpans.length >= 1 ? result.evidenceSpans : buildFallbackEvidenceSpans(),
    });
  }

  async generateCommandArtifact(input: CommandInput) {
    const attachmentContext = input.attachments
      .map((attachment) => {
        const preview = attachment.textContent
          ? summarizeText(attachment.textContent, 800)
          : attachment.originalName;
        return `${attachment.originalName}: ${preview}`;
      })
      .join("\n");
    const memoryContext = formatMemoryContextForPrompt(input.memoryContext);

    if (input.mode === "copilot") {
      const prompt = [
        "你是用户忠诚的工程副驾。",
        `查看者：${input.viewer.displayName}`,
        `活跃记忆上下文：${memoryContext}`,
        `最近历史：${JSON.stringify(input.history.slice(-4))}`,
        `用户输入：${input.prompt}`,
        attachmentContext ? `附件：${attachmentContext}` : "",
        "只返回中文。先给根因，再给最短修复路径，再给可选重构，最后给注意事项。尽量把建议锚定到记忆中的短板或优势。另外，在 techForesight 中给出 2-4 个前瞻性技术风险预判：考虑用户的运行环境和当前代码栈,推测未来 3-6 个月可能出现的技术债、架构瓶颈或以及具体的升级/规避建议。",
        "以JSON格式输出工程副驾建议。",
      ]
        .filter(Boolean)
        .join("\n");

      const schema = CopilotResponseSchema.omit({ id: true, mode: true });
      const result = await this.callWithSchema({
        model: runtimeEnv.anthropicModel,
        maxTokens: 4096,
        system: "你是一个专业的工程副驾，输出JSON格式。",
        messages: [{ role: "user", content: prompt }],
        schema,
      });

      return CopilotResponseSchema.parse({
        id: toId("copilot"),
        mode: "copilot",
        ...result,
      });
    }

    if (input.mode === "strategy") {
      const prompt = [
        "你是莫比乌斯计划的可行性与战略引擎。",
        `活跃记忆上下文：${memoryContext}`,
        `用户输入：${input.prompt}`,
        attachmentContext ? `附件：${attachmentContext}` : "",
        "只返回中文。必须包含市场背景、问题定义、可行性判断、架构/流程图 DSL、排期与资源、风险与前置条件，并补充 deliverables、successMetrics、assumptions 和 openQuestions。",
        "以JSON格式输出战略报告。",
      ]
        .filter(Boolean)
        .join("\n");

      const schema = StrategyReportSchema.omit({ id: true, mode: true });
      const result = await this.callWithSchema({
        model: runtimeEnv.anthropicModel,
        maxTokens: 8192,
        system: "你是一个专业的战略分析引擎，输出JSON格式。",
        messages: [{ role: "user", content: prompt }],
        schema,
        tools: runtimeEnv.anthropicBaseUrl
          ? undefined
          : [{ name: "web_search", type: "web_search_20250305" }],
      });

      return StrategyReportSchema.parse({
        id: toId("strategy"),
        mode: "strategy",
        ...result,
      });
    }

    const prompt = [
      "你是莫比乌斯计划的职场博弈沙盒。",
      `活跃记忆上下文：${memoryContext}`,
      `最近历史：${JSON.stringify(input.history.slice(-4))}`,
      `用户输入：${input.prompt}`,
      "只返回中文。必须包含当前均衡、激励、推荐动作、长期成本、pressurePoints、scenarioBranches，以及 3-5 条可直接带进会议的话术。",
      "以JSON格式输出博弈沙盒结果。",
    ].join("\n");

    const schema = SandboxOutcomeSchema.omit({ id: true, mode: true });
    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 4096,
      system: "你是一个专业的职场博弈分析引擎，输出JSON格式。",
      messages: [{ role: "user", content: prompt }],
      schema,
    });

    return SandboxOutcomeSchema.parse({
      id: toId("sandbox"),
      mode: "sandbox",
      ...result,
    });
  }

  async generateSandboxTurn(input: SandboxTurnInput): Promise<SandboxTurnEvent> {
    const memoryContext = formatMemoryContextForPrompt(input.memoryContext);
    const historyContext = input.history.length > 0
      ? `对话历史：\n${input.history.map((h) => `[${h.role === "user" ? "你" : "对手"}] ${h.content}`).join("\n")}`
      : "";

    const prompt = [
      `你的角色：${input.counterpartRole}`,
      `你的激励/动机：${input.counterpartIncentives}`,
      `对方的红线：${input.userRedLine}`,
      memoryContext ? `活跃记忆上下文：${memoryContext}` : "",
      historyContext,
      `对方刚说：${input.userMessage}`,
      "",
      "以对手的口吻回复（counterpartMessage），然后给出战术分析（strategicCommentary）。",
      "counterpartMessage：用对手的语气说话，保持职场真实感。",
      "counterpartTone：一句话描述对手这一轮的策略意图。",
      "strategicCommentary：站在第三方视角分析策略和应对建议。",
      "pressureLevel：0-10，对手这一轮的施压程度。",
      "只返回中文。以JSON格式输出。",
    ].filter(Boolean).join("\n");

    const schema = SandboxTurnEventSchema.omit({ id: true, threadId: true, timestamp: true });
    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 2048,
      system: "你是莫比乌斯计划的职场博弈沙盒对手角色扮演引擎，输出JSON格式。",
      messages: [{ role: "user", content: prompt }],
      schema,
    });

    return SandboxTurnEventSchema.parse({
      id: toId("sandbox-turn"),
      threadId: input.threadId,
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  async generateEmbeddings() {
    return null;
  }
}

let _provider: AiProviderAdapter | undefined;

export function getAiProvider(): AiProviderAdapter {
  if (!_provider) {
    if (hasAnthropic()) {
      _provider = new AnthropicProvider();
    } else if (hasOpenAi()) {
      _provider = new OpenAiProvider();
    } else {
      throw new Error("未配置 AI 提供者。请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY。");
    }
  }
  return _provider;
}

export function resetAiProvider(): void {
  _provider = undefined;
}
