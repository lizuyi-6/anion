import { describe, expect, it, vi } from "vitest";

import type { AiProviderAdapter } from "@/lib/ai/adapter";
import { createInterviewSession, generateNextInterviewBeat } from "@/lib/server/services/interview";
import { executeInterviewAnalysis } from "@/lib/server/services/analysis";
import { runCommandMode } from "@/lib/server/services/command-center";
import { MemoryDataStore } from "@/lib/server/store/repository";
import { toId } from "@/lib/utils";
import type {
  CommandArtifact,
  DiagnosticReport,
  LiveTurnEvent,
  MemoryProfile,
  SandboxTurnEvent,
} from "@/lib/domain";
import {
  CopilotResponseSchema,
  DiagnosticReportSchema,
  LiveTurnEventSchema,
  MemoryProfileSchema,
  SandboxTurnEventSchema,
} from "@/lib/domain";

// Minimal stub that satisfies AiProviderAdapter without needing real AI keys
const stubProvider: AiProviderAdapter = {
  provider: "openai",
  async generateInterviewEvent(input) {
    const interviewer =
      input.preferredSpeakerId ??
      input.session.config.interviewers[
        input.session.directorState.round % input.session.config.interviewers.length
      ];
    const lastCandidate =
      input.candidateAnswer ??
      input.turns
        .slice()
        .reverse()
        .find((turn) => turn.role === "candidate")
        ?.content ??
      "候选人给出了一个较短的回答。";
    const kind = input.forcedKind ?? "follow_up";

    return LiveTurnEventSchema.parse({
      id: toId("event"),
      sessionId: input.session.id,
      kind,
      speakerId: interviewer,
      speakerLabel: interviewer,
      pressureDelta: kind === "interrupt" ? 10 : kind === "conflict" ? 8 : 4,
      message: `你刚才提到"${lastCandidate.slice(0, 64)}"。请继续展开。`,
      rationale: input.forcedRationale ?? "继续追问核心因果关系。",
      timestamp: new Date().toISOString(),
    });
  },
  async generateDiagnosticReport(input) {
    const candidateTurns = input.turns.filter((turn) => turn.role === "candidate");
    return DiagnosticReportSchema.parse({
      id: toId("report"),
      sessionId: input.session.id,
      scores: [
        { key: "structure", label: "结构清晰度", score: 58, signal: "有待提升" },
        { key: "evidence", label: "证据充分性", score: 62, signal: "中等" },
        { key: "boundary", label: "边界意识", score: 55, signal: "有待提升" },
        { key: "pressure", label: "抗压能力", score: 60, signal: "中等" },
        { key: "recovery", label: "恢复能力", score: 65, signal: "中等偏上" },
        { key: "conciseness", label: "简洁度", score: 50, signal: "有待提升" },
        { key: "tradeoff", label: "取舍表达", score: 58, signal: "有待提升" },
        { key: "closure", label: "闭环意识", score: 55, signal: "有待提升" },
      ],
      evidence: [
        ...candidateTurns.slice(0, 3).map((turn) => turn.content.slice(0, 100)),
        ...Array.from({ length: Math.max(0, 3 - candidateTurns.length) }, () => "测试证据条目。"),
      ],
      evidenceAnchors: [],
      findings: [
        {
          title: "需要更多练习数据",
          severity: "medium",
          category: "综合评估",
          detail: "当前测试数据不足以生成精准诊断。",
          recommendation: "继续进行模拟面试。",
          evidenceTurnIds: candidateTurns.slice(0, 1).map((turn) => turn.id),
          impact: "诊断报告需要更多数据。",
        },
      ],
      starStories: [
        {
          title: "待挖掘的 STAR 案例",
          situation: "测试场景。",
          task: "测试任务。",
          action: "测试行动。",
          result: "测试结果。",
        },
      ],
      pressureMoments: [],
      recoveryMoments: [],
      pressureDrills: [],
      trainingPlan: [
        "围绕最容易失守的回答链路做 20 分钟限时复练。",
        "围绕最容易失守的回答链路做 20 分钟限时复练。",
        "围绕最容易失守的回答链路做 20 分钟限时复练。",
      ],
      generatedAt: new Date().toISOString(),
    });
  },
  async generateMemoryProfile(input) {
    const candidateTurns = input.turns.filter((turn) => turn.role === "candidate");
    return MemoryProfileSchema.parse({
      id: toId("memory"),
      sessionId: input.session.id,
      skills: [
        { label: "结构化表达", summary: "能在高压下保持回答结构。", confidence: 0.7, sourceTurnIds: candidateTurns.slice(0, 1).map((t) => t.id) },
      ],
      gaps: [
        { label: "证据密度", summary: "部分回答的证据支撑不够充分。", confidence: 0.6, sourceTurnIds: candidateTurns.slice(0, 1).map((t) => t.id) },
      ],
      behaviorTraits: [
        { label: "抗压节奏", summary: "在追问下能保持基本节奏。", confidence: 0.65, sourceTurnIds: [] },
      ],
      wins: [
        { label: "核心亮点", summary: "有待提炼的优势项。", confidence: 0.5, sourceTurnIds: [] },
      ],
      evidenceSpans: [
        { label: "高光切片", excerpt: candidateTurns[0]?.content.slice(0, 100) ?? "暂无", sourceTurnId: candidateTurns[0]?.id ?? "" },
      ],
      replayMoments: [],
      generatedAt: new Date().toISOString(),
    });
  },
  async generateCommandArtifact(input) {
    if (input.mode === "copilot") {
      return CopilotResponseSchema.parse({
        id: toId("copilot"),
        mode: "copilot",
        rootCause: "测试根因分析。",
        shortestFix: ["步骤一", "步骤二"],
        optionalRefactors: ["重构建议"],
        memoryAnchor: "测试记忆锚点。",
        watchouts: ["注意事项一"],
        techForesight: [],
      });
    }
    return { id: toId("cmd"), mode: input.mode } as CommandArtifact;
  },
  async generateSandboxTurn(input) {
    return SandboxTurnEventSchema.parse({
      id: toId("sandbox-turn"),
      threadId: input.threadId,
      counterpartMessage: "测试对手回复。",
      counterpartTone: "测试语气。",
      strategicCommentary: "测试策略分析。",
      pressureLevel: 5,
      timestamp: new Date().toISOString(),
    });
  },
  async generateEmbeddings() {
    return null;
  },
};

