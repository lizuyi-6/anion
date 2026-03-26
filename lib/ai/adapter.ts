import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { hasOpenAi, runtimeEnv } from "@/lib/env";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
  DiagnosticReport,
  InterviewSession,
  InterviewTurn,
  LiveTurnEvent,
  MemoryProfile,
  UploadReference,
  Viewer,
} from "@/lib/domain";
import {
  CopilotResponseSchema,
  DiagnosticReportSchema,
  LiveTurnEventSchema,
  MemoryProfileSchema,
  SandboxOutcomeSchema,
  StrategyReportSchema,
  getRolePack,
} from "@/lib/domain";
import { sentenceSplit, summarizeText, toId } from "@/lib/utils";

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
  provider: "mock" | "openai";
  generateInterviewEvent(input: InterviewGenerationInput): Promise<LiveTurnEvent>;
  generateDiagnosticReport(input: ReportInput): Promise<DiagnosticReport>;
  generateMemoryProfile(input: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }): Promise<MemoryProfile>;
  generateCommandArtifact(input: CommandInput): Promise<CommandArtifact>;
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
    const personaMap: Record<string, string> = {
      hacker: "别抽象。直接把复杂度、内存边界、并发控制和失败条件说清楚。",
      architect: "把数据流、瓶颈、降级路径和回滚条件画出来。",
      founder: "告诉我这个取舍为什么值得赌，代价由谁承担。",
      strategist: "先把用户痛点和需求证据钉住，再谈路线。",
      operator: "给负责人、时间、指标和控制回路，不要给愿景。",
      analyst: "指出真正支撑结论的证据，不要拿结论重复包装自己。",
      people_leader: "说清楚你怎么在压力下守住标准又不丢掉队伍。",
      cross_functional_director: "别假设别人会配合。说清你的杠杆、筹码和退路。",
    };

    const lastCandidate =
      input.candidateAnswer ??
      input.turns
        .slice()
        .reverse()
        .find((turn) => turn.role === "candidate")
        ?.content ??
      "The candidate gave a short answer.";
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
          ? `停。${seam} ${input.speakerDirective ?? personaMap[interviewer] ?? "把因果链拧紧。"}`
          : kind === "conflict"
            ? `我不同意。${seam} ${input.speakerDirective ?? personaMap[interviewer] ?? "给我更硬的证据。"}`
            : `你刚才提到“${summarizeText(seed, 64)}”。${input.speakerDirective ?? personaMap[interviewer] ?? "继续往下一层。"} `,
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
      evidence.push("The candidate produced a usable but pressure-sensitive answer frame.");
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
            { id: "signal", label: "Demand Signal", lane: 0 },
            { id: "mvp", label: "Thin MVP", lane: 1 },
            { id: "scale", label: "Scale Controls", lane: 2 },
          ],
          edges: [
            { from: "signal", to: "mvp", label: "validated pain" },
            { from: "mvp", to: "scale", label: "measured traction" },
          ],
        },
        timelineSpec: {
          items: [
            { phase: "Discovery", startWeek: 1, durationWeeks: 2, owner: "Strategy" },
            { phase: "MVP", startWeek: 3, durationWeeks: 3, owner: "Product + Eng" },
            { phase: "Rollout", startWeek: 6, durationWeeks: 2, owner: "Ops" },
          ],
        },
        risks: [
          "如果两周内没有单点 owner 锁住范围，方案会开始漂移。",
          "如果指标定义始终模糊，后续复盘无法支撑继续投入。",
        ],
        deliverables: [
          "一版可执行的 PRD/FSR 主文档",
          "一张端到端数据/业务流程图",
          "一个按周拆解的里程碑与资源表",
        ],
        successMetrics: [
          "上线后两周内核心指标能被稳定采集和解释",
          "关键链路 owner、接口和验收标准在立项阶段已锁定",
        ],
        assumptions: [
          "现有团队具备最小 MVP 所需的工程交付能力",
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
        style: "强势、结果导向，并且会在会议中实时重写规则。",
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
    const prompt = [
      "You are the Project Mobius interview conductor.",
      `Target company: ${input.session.config.targetCompany}`,
      `Role pack: ${input.session.config.rolePack}`,
      `Level: ${input.session.config.level}`,
      `Job description: ${summarizeText(input.session.config.jobDescription, 1500)}`,
      `Director state: ${JSON.stringify(input.session.directorState)}`,
      `Last turns: ${JSON.stringify(input.turns.slice(-4))}`,
      input.directorBrief ? `Director brief: ${input.directorBrief}` : "",
      input.openLoops?.length ? `Open loops: ${JSON.stringify(input.openLoops)}` : "",
      input.candidateAnswer ? `Latest answer: ${input.candidateAnswer}` : "",
      input.preferredSpeakerId ? `Required speaker id: ${input.preferredSpeakerId}` : "",
      input.speakerDirective ? `Speaker contract: ${input.speakerDirective}` : "",
      input.forcedKind ? `Required next kind: ${input.forcedKind}` : "",
      input.forcedRationale ? `Reason to preserve: ${input.forcedRationale}` : "",
      "Return a single structured event in Chinese. Keep it sharp, high-pressure, causality-focused, and speaker-specific.",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await this.client.responses.parse({
      model: runtimeEnv.openAiModel,
      input: prompt,
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
      input: [
        "You are the Project Mobius diagnostic report engine.",
        `Role pack: ${input.session.config.rolePack}`,
        `Session config: ${JSON.stringify(input.session.config)}`,
        `Interview turns: ${JSON.stringify(input.turns)}`,
        "Output Chinese only. Be direct, skeptical, and actionable.",
        "Every finding must point to evidenceTurnIds. evidenceAnchors should include excerpt, speakerLabel, and note.",
      ].join("\n"),
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
      input: [
        "You are the Project Mobius memory refactoring engine.",
        `Session config: ${JSON.stringify(input.session.config)}`,
        `Diagnostic report: ${JSON.stringify(input.report)}`,
        `Interview transcript: ${JSON.stringify(input.turns)}`,
        "Output a searchable Chinese memory profile. Every node must include sourceTurnIds. replayMoments should capture memorable slices that can be replayed later.",
      ].join("\n"),
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
        input: [
          "You are the user's loyal engineering copilot.",
          `Viewer: ${input.viewer.displayName}`,
          `Active memory context: ${memoryContext}`,
          `Recent history: ${JSON.stringify(input.history.slice(-4))}`,
          `User input: ${input.prompt}`,
          attachmentContext ? `Attachments: ${attachmentContext}` : "",
          "Return Chinese only. Start with root cause, then the shortest fix, then optional refactors, then watchouts. Explicitly anchor the advice to gaps or wins from memory when possible.",
        ]
          .filter(Boolean)
          .join("\n"),
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
        input: [
          "You are the Project Mobius feasibility and strategy engine.",
          `Active memory context: ${memoryContext}`,
          `User input: ${input.prompt}`,
          attachmentContext ? `Attachments: ${attachmentContext}` : "",
          "Return Chinese only. Must include 市场背景, 问题定义, 可行性判断, 架构/流程图 DSL, 排期与资源, 风险与前置条件, plus deliverables, successMetrics, assumptions, and openQuestions.",
        ]
          .filter(Boolean)
          .join("\n"),
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
      input: [
        "You are the Project Mobius workplace sandbox.",
        `Active memory context: ${memoryContext}`,
        `Recent history: ${JSON.stringify(input.history.slice(-4))}`,
        `User input: ${input.prompt}`,
        "Return Chinese only. Include the current equilibrium, incentives, recommended move, long-term cost, pressurePoints, scenarioBranches, and 3-5 meeting-ready talk tracks.",
      ].join("\n"),
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

export function getAiProvider(): AiProviderAdapter {
  return hasOpenAi() ? new OpenAiProvider() : new MockAiProvider();
}
