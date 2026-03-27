import { describe, expect, it } from "vitest";

import { buildCommandInput, commandArtifactToMarkdown } from "@/lib/command-artifacts";
import { CopilotResponseSchema, SandboxOutcomeSchema, StrategyReportSchema } from "@/lib/domain";

describe("command artifact helpers", () => {
  it("builds a structured strategy prompt from the brief and narrative", () => {
    const prompt = buildCommandInput({
      mode: "strategy",
      narrative: "老板给了一个模糊方向，想做 AI 面试训练平台。",
      brief: {
        deliverable: "可行性研究报告",
        targetUser: "求职工程师",
        constraints: "六周内试点",
        timeline: "6 周",
      },
    });

    expect(prompt).toContain("目标交付物：可行性研究报告");
    expect(prompt).toContain("老板给了一个模糊方向");
  });

  it("renders strategy artifacts into markdown with the localized sections", () => {
    const artifact = StrategyReportSchema.parse({
      id: "strategy_1",
      mode: "strategy",
      sections: [
        { id: "market", title: "市场背景", body: "市场存在真实需求。" },
        { id: "problem", title: "问题定义", body: "候选人需要高压模拟。" },
        { id: "feasibility", title: "可行性判断", body: "技术上可以做。" },
        { id: "architecture", title: "架构 / 流程图 DSL", body: "先做最短主链路。" },
        { id: "timeline", title: "排期与资源", body: "六周最小可行版本。" },
        { id: "risks", title: "风险与前置条件", body: "关键接口负责人要先锁定。" },
      ],
      citations: [],
      diagramSpec: {
        nodes: [
          { id: "a", label: "需求信号", lane: 0 },
          { id: "b", label: "最小可行版本", lane: 1 },
        ],
        edges: [{ from: "a", to: "b", label: "已验证" }],
      },
      timelineSpec: {
        items: [{ phase: "最小可行版本", startWeek: 1, durationWeeks: 4, owner: "工程" }],
      },
      risks: ["接口负责人不清", "指标定义模糊"],
      deliverables: ["可行性研究报告文档"],
      successMetrics: ["两周内能采到核心指标"],
      assumptions: ["团队可支持最小可行版本"],
      openQuestions: ["谁拍板接口控制权？"],
    });

    const markdown = commandArtifactToMarkdown(artifact);
    expect(markdown).toContain("# 可行性研究报告");
    expect(markdown).toContain("## 交付物");
    expect(markdown).toContain("## 待解决问题");
  });

  it("keeps copilot and sandbox schemas compatible with new optional sections", () => {
    const copilot = CopilotResponseSchema.parse({
      id: "copilot_1",
      mode: "copilot",
      rootCause: "状态边界没有收紧。",
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
        redLines: ["公开丢面子", "背不可控交付"],
      },
      equilibrium: "对方保留决策权。",
      recommendedMove: "锁住接口控制权。",
      longTermCost: "否则会持续失血。",
      pressurePoints: ["对方想要结果但不想承担约束。"],
      talkTracks: ["先锁负责人", "再谈范围", "最后落验收"],
      scenarioBranches: [
        {
          name: "你强硬推进",
          ifYouPush: "短期气氛变硬。",
          ifYouConcede: "长期会继续失控。",
          signalToWatch: "对方是否愿意锁负责人。",
        },
      ],
    });

    expect(copilot.watchouts).toHaveLength(1);
    expect(sandbox.scenarioBranches).toHaveLength(1);
  });
});