vi.mock("@/lib/ai/adapter", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/adapter")>();
  return {
    ...original,
    getAiProvider: () => stubProvider,
  };
});

describe("interview to command center flow", () => {
  it("runs a full session from interview through hub activation", async () => {
    const store = new MemoryDataStore();
    globalThis.__mobiusStore = store;

    const viewer = store.getDemoViewer("engineering");
    const session = await createInterviewSession(viewer, {
      rolePack: "engineering",
      targetCompany: "OpenAI",
      industry: "AI",
      level: "Senior",
      focusGoal: "被打断后仍能在 60 秒内给出结论、证据和代价",
      jobDescription: "Build reliable systems and defend architecture trade-offs under pressure.",
      interviewers: ["hacker", "architect", "founder"],
      materials: [],
      candidateName: "Abraham",
    });
    const initialTurns = await store.listTurns(session.id);

    const beat = await generateNextInterviewBeat({
      store,
      session,
      turns: initialTurns,
      answer:
        "我会先守住接口边界，再用版本化写入保证弱网重试的一致性，因为最先失控的是写路径的并发和回滚成本。",
    });
    expect(beat.events.length).toBeGreaterThan(0);

    const analysis = await executeInterviewAnalysis({
      sessionId: session.id,
      store,
    });
    expect(analysis.report.evidenceAnchors).toBeDefined();
    expect(analysis.memoryProfile).toBeDefined();

    await store.updateSession(session.id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });
    await store.setWorkspaceMode(viewer.id, "command_center");
    await store.activateMemoryProfile(session.id, viewer.id);
    await store.updateSession(session.id, {
      status: "hub_active",
    });

    const memoryContext = await store.getActiveMemoryContext(viewer.id);
    const result = await runCommandMode({
      store,
      viewer: {
        ...viewer,
        workspaceMode: "command_center",
      },
      mode: "copilot",
      input: "线上出现一个状态切换后 UI 不刷新的 bug，帮我定位根因。",
      attachments: [],
      memoryContext,
    });

    expect(result.artifact.mode).toBe("copilot");
    if (result.artifact.mode !== "copilot") {
      throw new Error("期望得到副驾产物");
    }
    expect(result.artifact.watchouts.length).toBeGreaterThan(0);
    expect((await store.getSession(session.id))?.status).toBe("hub_active");
  });
});
