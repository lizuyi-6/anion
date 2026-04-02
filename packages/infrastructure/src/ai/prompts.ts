/**
 * Centralized AI prompt templates.
 *
 * Architecture:
 * - System prompts are exported as static strings (used by AnthropicProvider).
 * - User/content prompts are exported as builder functions that accept structured
 *   inputs and return formatted prompt strings.
 * - Each provider imports the prompts it needs — no provider-specific branching here.
 *
 * Future improvements:
 * - Move to remote config for A/B testing prompt variants
 * - Add prompt versioning metadata
 */

import { summarizeText } from "@anion/shared/utils";
import type {
  CommandInput,
  DiagnosticReportInput,
  InterviewGenerationInput,
  MemoryProfileInput,
  SandboxTurnInput,
} from "./types.js";

// ---------------------------------------------------------------------------
// System prompts — used by AnthropicProvider.callWithSchema()
// ---------------------------------------------------------------------------

export const INTERVIEW_SYSTEM = "你是一个专业的面试模拟器，输出JSON格式。";
export const DIAGNOSTIC_SYSTEM = "你是一个专业的面试诊断引擎，输出JSON格式。";
export const MEMORY_SYSTEM = "你是一个专业的记忆重构引擎，输出JSON格式。";
export const COPILOT_SYSTEM = "你是一个专业的工程副驾，输出JSON格式。";
export const STRATEGY_SYSTEM = "你是一个专业的战略分析引擎，输出JSON格式。";
export const SANDBOX_SYSTEM = "你是一个专业的职场博弈分析引擎，输出JSON格式。";
export const SANDBOX_TURN_SYSTEM =
  "你是莫比乌斯计划的职场博弈沙盒对手角色扮演引擎，输出JSON格式。";

// ---------------------------------------------------------------------------
// Gateway system suffix — appended when using ANTHROPIC_BASE_URL
// ---------------------------------------------------------------------------

