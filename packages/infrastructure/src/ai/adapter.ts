import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { toAiProviderFailure } from "./errors";
import {
  buildCopilotUserPrompt,
  buildCopilotUserPromptOpenAi,
  buildDiagnosticUserPrompt,
  buildDiagnosticUserPromptOpenAi,
  buildGatewaySystemSuffix,
  buildInterviewUserPrompt,
  buildInterviewUserPromptOpenAi,
  buildMemoryUserPrompt,
  buildMemoryUserPromptOpenAi,
  buildSandboxTurnUserPrompt,
  buildSandboxTurnUserPromptOpenAi,
  buildSandboxUserPrompt,
  buildSandboxUserPromptOpenAi,
  buildStrategyUserPrompt,
  buildStrategyUserPromptOpenAi,
  COPILOT_SYSTEM,
  DIAGNOSTIC_SYSTEM,
  INTERVIEW_SYSTEM,
  MEMORY_SYSTEM,
  SANDBOX_SYSTEM,
  SANDBOX_TURN_SYSTEM,
  STRATEGY_SYSTEM,
} from "./prompts";
import { hasMiniMax, hasOpenAi, hasAnthropic, runtimeEnv } from "@anion/config";
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
} from "@anion/contracts";
import {
  CopilotResponseSchema,
  DiagnosticReportSchema,
  LiveTurnEventSchema,
  MemoryProfileSchema,
  SandboxOutcomeSchema,
  SandboxTurnEventSchema,
  StrategyReportSchema,
  getRolePack,
} from "@anion/contracts";
import { sentenceSplit, summarizeText, toId } from "@anion/shared/utils";

