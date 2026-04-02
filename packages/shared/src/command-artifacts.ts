import type { CommandArtifact, CommandMode } from "@anion/contracts";

export type CopilotBrief = {
  issueType: string;
  runtime: string;
  suspectedLayer: string;
  desiredOutcome: string;
};

export type StrategyBrief = {
  deliverable: string;
  targetUser: string;
  constraints: string;
  timeline: string;
};

export type SandboxBrief = {
  counterpartRole: string;
  incentives: string;
  redLine: string;
  meetingWindow: string;
};

type CommandBriefMap = {
  copilot: CopilotBrief;
  strategy: StrategyBrief;
  sandbox: SandboxBrief;
};

export function buildCommandInput<TMode extends CommandMode>(params: {
  mode: TMode;
  narrative: string;
  brief: CommandBriefMap[TMode];
}) {
  const trimmedNarrative = params.narrative.trim();

  if (params.mode === "copilot") {
    const brief = params.brief as CopilotBrief;
    return [
      `问题类型：${brief.issueType}`,
      `运行环境：${brief.runtime}`,
      `疑似层级：${brief.suspectedLayer}`,
      `期望输出：${brief.desiredOutcome}`,
      "",
      trimmedNarrative,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (params.mode === "strategy") {
    const brief = params.brief as StrategyBrief;
    return [
      `目标交付物：${brief.deliverable}`,
      `目标用户 / 对象：${brief.targetUser}`,
      `关键约束：${brief.constraints}`,
      `预期时间线：${brief.timeline}`,
      "",
      trimmedNarrative,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const brief = params.brief as SandboxBrief;
  return [
    `对手角色：${brief.counterpartRole}`,
    `对手激励：${brief.incentives}`,
    `你的红线：${brief.redLine}`,
    `会议窗口：${brief.meetingWindow}`,
    "",
    trimmedNarrative,
  ]
    .filter(Boolean)
    .join("\n");
}

export function commandArtifactToMarkdown(artifact: CommandArtifact) {
  if (artifact.mode === "copilot") {
    return [
      "# 工程副驾建议",
      "",
      "## 根本原因",
      artifact.rootCause,
      "",
      "## 最短修复路径",
      ...artifact.shortestFix.map((item) => `- ${item}`),
      "",
      "## 可选重构",
      ...artifact.optionalRefactors.map((item) => `- ${item}`),
      ...(artifact.watchouts.length > 0
        ? ["", "## 注意事项", ...artifact.watchouts.map((item) => `- ${item}`)]
        : []),
      ...(artifact.techForesight.length > 0
        ? [
            "",
            "## 前瞻性技术预判",
            ...artifact.techForesight.flatMap((item) => [
              `### ${item.technology} (${item.risk}风险 / ${item.timeline})`,
              item.recommendation,
            ]),
          ]
        : []),
    ].join("\n");
  }

  if (artifact.mode === "strategy") {
    return [
      "# 可行性研究报告",
      "",
      ...artifact.sections.flatMap((section) => [`## ${section.title}`, section.body, ""]),
      ...(artifact.deliverables.length > 0
        ? ["## 交付物", ...artifact.deliverables.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.successMetrics.length > 0
        ? ["## 成功指标", ...artifact.successMetrics.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.assumptions.length > 0
        ? ["## 假设条件", ...artifact.assumptions.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.openQuestions.length > 0
        ? ["## 待解决问题", ...artifact.openQuestions.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.risks.length > 0
        ? ["## 风险", ...artifact.risks.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.citations.length > 0
        ? [
            "## 引用",
            ...artifact.citations.map((item) => `- [${item.title}](${item.url})`),
            "",
          ]
        : []),
    ].join("\n");
  }

  return [
    "# 职场博弈沙盘",
    "",
    "## 当前均衡",
    artifact.equilibrium,
    "",
    "## 推荐动作",
    artifact.recommendedMove,
    "",
    "## 长期成本",
    artifact.longTermCost,
    "",
    ...(artifact.pressurePoints.length > 0
      ? ["## 施压点", ...artifact.pressurePoints.map((item) => `- ${item}`), ""]
      : []),
    "## 话术要点",
    ...artifact.talkTracks.map((item) => `- ${item}`),
    ...(artifact.scenarioBranches.length > 0
      ? [
          "",
          "## 情景分支",
          ...artifact.scenarioBranches.flatMap((branch) => [
            `### ${branch.name}`,
            `- 如果施压：${branch.ifYouPush}`,
            `- 如果让步：${branch.ifYouConcede}`,
            `- 关注信号：${branch.signalToWatch}`,
          ]),
        ]
      : []),
  ].join("\n");
}