export function buildGatewaySystemSuffix(schemaJson: string): string {
  return [
    "Only return a raw JSON object with no markdown fences or extra commentary.",
    "Use the exact field names and nesting from the schema. Do not translate keys, rename fields, or wrap the object in another object.",
    "If a field is not applicable, return an empty string or empty array that still satisfies the schema constraints.",
    `JSON schema: ${schemaJson}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Interview prompts
// ---------------------------------------------------------------------------

export function buildInterviewUserPrompt(input: InterviewGenerationInput): string {
  return [
    "你是莫比乌斯计划的面试指挥官。",
    `目标公司：${input.session.config.targetCompany}`,
    `角色包：${input.session.config.rolePack}`,
    `岗位级别：${input.session.config.level}`,
    `职位描述：${summarizeText(input.session.config.jobDescription, 1500)}`,
    `导演状态：${JSON.stringify(input.session.directorState)}`,
    `最近轮次：${JSON.stringify(input.turns.slice(-4))}`,
    input.directorBrief ? `导演提示：${input.directorBrief}` : "",
    input.openLoops?.length
      ? `待补闭环：${JSON.stringify(input.openLoops)}`
      : "",
    input.candidateAnswer ? `最新回答：${input.candidateAnswer}` : "",
    input.preferredSpeakerId
      ? `指定发言人 ID：${input.preferredSpeakerId}`
      : "",
    input.speakerDirective
      ? `发言人契约：${input.speakerDirective}`
      : "",
    input.forcedKind
      ? `指定下一个事件类型：${input.forcedKind}`
      : "",
    input.forcedRationale
      ? `必须保留的理由：${input.forcedRationale}`
      : "",
    "只返回一个中文结构化JSON对象，包含 id, kind, speakerId, speakerLabel, pressureDelta, message, rationale, timestamp 字段。保持尖锐、高压、聚焦因果，并与发言人身份一致。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Diagnostic report prompts
// ---------------------------------------------------------------------------

export function buildDiagnosticUserPrompt(input: DiagnosticReportInput): string {
  return [
    "你是莫比乌斯计划的诊断报告引擎。",
    `角色包：${input.session.config.rolePack}`,
    `会话配置：${JSON.stringify(input.session.config)}`,
    `面试轮次：${JSON.stringify(input.turns)}`,
    "只输出中文JSON。保持直接、怀疑、可执行。",
    "每条 finding 都必须指向 evidenceTurnIds；evidenceAnchors 必须包含 excerpt、speakerLabel 和 note。",
    "输出一个JSON对象，包含 id, sessionId, generatedAt 之外的所有 DiagnosticReportSchema 字段。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Memory profile prompts
// ---------------------------------------------------------------------------

export function buildMemoryUserPrompt(input: MemoryProfileInput): string {
  return [
    "你是莫比乌斯计划的记忆重构引擎。",
    `会话配置：${JSON.stringify(input.session.config)}`,
    `诊断报告：${JSON.stringify(input.report)}`,
    `面试全文：${JSON.stringify(input.turns)}`,
    "输出一份可检索的中文记忆画像JSON。每个节点都必须包含 sourceTurnIds。replayMoments 要提炼出后续可重放的关键切片。",
    "输出一个JSON对象，包含 id, sessionId, generatedAt 之外的所有 MemoryProfileSchema 字段。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Command artifact prompts — copilot (MiniMax variant)
// ---------------------------------------------------------------------------

export function buildCopilotUserPrompt(
  input: CommandInput,
  memoryContext: string,
  attachmentContext: string | undefined,
): string {
  return [
    "你是用户忠诚的工程副驾。",
    `查看者：${input.viewer.displayName}`,
    `活跃记忆上下文：${memoryContext}`,
    `最近历史：${JSON.stringify(input.history.slice(-4))}`,
    `用户输入：${input.prompt}`,
    attachmentContext ? `附件：${attachmentContext}` : "",
    "只返回中文JSON。先给根因，再给最短修复路径，再给可选重构，最后给注意事项。尽量把建议锚定到记忆中的短板或优势。",
    "在 techForesight 中给出 2-4 个前瞻性技术风险预判：考虑用户的运行环境和当前代码栈,推测未来 3-6 个月可能出现的技术债、架构瓶颈或以及具体的升级/规避建议。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Command artifact prompts — copilot (OpenAI variant)
// ---------------------------------------------------------------------------

export function buildCopilotUserPromptOpenAi(
  input: CommandInput,
  memoryContext: string,
  attachmentContext: string | undefined,
): string {
  return [
    "你是用户忠诚的工程副驾。",
    `查看者：${input.viewer.displayName}`,
    `活跃记忆上下文：${memoryContext}`,
    `最近历史：${JSON.stringify(input.history.slice(-4))}`,
    `用户输入：${input.prompt}`,
    attachmentContext ? `附件：${attachmentContext}` : "",
    "只返回中文。先给根因，再给最短修复路径，再给可选重构，最后给注意事项。尽量把建议锚定到记忆中的短板或优势。另外，在 techForesight 中给出 2-4 个前瞻性技术风险预判：考虑用户的运行环境和当前代码栈，推测未来 3-6 个月可能出现的技术债、架构瓶颈或以及具体的升级/规避建议。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Command artifact prompts — strategy (MiniMax variant)
// ---------------------------------------------------------------------------

export function buildStrategyUserPrompt(
  input: CommandInput,
  memoryContext: string,
  attachmentContext: string | undefined,
): string {
  return [
    "你是莫比乌斯计划的可行性与战略引擎。",
    `活跃记忆上下文：${memoryContext}`,
    `用户输入：${input.prompt}`,
    attachmentContext ? `附件：${attachmentContext}` : "",
    "只返回中文JSON。必须包含市场背景、问题定义、可行性判断、架构/流程图 DSL、排期与资源、风险与前置条件，并补充 deliverables、successMetrics、assumptions 和 openQuestions。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Command artifact prompts — strategy (OpenAI variant)
// ---------------------------------------------------------------------------

export function buildStrategyUserPromptOpenAi(
  input: CommandInput,
  memoryContext: string,
  attachmentContext: string | undefined,
): string {
  return [
    "你是莫比乌斯计划的可行性与战略引擎。",
    `活跃记忆上下文：${memoryContext}`,
    `用户输入：${input.prompt}`,
    attachmentContext ? `附件：${attachmentContext}` : "",
    "只返回中文。必须包含市场背景、问题定义、可行性判断、架构/流程图 DSL、排期与资源、风险与前置条件，并补充 deliverables、successMetrics、assumptions 和 openQuestions。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Command artifact prompts — sandbox (MiniMax variant)
// ---------------------------------------------------------------------------

export function buildSandboxUserPrompt(
  input: CommandInput,
  memoryContext: string,
): string {
  return [
    "你是莫比乌斯计划的职场博弈沙盒。",
    `活跃记忆上下文：${memoryContext}`,
    `最近历史：${JSON.stringify(input.history.slice(-4))}`,
    `用户输入：${input.prompt}`,
    "只返回中文JSON。必须包含当前均衡、激励、推荐动作、长期成本、pressurePoints、scenarioBranches，以及 3-5 条可直接带进会议的话术。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Command artifact prompts — sandbox (OpenAI variant)
// ---------------------------------------------------------------------------

export function buildSandboxUserPromptOpenAi(
  input: CommandInput,
  memoryContext: string,
): string {
  return [
    "你是莫比乌斯计划的职场博弈沙盒。",
    `活跃记忆上下文：${memoryContext}`,
    `最近历史：${JSON.stringify(input.history.slice(-4))}`,
    `用户输入：${input.prompt}`,
    "只返回中文。必须包含当前均衡、激励、推荐动作、长期成本、pressurePoints、scenarioBranches，以及 3-5 条可直接带进会议的话术。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sandbox turn prompts (MiniMax variant)
// ---------------------------------------------------------------------------

export function buildSandboxTurnUserPrompt(
  input: SandboxTurnInput,
  memoryContext: string | undefined,
  historyContext: string | undefined,
): string {
  return [
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
    "只返回中文JSON。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sandbox turn prompts (OpenAI variant)
// ---------------------------------------------------------------------------

export function buildSandboxTurnUserPromptOpenAi(
  input: SandboxTurnInput,
  memoryContext: string | undefined,
  historyContext: string | undefined,
): string {
  return [
    "你是莫比乌斯计划的职场博弈沙盒中的对手角色扮演引擎。",
    `你的角色：${input.counterpartRole}`,
    `你的激励/动机：${input.counterpartIncentives}`,
    `对方的红线：${input.userRedLine}`,
    memoryContext ? `活跃记忆上下文：${memoryContext}` : "",
    historyContext,
    `对方刚说：${input.userMessage}`,
    "",
    "你必须以对手的口吻回复（counterpartMessage），然后给出你的战术分析（strategicCommentary）。",
    "counterpartMessage：用对手的语气和策略说话。可以是施压、诱惑、转移话题、制造混乱、或者假装让步。保持职场真实感。",
    "counterpartTone：一句话描述对手这一轮的策略意图。",
    "strategicCommentary：站在第三方视角，分析对手的策略和用户的应对建议。",
    "pressureLevel：0-10，表示对手这一轮的施压程度。",
    "只返回中文。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Interview prompts (OpenAI variant — no "JSON对象" suffix)
// ---------------------------------------------------------------------------

export function buildInterviewUserPromptOpenAi(
  input: InterviewGenerationInput,
): string {
  return [
    "你是莫比乌斯计划的面试指挥官。",
    `目标公司：${input.session.config.targetCompany}`,
    `角色包：${input.session.config.rolePack}`,
    `岗位级别：${input.session.config.level}`,
    `职位描述：${summarizeText(input.session.config.jobDescription, 1500)}`,
    `导演状态：${JSON.stringify(input.session.directorState)}`,
    `最近轮次：${JSON.stringify(input.turns.slice(-4))}`,
    input.directorBrief ? `导演提示：${input.directorBrief}` : "",
    input.openLoops?.length
      ? `待补闭环：${JSON.stringify(input.openLoops)}`
      : "",
    input.candidateAnswer ? `最新回答：${input.candidateAnswer}` : "",
    input.preferredSpeakerId
      ? `指定发言人 ID：${input.preferredSpeakerId}`
      : "",
    input.speakerDirective
      ? `发言人契约：${input.speakerDirective}`
      : "",
    input.forcedKind
      ? `指定下一个事件类型：${input.forcedKind}`
      : "",
    input.forcedRationale
      ? `必须保留的理由：${input.forcedRationale}`
      : "",
    "只返回一个中文结构化事件。保持尖锐、高压、聚焦因果，并与发言人身份一致。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Diagnostic report prompts (OpenAI variant — no schema output line, backticks)
// ---------------------------------------------------------------------------

export function buildDiagnosticUserPromptOpenAi(
  input: DiagnosticReportInput,
): string {
  return [
    "你是莫比乌斯计划的诊断报告引擎。",
    `角色包：${input.session.config.rolePack}`,
    `会话配置：${JSON.stringify(input.session.config)}`,
    `面试轮次：${JSON.stringify(input.turns)}`,
    "只输出中文。保持直接、怀疑、可执行。",
    "每条 finding 都必须指向 evidenceTurnIds；evidenceAnchors 必须包含 `excerpt`、`speakerLabel` 和 `note`。",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Memory profile prompts (OpenAI variant — no "JSON" suffix, backticks)
// ---------------------------------------------------------------------------

export function buildMemoryUserPromptOpenAi(
  input: MemoryProfileInput,
): string {
  return [
    "你是莫比乌斯计划的记忆重构引擎。",
    `会话配置：${JSON.stringify(input.session.config)}`,
    `诊断报告：${JSON.stringify(input.report)}`,
    `面试全文：${JSON.stringify(input.turns)}`,
    "输出一份可检索的中文记忆画像。每个节点都必须包含 `sourceTurnIds`。`replayMoments` 要提炼出后续可重放的关键切片。",
  ]
    .filter(Boolean)
    .join("\n");
}
