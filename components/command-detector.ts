import type { CommandMode } from "@/lib/domain";

const commandModes = ["copilot", "strategy", "sandbox"] as const;

const slashCommandPrefixes: Record<string, CommandMode> = {
  "/copilot": "copilot",
  "/c": "copilot",
  "/strategy": "strategy",
  "/s": "strategy",
  "/sandbox": "sandbox",
  "/battle": "sandbox",
  "/b": "sandbox",
};

const copilotKeywords = [
  "bug", "故障", "错误", "异常", "崩溃", "error", "crash",
  "线上", "修复", "根因", "排查", "调试", "debug", "fix",
  "代码", "部署", "回滚", "rollback", "内存泄漏",
];

const strategyKeywords = [
  "计划", "规划", "路线图", "roadmap", "可行性", "可研",
  "方案", "市场", "竞品", "需求", "交付", "里程碑",
  "项目", "排期", "资源", "预算", "季度", "OKR",
];

const sandboxKeywords = [
  "谈判", "沟通", "冲突", "博弈", "对手", "施压",
  "会议", "对齐", "周会", "汇报", "说服", "拒绝",
  "薪资", "晋升", "绩效", "边界",
];

export function detectCommandMode(input: string): {
  mode: CommandMode | "auto";
  cleanInput: string;
} {
  const trimmed = input.trim();

  for (const [prefix, mode] of Object.entries(slashCommandPrefixes)) {
    if (trimmed.startsWith(prefix + " ") || trimmed === prefix) {
      return {
        mode,
        cleanInput: trimmed.slice(prefix.length).trim(),
      };
    }
  }

  return { mode: "auto", cleanInput: trimmed };
}

export function inferModeFromContent(input: string): CommandMode {
  const lower = input.toLowerCase();

  const copilotScore = copilotKeywords.filter((kw) => lower.includes(kw)).length;
  const strategyScore = strategyKeywords.filter((kw) => lower.includes(kw)).length;
  const sandboxScore = sandboxKeywords.filter((kw) => lower.includes(kw)).length;

  if (copilotScore >= strategyScore && copilotScore >= sandboxScore && copilotScore > 0) {
    return "copilot";
  }

  if (sandboxScore >= strategyScore && sandboxScore > 0) {
    return "sandbox";
  }

  if (strategyScore > 0) {
    return "strategy";
  }

  // Default to copilot as the most general-purpose mode
  return "copilot";
}

export function getSlashCommandList(): Array<{
  command: string;
  mode: CommandMode;
  description: string;
}> {
  return [
    { command: "/copilot", mode: "copilot", description: "工程调试与问题分析" },
    { command: "/strategy", mode: "strategy", description: "可行性研究与计划生成" },
    { command: "/sandbox", mode: "sandbox", description: "职场博弈与沟通模拟" },
  ];
}
