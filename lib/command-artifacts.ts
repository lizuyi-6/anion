import type { CommandArtifact, CommandMode } from "@/lib/domain";

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
      `问题类型: ${brief.issueType}`,
      `运行环境: ${brief.runtime}`,
      `疑似层级: ${brief.suspectedLayer}`,
      `期望输出: ${brief.desiredOutcome}`,
      "",
      trimmedNarrative,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (params.mode === "strategy") {
    const brief = params.brief as StrategyBrief;
    return [
      `目标交付物: ${brief.deliverable}`,
      `目标用户/对象: ${brief.targetUser}`,
      `关键约束: ${brief.constraints}`,
      `预期时间线: ${brief.timeline}`,
      "",
      trimmedNarrative,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const brief = params.brief as SandboxBrief;
  return [
    `对手角色: ${brief.counterpartRole}`,
    `对手激励: ${brief.incentives}`,
    `你的红线: ${brief.redLine}`,
    `会议窗口: ${brief.meetingWindow}`,
    "",
    trimmedNarrative,
  ]
    .filter(Boolean)
    .join("\n");
}

export function commandArtifactToMarkdown(artifact: CommandArtifact) {
  if (artifact.mode === "copilot") {
    return [
      "# Engineering Copilot",
      "",
      "## Root Cause",
      artifact.rootCause,
      "",
      "## Shortest Fix",
      ...artifact.shortestFix.map((item) => `- ${item}`),
      "",
      "## Optional Refactors",
      ...artifact.optionalRefactors.map((item) => `- ${item}`),
      ...(artifact.watchouts.length > 0
        ? ["", "## Watchouts", ...artifact.watchouts.map((item) => `- ${item}`)]
        : []),
    ].join("\n");
  }

  if (artifact.mode === "strategy") {
    return [
      "# Feasibility Study Report",
      "",
      ...artifact.sections.flatMap((section) => [`## ${section.title}`, section.body, ""]),
      ...(artifact.deliverables.length > 0
        ? ["## Deliverables", ...artifact.deliverables.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.successMetrics.length > 0
        ? ["## Success Metrics", ...artifact.successMetrics.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.assumptions.length > 0
        ? ["## Assumptions", ...artifact.assumptions.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.openQuestions.length > 0
        ? ["## Open Questions", ...artifact.openQuestions.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.risks.length > 0
        ? ["## Risks", ...artifact.risks.map((item) => `- ${item}`), ""]
        : []),
      ...(artifact.citations.length > 0
        ? [
            "## Citations",
            ...artifact.citations.map((item) => `- [${item.title}](${item.url})`),
            "",
          ]
        : []),
    ].join("\n");
  }

  return [
    "# Game Theory Sandbox",
    "",
    "## Current Equilibrium",
    artifact.equilibrium,
    "",
    "## Recommended Move",
    artifact.recommendedMove,
    "",
    "## Long-Term Cost",
    artifact.longTermCost,
    "",
    ...(artifact.pressurePoints.length > 0
      ? ["## Pressure Points", ...artifact.pressurePoints.map((item) => `- ${item}`), ""]
      : []),
    "## Talk Tracks",
    ...artifact.talkTracks.map((item) => `- ${item}`),
    ...(artifact.scenarioBranches.length > 0
      ? [
          "",
          "## Scenario Branches",
          ...artifact.scenarioBranches.flatMap((branch) => [
            `### ${branch.name}`,
            `- If You Push: ${branch.ifYouPush}`,
            `- If You Concede: ${branch.ifYouConcede}`,
            `- Signal To Watch: ${branch.signalToWatch}`,
          ]),
        ]
      : []),
  ].join("\n");
}