export type InterviewGenerationInput = {
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

export type ReportInput = {
  session: InterviewSession;
  turns: InterviewTurn[];
};

export type CommandInput = {
  mode: CommandMode;
  viewer: Viewer;
  memoryContext: ActiveMemoryContext | null;
  prompt: string;
  attachments: UploadReference[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

export type SandboxTurnInput = {
  threadId: string;
  history: Array<{ role: "user" | "counterpart"; content: string }>;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  memoryContext: ActiveMemoryContext | null;
};

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

export interface AiProviderAdapter {
  provider: "mock" | "openai" | "anthropic" | "minimax";
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

class MockAiProvider implements AiProviderAdapter {
  provider = "mock" as const;

  async generateInterviewEvent(input: InterviewGenerationInput) {
    const interviewer =
      input.preferredSpeakerId ??
      input.session.config.interviewers[
        input.session.directorState.round % input.session.config.interviewers.length
      ];
    const personaMap: Record<string, string[]> = {
      hacker: [
        "别抽象。直接把复杂度、内存边界、并发控制和失败条件说清楚。",
        "你的实现方案在极端情况下会出现什么问题？",
        "这个技术决策的权衡点在哪里？",
      ],
      architect: [
        "把数据流、瓶颈、降级路径和回滚条件画出来。",
        "这个架构的扩展性如何？当规模增长10倍时会发生什么？",
        "你选择的方案和其他备选方案相比优势在哪里？",
      ],
      founder: [
        "告诉我这个取舍为什么值得赌，代价由谁承担。",
        "这个决策的用户价值和商业价值是什么？",
        "如果这个决策失败了，你有什么应对方案？",
      ],
      strategist: [
        "先把需求钉住，再谈实现路径。",
        "这个策略的假设前提是什么？",
        "如何验证这个策略的有效性？",
      ],
      operator: [
        "给负责人、时间、指标和控制回路，不要给愿景。",
        "这个流程的实际执行细节是什么？",
        "执行过程中可能遇到的阻力是什么？",
      ],
      analyst: [
        "指出真正支撑结论的证据，不要拿结论重复包装自己。",
        "这个分析的边界条件是什么？",
        "你用什么数据支撑这个结论？",
      ],
      people_leader: [
        "说清楚你怎么在压力下守住标准又不丢掉队伍。",
        "这个决策对团队成员有什么影响？",
        "你如何平衡不同成员的需求？",
      ],
      cross_functional_director: [
        "别假设别人会配合。说清你的杠杆、筹码和退路。",
        "这个决策涉及哪些利益相关方？",
        "你如何协调不同部门的优先级？",
      ],
    };
    
    const interviewerPersona = personaMap[interviewer] ?? personaMap["analyst"];
    const directive = Array.isArray(interviewerPersona)
      ? interviewerPersona[Math.floor(Math.random() * interviewerPersona.length)]
      : interviewerPersona;

    const lastCandidate =
      input.candidateAnswer ??
      input.turns
        .slice()
        .reverse()
        .find((turn) => turn.role === "candidate")
        ?.content ??
      "候选人给出了一个较短的回答。";
    const seed = sentenceSplit(lastCandidate).at(0) ?? lastCandidate;
    const kind = input.forcedKind ?? "follow_up";

    const seam = input.openLoops?.[0]
      ? `当前缺口：${input.openLoops[0]}`
      : `当前缺口：${summarizeText(seed, 72)}`;

    return LiveTurnEventSchema.parse({
      id: toId("event"),
      sessionId: input.session.id,
      kind,
      speakerId: interviewer,
      speakerLabel: interviewer,
      pressureDelta: kind === "interrupt" ? 10 : kind === "conflict" ? 8 : 4,
      message:
        kind === "interrupt"
          ? `停。${seam} ${input.speakerDirective ?? directive}`
          : kind === "conflict"
            ? `我不同意。${seam} ${input.speakerDirective ?? directive}`
            : `你刚才提到"${summarizeText(seed, 64)}"。${input.speakerDirective ?? directive}`,
      rationale:
        input.forcedRationale ??
        input.directorBrief ??
        "继续压迫没有被解释清楚的那一层因果关系。",
      timestamp: new Date().toISOString(),
    });
  }

  async generateDiagnosticReport(input: ReportInput) {
    const rolePack = getRolePack(input.session.config.rolePack);
    const axes = [...rolePack.sharedAxes, ...rolePack.specialtyAxes];
    const candidateTurns = input.turns.filter((turn) => turn.role === "candidate");
    const evidenceAnchors = buildEvidenceAnchors(input.turns);
    const evidence = candidateTurns
      .slice(0, 4)
      .map((turn) => summarizeText(turn.content, 140));

    while (evidence.length < 3) {
      evidence.push("候选人给出了一个可用但对压力较敏感的回答框架。");
    }

    return DiagnosticReportSchema.parse({
      id: toId("report"),
      sessionId: input.session.id,
      scores: axes.map((label, index) => ({
        key: `axis_${index + 1}`,
        label,
        score: 58 + ((index * 7) % 24),
        signal:
          index % 2 === 0
            ? "高压下结构还在，但证据密度不够。"
            : "判断能成立，但落结论的速度仍然偏慢。",
      })),
      evidence,
      evidenceAnchors,
      findings: [
        {
          title: "结论出现得太晚",
          severity: "major",
          category: "communication",
          detail: "被追问后，你会先重建背景，再落实际判断，导致主线被打散。",
          recommendation: "先给结论，再给一条证据和一个边界条件，别倒着讲。",
          evidenceTurnIds: candidateTurns.slice(0, 2).map((turn) => turn.id),
          impact: "面试官会在你真正回答之前找到新的打断切口。",
        },
        {
          title: "取舍证明仍然偏薄",
          severity: "medium",
          category: "engineering",
          detail: "你已经能说出约束，但为什么选这个方案、代价是什么，证据还不够硬。",
          recommendation: "用更紧的顺序回答：约束 -> 选项 -> 取舍 -> 代价。",
          evidenceTurnIds: candidateTurns.slice(1, 3).map((turn) => turn.id),
          impact: "架构判断听起来合理，但仍然很容易被继续深挖击穿。",
        },
      ],
      starStories: [
        {
          title: "高压下重建决策主线",
          situation: "面试里出现了相互冲突的限制条件，解释空间被迅速压缩。",
          task: "在不失去可信度的前提下，把答案重新拉回主决策链路。",
          action: "把回答压回核心约束，延后次要问题，重新锚定目标函数。",
          result: "把一段发散防守，重新收束成了可执行的判断框架。",
        },
      ],
      trainingPlan: [
        "练习 90 秒回答模板：先判断，再证据，再边界。",
        "每个取舍结论都绑定一个可核验的证明点。",
        "围绕最低的两个雷达维度做高打断密度复盘。",
      ],
      generatedAt: new Date().toISOString(),
    });
  }

  async generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }) {
    const candidateTurns = input.turns.filter((turn) => turn.role === "candidate");
    const firstTurn = candidateTurns[0];
    const secondTurn = candidateTurns[1] ?? firstTurn;
    const replayMoments = buildReplayMoments(input.session, input.turns);

    return MemoryProfileSchema.parse({
      id: toId("memory"),
      sessionId: input.session.id,
      skills: [
        {
          label: "高压下仍能保住回答骨架",
          summary: "被打断后能迅速回到主线，而不是从头重讲。",
          confidence: 0.82,
          sourceTurnIds: firstTurn ? [firstTurn.id] : [],
        },
      ],
      gaps: [
        {
          label: "证据密度不稳定",
          summary: "判断常常先于证明出现，容易引来下一轮怀疑和追问。",
          confidence: 0.78,
          sourceTurnIds: secondTurn ? [secondTurn.id] : [],
        },
      ],
      behaviorTraits: [
        {
          label: "压力一高就先解释再判断",
          summary: "遇到追问时倾向于先补背景，再给结论。",
          confidence: 0.73,
          sourceTurnIds: secondTurn ? [secondTurn.id] : [],
        },
      ],
      wins: [
        {
          label: "被打断后恢复快",
          summary: "不会被打断本身带跑，而是能尽快回到核心问题。",
          confidence: 0.8,
          sourceTurnIds: firstTurn ? [firstTurn.id] : [],
        },
      ],
      evidenceSpans: [
        {
          label: "高光切片",
          excerpt: summarizeText(firstTurn?.content ?? "候选人在高压下重新拧回了主线。", 180),
          sourceTurnId: firstTurn?.id ?? toId("turn"),
        },
      ],
      replayMoments,
      generatedAt: new Date().toISOString(),
    });
  }

  async generateCommandArtifact(input: CommandInput) {
    const memoryProfile = input.memoryContext?.profile ?? null;
    const memoryHints = [
      ...(memoryProfile?.gaps.slice(0, 2).map((item) => item.summary) ?? []),
      ...(memoryProfile?.wins.slice(0, 2).map((item) => item.summary) ?? []),
    ];

    if (input.mode === "copilot") {
      return CopilotResponseSchema.parse({
        id: toId("copilot"),
        mode: "copilot",
        rootCause: "这更像是状态边界没收紧，而不是一个孤立的语法或 API 误用。",
        shortestFix: [
          "先把问题压缩成一条可复现路径，并记下最后一个已知正常状态。",
          "先核对状态切换和所有权边界，再动外围代码。",
        ],
        optionalRefactors: [
          "把隐式共享状态收敛成一个显式契约，避免同类问题反复出现。",
        ],
        memoryAnchor:
          memoryHints[0] ??
          "你在先定位根缝、再展开解释的时候，输出质量会明显更高。",
        watchouts: [
          "不要一上来同时改状态流和渲染层，否则回归面会失控。",
          "如果日志只证明症状，不要把它误当成根因证据。",
        ],
        techForesight: [
          {
            technology: "状态同步机制 (WebSocket/SSE)",
            risk: "medium",
            timeline: "未来3-6个月",
            recommendation: "当前的长轮询在并发>200时会堆积。建议提前规划向推送架构迁移，减少实时同步依赖。",
          },
          {
            technology: "边缘计算 / 弱网环境适配",
            risk: "high",
            timeline: "未来1-3个月",
            recommendation: "如果涉及IoT或移动端场景，必须提前设计离线优先策略和弱网降级方案。",
          },
        ],
      });
    }

    if (input.mode === "strategy") {
      return StrategyReportSchema.parse({
        id: toId("strategy"),
        mode: "strategy",
        sections: [
          {
            id: "market",
            title: "市场背景",
            body: "机会方向成立，但需求信号仍然需要更硬的验证，尤其是在真正扩大投入之前。",
          },
          {
            id: "problem",
            title: "问题定义",
            body: "先把模糊需求压缩成一个明确用户痛点、一个业务结果，以及一个可观测变化。",
          },
          {
            id: "feasibility",
            title: "可行性判断",
            body: "技术上可做，真正风险在跨团队对齐、接口控制权和数据归属，而不是实现本身。",
          },
          {
            id: "architecture",
            title: "架构/流程图 DSL",
            body: "优先打通从触发到用户可见价值的最薄路径，再逐步补控制面、报表和回滚机制。",
          },
          {
            id: "timeline",
            title: "排期与资源",
            body: "先做短探索，再上窄 MVP，最后按证据推进受控放量，而不是一开始就铺满全量方案。",
          },
          {
            id: "risks",
            title: "风险与前置条件",
            body: "责任不清、指标漂移和接口控制权缺失，是这类项目停摆的三大主因。",
          },
        ],
        citations: [],
        diagramSpec: {
          nodes: [
            { id: "signal", label: "需求信号", lane: 0 },
            { id: "mvp", label: "最小可行版本", lane: 1 },
            { id: "scale", label: "放量控制", lane: 2 },
          ],
          edges: [
            { from: "signal", to: "mvp", label: "已验证痛点" },
            { from: "mvp", to: "scale", label: "已测得牵引" },
          ],
        },
        timelineSpec: {
          items: [
            { phase: "探索", startWeek: 1, durationWeeks: 2, owner: "战略" },
            { phase: "最小可行版本", startWeek: 3, durationWeeks: 3, owner: "产品 + 工程" },
            { phase: "放量", startWeek: 6, durationWeeks: 2, owner: "运营" },
          ],
        },
        risks: [
          "如果两周内没有单点 owner 锁住范围，方案会开始漂移。",
          "如果指标定义始终模糊，后续复盘无法支撑继续投入。",
        ],
        deliverables: [
          "一版可执行的产品需求文档 / 可行性研究主文档",
          "一张端到端数据/业务流程图",
          "一个按周拆解的里程碑与资源表",
        ],
        successMetrics: [
          "上线后两周内核心指标能被稳定采集和解释",
          "关键链路 owner、接口和验收标准在立项阶段已锁定",
        ],
        assumptions: [
          "现有团队具备交付最小可行版本所需的工程能力",
          "业务方愿意为首版验证让渡部分范围和节奏",
        ],
        openQuestions: [
          "谁拥有跨团队接口的最终仲裁权？",
          "如果试点指标不达标，哪条路径负责及时止损？",
        ],
      });
    }

    return SandboxOutcomeSchema.parse({
      id: toId("sandbox"),
      mode: "sandbox",
      counterpartModel: {
        style: "强势、结果导向、并且会在会议中实时重写规则。",
        incentives: ["保住控制权", "避免额外背锅"],
        redLines: ["公开失去面子", "承诺不可控交付"],
      },
      equilibrium: "当前均衡是：对方保留决策权，把交付风险持续往你这边转移。",
      recommendedMove: "接受目标，但必须在会议结束前把责任边界和接口控制权锁成明文。",
      longTermCost: "如果这次让步，后续资源争夺会默认你持续承担成本却拿不到控制权。",
      pressurePoints: [
        "对方想要结果，但不想承担结果对应的约束。",
        "会议中最危险的时刻不是争吵，而是含糊承诺被默认为你接受。",
      ],
      talkTracks: [
        "交付我可以扛，但接口 owner 和验收标准今天必须锁死。",
        "如果结果由我负责，那数据权限和节奏控制也必须同步给到我。",
        "范围可以收，但责任边界不能继续模糊。",
      ],
      scenarioBranches: [
        {
          name: "你强硬守边界",
          ifYouPush: "短期气氛会变硬，但后续责任归属会明显更清楚。",
          ifYouConcede: "对方会默认你愿意继续无条件吸收风险。",
          signalToWatch: "对方是否开始主动讨论 owner、接口和验收标准。",
        },
      ],
      payoffMatrix: {
        rowHeader: "你",
        colHeader: "对手",
        rows: [
          { label: "强硬", payoffs: ["双赢：各守边界", "你赢：对方让步"] },
          { label: "让步", payoffs: ["你输：对方蚕食", "双输：关系破裂"] },
        ],
        nashEquilibrium: "(强硬,强硬) — 双方各守边界，达成不稳定均衡。谁先让步谁就输。",
      },
    });
  }

  async generateSandboxTurn(input: SandboxTurnInput): Promise<SandboxTurnEvent> {
    return SandboxTurnEventSchema.parse({
      id: toId("sandbox-turn"),
      threadId: input.threadId,
      counterpartMessage: "我可以给你资源，但你得先交出接口控制权。你觉得呢？",
      counterpartTone: "施压 — 把条件框架成'交换'，实际是在蚕食你的边界。",
      strategicCommentary: "对方试图用资源作为筹码换取控制权。这是一个典型的权力不对等谈判开局。你的红线是不能失去核心接口控制权，所以需要把话题从'交换'重新框架为'协作分工'。",
      pressureLevel: 6,
      timestamp: new Date().toISOString(),
    });
  }

  async generateEmbeddings() {
    return null;
  }
}

class MiniMaxProvider implements AiProviderAdapter {
  provider = "minimax" as const;
  private client = new OpenAI({
    apiKey: runtimeEnv.minimaxApiKey,
    baseURL: runtimeEnv.minimaxBaseUrl,
  });

  async generateInterviewEvent(input: InterviewGenerationInput) {
    const prompt = buildInterviewUserPrompt(input);

    const response = await this.client.chat.completions.create({
      model: runtimeEnv.minimaxModel,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    return LiveTurnEventSchema.parse({
      ...parsed,
      sessionId: input.session.id,
      timestamp: new Date().toISOString(),
    });
  }

  async generateDiagnosticReport(input: ReportInput) {
    const response = await this.client.chat.completions.create({
      model: runtimeEnv.minimaxModel,
      messages: [
        {
          role: "user",
          content: buildDiagnosticUserPrompt(input),
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    return DiagnosticReportSchema.parse({
      ...JSON.parse(content),
      id: toId("report"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
    });
  }

  async generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }) {
    const response = await this.client.chat.completions.create({
      model: runtimeEnv.minimaxModel,
      messages: [
        {
          role: "user",
          content: buildMemoryUserPrompt(input),
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    return MemoryProfileSchema.parse({
      ...JSON.parse(content),
      id: toId("memory"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
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
      const response = await this.client.chat.completions.create({
        model: runtimeEnv.minimaxModel,
        messages: [
          {
            role: "user",
            content: buildCopilotUserPrompt(input, memoryContext, attachmentContext || undefined),
          },
        ],
      });

      const content = response.choices[0]?.message?.content ?? "";
      return CopilotResponseSchema.parse({
        ...JSON.parse(content),
        id: toId("copilot"),
        mode: "copilot",
      });
    }

    if (input.mode === "strategy") {
      const response = await this.client.chat.completions.create({
        model: runtimeEnv.minimaxModel,
        messages: [
          {
            role: "user",
            content: buildStrategyUserPrompt(input, memoryContext, attachmentContext || undefined),
          },
        ],
      });

      const content = response.choices[0]?.message?.content ?? "";
      return StrategyReportSchema.parse({
        ...JSON.parse(content),
        id: toId("strategy"),
        mode: "strategy",
      });
    }

    const response = await this.client.chat.completions.create({
      model: runtimeEnv.minimaxModel,
      messages: [
        {
          role: "user",
          content: buildSandboxUserPrompt(input, memoryContext),
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    return SandboxOutcomeSchema.parse({
      ...JSON.parse(content),
      id: toId("sandbox"),
      mode: "sandbox",
    });
  }

  async generateSandboxTurn(input: SandboxTurnInput) {
    const memoryContext = formatMemoryContextForPrompt(input.memoryContext);
    const historyContext = input.history.length > 0
      ? `对话历史：\n${input.history.map((h) => `[${h.role === "user" ? "你" : "对手"}] ${h.content}`).join("\n")}`
      : "";

    const response = await this.client.chat.completions.create({
      model: runtimeEnv.minimaxModel,
      messages: [
        {
          role: "user",
          content: buildSandboxTurnUserPrompt(input, memoryContext, historyContext),
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    return SandboxTurnEventSchema.parse({
      ...JSON.parse(content),
      id: toId("sandbox-turn"),
      threadId: input.threadId,
      timestamp: new Date().toISOString(),
    });
  }

  async generateEmbeddings() {
    return null;
  }
}

class OpenAiProvider implements AiProviderAdapter {
  provider = "openai" as const;
  private client = new OpenAI({
    apiKey: runtimeEnv.openAiApiKey,
  });

  async generateInterviewEvent(input: InterviewGenerationInput) {
    const response = await this.client.responses.parse({
      model: runtimeEnv.openAiModel,
      input: buildInterviewUserPromptOpenAi(input),
      text: {
        format: zodTextFormat(
          LiveTurnEventSchema.omit({ sessionId: true }),
          "live_turn",
        ),
        verbosity: "medium",
      },
    });

    return LiveTurnEventSchema.parse({
      ...response.output_parsed,
      sessionId: input.session.id,
      timestamp: new Date().toISOString(),
    });
  }

  async generateDiagnosticReport(input: ReportInput) {
    const response = await this.client.responses.parse({
      model: runtimeEnv.openAiModel,
      input: buildDiagnosticUserPromptOpenAi(input),
      text: {
        format: zodTextFormat(
          DiagnosticReportSchema.omit({
            id: true,
            sessionId: true,
            generatedAt: true,
          }),
          "diagnostic_report",
        ),
        verbosity: "medium",
      },
    });

    return DiagnosticReportSchema.parse({
      id: toId("report"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      ...response.output_parsed,
    });
  }

  async generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }) {
    const response = await this.client.responses.parse({
      model: runtimeEnv.openAiModel,
      input: buildMemoryUserPromptOpenAi(input),
      text: {
        format: zodTextFormat(
          MemoryProfileSchema.omit({
            id: true,
            sessionId: true,
            generatedAt: true,
          }),
          "memory_profile",
        ),
        verbosity: "medium",
      },
    });

    return MemoryProfileSchema.parse({
      id: toId("memory"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      ...response.output_parsed,
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
      const response = await this.client.responses.parse({
        model: runtimeEnv.openAiModel,
        input: buildCopilotUserPromptOpenAi(input, memoryContext, attachmentContext || undefined),
        text: {
          format: zodTextFormat(
            CopilotResponseSchema.omit({ id: true, mode: true }),
            "copilot_response",
          ),
          verbosity: "medium",
        },
      });

      return CopilotResponseSchema.parse({
        id: toId("copilot"),
        mode: "copilot",
        ...response.output_parsed,
      });
    }

    if (input.mode === "strategy") {
      const response = await this.client.responses.parse({
        model: runtimeEnv.openAiModel,
        input: buildStrategyUserPromptOpenAi(input, memoryContext, attachmentContext || undefined),
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        text: {
          format: zodTextFormat(
            StrategyReportSchema.omit({ id: true, mode: true }),
            "strategy_report",
          ),
          verbosity: "medium",
        },
      });

      return StrategyReportSchema.parse({
        id: toId("strategy"),
        mode: "strategy",
        ...response.output_parsed,
      });
    }

    const response = await this.client.responses.parse({
      model: runtimeEnv.openAiModel,
      input: buildSandboxUserPromptOpenAi(input, memoryContext),
      text: {
        format: zodTextFormat(
          SandboxOutcomeSchema.omit({ id: true, mode: true }),
          "sandbox_outcome",
        ),
        verbosity: "medium",
      },
    });

    return SandboxOutcomeSchema.parse({
      id: toId("sandbox"),
      mode: "sandbox",
      ...response.output_parsed,
    });
  }

  async generateSandboxTurn(input: SandboxTurnInput): Promise<SandboxTurnEvent> {
    const memoryContext = formatMemoryContextForPrompt(input.memoryContext);
    const historyContext = input.history.length > 0
      ? `对话历史：\n${input.history.map((h) => `[${h.role === "user" ? "你" : "对手"}] ${h.content}`).join("\n")}`
      : "";

    const response = await this.client.responses.parse({
      model: runtimeEnv.openAiModel,
      input: buildSandboxTurnUserPromptOpenAi(input, memoryContext, historyContext),
      text: {
        format: zodTextFormat(
          SandboxTurnEventSchema.omit({ id: true, threadId: true, timestamp: true }),
          "sandbox_turn_event",
        ),
        verbosity: "medium",
      },
    });

    return SandboxTurnEventSchema.parse({
      id: toId("sandbox-turn"),
      threadId: input.threadId,
      ...response.output_parsed,
      timestamp: new Date().toISOString(),
    });
  }

  async generateEmbeddings(input: string[]) {
    if (input.length === 0) {
      return [];
    }

    const response = await this.client.embeddings.create({
      model: runtimeEnv.openAiEmbeddingModel,
      input,
    });

    return response.data.map((item) => item.embedding);
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

/**
 * Extracts and parses a JSON object or array from a potentially messy gateway response.
 *
 * Handles:
 * - Direct JSON: `{...}` or `[...]`
 * - Markdown-fenced JSON: ```json ... ```
 * - JSON embedded in surrounding text
 * - Trailing commas (strips them before parsing)
 *
 * Does NOT handle (require json5 or similar):
 * - Single-quoted strings
 * - JavaScript comments
 * - Unquoted keys
 */
function extractStructuredJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Anthropic gateway response was empty.");
  }

  // Attempt 1: direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to fenced and substring parsing.
  }

  // Attempt 2: extract from markdown code fence
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    try {
      return JSON.parse(stripTrailingCommas(fencedMatch[1].trim()));
    } catch {
      // Fall through to balanced JSON parsing.
    }
  }

  // Attempt 3: find first balanced JSON object/array in the text
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
      const slice = trimmed.slice(start, index + 1);
      return JSON.parse(stripTrailingCommas(slice));
    }
  }

  throw new Error("Anthropic gateway response was not valid JSON.");
}

/**
 * Removes trailing commas from before closing braces/brackets.
 * e.g., `{"a": 1,}` -> `{"a": 1}`
 *       `[1, 2,]` -> `[1, 2]`
 */
function stripTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

class AnthropicProvider implements AiProviderAdapter {
  provider = "anthropic" as const;
  private client = new Anthropic({
    apiKey: runtimeEnv.anthropicApiKey,
    baseURL: runtimeEnv.anthropicBaseUrl ?? undefined,
    dangerouslyAllowBrowser: false,
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
    try {
      const outputFormat = zodOutputFormat(params.schema);

      if (!runtimeEnv.anthropicBaseUrl) {
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

        return params.schema.parse(response.parsed_output);
      }

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
        throw new Error(
          "Anthropic gateway response did not include text content.",
        );
      }

      return params.schema.parse(extractStructuredJson(text));
    } catch (error) {
      throw toAiProviderFailure(error, this.provider);
    }
  }

  async generateInterviewEvent(input: InterviewGenerationInput) {
    const prompt = buildInterviewUserPromptOpenAi(input);

    const schema = LiveTurnEventSchema.omit({ sessionId: true });
    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 1024,
      system: INTERVIEW_SYSTEM,
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
    const prompt = buildDiagnosticUserPromptOpenAi(input);

    const schema = DiagnosticReportSchema.omit({
      id: true,
      sessionId: true,
      generatedAt: true,
    });

    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 4096,
      system: DIAGNOSTIC_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      schema,
    });

    return DiagnosticReportSchema.parse({
      id: toId("report"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      ...result,
    });
  }

  async generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }) {
    const prompt = buildMemoryUserPromptOpenAi(input);

    const schema = MemoryProfileSchema.omit({
      id: true,
      sessionId: true,
      generatedAt: true,
    });

    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 4096,
      system: MEMORY_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      schema,
    });

    return MemoryProfileSchema.parse({
      id: toId("memory"),
      sessionId: input.session.id,
      generatedAt: new Date().toISOString(),
      ...result,
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
      const prompt = buildCopilotUserPromptOpenAi(input, memoryContext, attachmentContext);

      const schema = CopilotResponseSchema.omit({ id: true, mode: true });
      const result = await this.callWithSchema({
        model: runtimeEnv.anthropicModel,
        maxTokens: 4096,
        system: COPILOT_SYSTEM,
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
      const prompt = buildStrategyUserPromptOpenAi(input, memoryContext, attachmentContext);

      const schema = StrategyReportSchema.omit({ id: true, mode: true });
      const result = await this.callWithSchema({
        model: runtimeEnv.anthropicModel,
        maxTokens: 8192,
        system: STRATEGY_SYSTEM,
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

    const prompt = buildSandboxUserPromptOpenAi(input, memoryContext);

    const schema = SandboxOutcomeSchema.omit({ id: true, mode: true });
    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 4096,
      system: SANDBOX_SYSTEM,
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

    const prompt = buildSandboxTurnUserPromptOpenAi(input, memoryContext, historyContext);

    const schema = SandboxTurnEventSchema.omit({ id: true, threadId: true, timestamp: true });
    const result = await this.callWithSchema({
      model: runtimeEnv.anthropicModel,
      maxTokens: 2048,
      system: SANDBOX_TURN_SYSTEM,
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

const PROVIDER_TTL_MS = Number(process.env["AI_PROVIDER_TTL_MS"] ?? 5 * 60 * 1000);

let _provider: AiProviderAdapter | undefined;
let _providerCreatedAt: number = 0;

function createProvider(): AiProviderAdapter {
  if (hasMiniMax()) return new MiniMaxProvider();
  if (hasAnthropic()) return new AnthropicProvider();
  if (hasOpenAi()) return new OpenAiProvider();
  return new MockAiProvider();
}

export function getAiProvider(): AiProviderAdapter {
  if (!_provider || (Date.now() - _providerCreatedAt) > PROVIDER_TTL_MS) {
    _provider = createProvider();
    _providerCreatedAt = Date.now();
  }
  return _provider;
}

export { MockAiProvider };

export function resetAiProvider(): void {
  _provider = undefined;
  _providerCreatedAt = 0;
}
