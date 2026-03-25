import { describe, expect, it } from "vitest";

import { buildCommandInput, commandArtifactToMarkdown } from "@/lib/command-artifacts";
import { CopilotResponseSchema, SandboxOutcomeSchema, StrategyReportSchema } from "@/lib/domain";

describe("command artifact helpers", () => {
  it("builds a structured strategy prompt from the brief and narrative", () => {
    const prompt = buildCommandInput({
      mode: "strategy",
      narrative: "老板给了一个模糊方向，想做 AI 面试训练平台。",
      brief: {
        deliverable: "FSR",
        targetUser: "求职工程师",
        constraints: "六周内试点",
        timeline: "6 周",
      },
    });

    expect(prompt).toContain("目标交付物: FSR");
    expect(prompt).toContain("老板给了一个模糊方向");
  });

  it("renders strategy artifacts into markdown with the new sections", () => {
    const artifact = StrategyReportSchema.parse({
      id: "strategy_1",
      mode: "strategy",
      sections: [
        { id: "market", title: "市场背景", body: "市场存在真实需求。" },
        { id: "problem", title: "问题定义", body: "候选人需要高压模拟。" },
        { id: "feasibility", title: "可行性判断", body: "技术上可以做。" },
        { id: "architecture", title: "架构/流程图 DSL", body: "先做最薄主链路。" },
        { id: "timeline", title: "排期与资源", body: "六周 MVP。" },
        { id: "risks", title: "风险与前置条件", body: "关键接口 owner 要先锁定。" },
      ],
      citations: [],
      diagramSpec: {
        nodes: [
          { id: "a", label: "Signal", lane: 0 },
          { id: "b", label: "MVP", lane: 1 },
        ],
        edges: [{ from: "a", to: "b", label: "validated" }],
      },
      timelineSpec: {
        items: [{ phase: "MVP", startWeek: 1, durationWeeks: 4, owner: "Eng" }],
      },
      risks: ["接口 owner 不清", "指标定义模糊"],
      deliverables: ["FSR 文档"],
      successMetrics: ["两周内能采到核心指标"],
      assumptions: ["团队可支持 MVP"],
      openQuestions: ["谁拍板接口控制权？"],
    });

    const markdown = commandArtifactToMarkdown(artifact);
    expect(markdown).toContain("# Feasibility Study Report");
    expect(markdown).toContain("## Deliverables");
    expect(markdown).toContain("## Open Questions");
  });

  it("keeps copilot and sandbox schemas compatible with new optional sections", () => {
    const copilot = CopilotResponseSchema.parse({
      id: "copilot_1",
      mode: "copilot",
      rootCause: "状态边界没收紧。",
      shortestFix: ["复现路径", "检查状态机"],
      optionalRefactors: ["收敛共享状态"],
      memoryAnchor: "先找根缝。",
      watchouts: ["不要同时改三层。"],
    });
    const sandbox = SandboxOutcomeSchema.parse({
      id: "sandbox_1",
      mode: "sandbox",
      counterpartModel: {
        style: "强势",
        incentives: ["保控制权", "少背锅"],
        redLines: ["公开失面子", "背不可控交付"],
      },
      equilibrium: "对方保留决策权。",
      recommendedMove: "锁住接口控制权。",
      longTermCost: "否则持续失血。",
      pressurePoints: ["对方想要结果但不想承担约束。"],
      talkTracks: ["先锁 owner", "再谈范围", "最后落验收"],
      scenarioBranches: [
        {
          name: "你强硬推进",
          ifYouPush: "短期气氛变硬。",
          ifYouConcede: "长期会继续失控。",
          signalToWatch: "对方是否愿意锁 owner。",
        },
      ],
    });

    expect(copilot.watchouts).toHaveLength(1);
    expect(sandbox.scenarioBranches).toHaveLength(1);
  });
});
