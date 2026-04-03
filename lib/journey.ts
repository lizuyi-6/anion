import { formatRolePackLabel, type InterviewSession, type SessionStatus, type Viewer } from "@/lib/domain";

export type JourneyStage = "goal" | "practice" | "debrief" | "action";

export type JourneyStep = {
  id: JourneyStage;
  label: string;
  description: string;
};

export type RecommendedAction = {
  stage: JourneyStage;
  href: string;
  label: string;
  description: string;
};

const journeySteps: JourneyStep[] = [
  {
    id: "goal",
    label: "目标设定",
    description: "明确岗位、材料和这轮准备最想解决的问题。",
  },
  {
    id: "practice",
    label: "模拟训练",
    description: "在高压提问里验证表达、判断和证据质量。",
  },
  {
    id: "debrief",
    label: "复盘洞察",
    description: "把亮点和短板整理成下一步真正可执行的方向。",
  },
  {
    id: "action",
    label: "行动计划",
    description: "围绕高风险问题、下周任务和关键场景持续推进。",
  },
];

const audienceStatusLabels: Record<SessionStatus, string> = {
  draft: "待开始",
  live: "模拟中",
  analyzing: "复盘生成中",
  report_ready: "待复盘",
  accepted: "行动计划已生成",
  hub_active: "行动进行中",
};

export function getJourneySteps() {
  return journeySteps;
}

export function getJourneyStageFromStatus(status: SessionStatus): JourneyStage {
  switch (status) {
    case "draft":
      return "goal";
    case "live":
    case "analyzing":
      return "practice";
    case "report_ready":
      return "debrief";
    case "accepted":
    case "hub_active":
      return "action";
  }
}

export function formatJourneyStage(stage: JourneyStage) {
  return journeySteps.find((item) => item.id === stage)?.label ?? stage;
}

export function formatAudienceSessionStatus(status: SessionStatus) {
  return audienceStatusLabels[status];
}

export function getStageIndex(stage: JourneyStage) {
  return journeySteps.findIndex((item) => item.id === stage);
}

export function getPrimarySession(sessions: InterviewSession[]) {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function getNextRecommendedAction(
  viewer: Viewer,
  sessions: InterviewSession[],
): RecommendedAction {
  const latestSession = getPrimarySession(sessions);

  if (!latestSession) {
    return {
      stage: "goal",
      href: "/simulator/new",
      label: "创建准备目标",
      description: `先从${formatRolePackLabel(
        viewer.preferredRolePack,
      )}岗位的目标、岗位信息和已有材料开始，建立第一轮准备范围。`,
    };
  }

  switch (latestSession.status) {
    case "live":
    case "analyzing":
      return {
        stage: "practice",
        href:
          latestSession.status === "live"
            ? `/simulator/${latestSession.id}`
            : `/report/${latestSession.id}`,
        label: latestSession.status === "live" ? "继续本轮模拟" : "查看复盘进度",
        description:
          latestSession.status === "live"
            ? `继续完成 ${latestSession.config.targetCompany} 的本轮训练，这一轮结束后会自动生成复盘。`
            : `本轮训练已经结束，先查看 ${latestSession.config.targetCompany} 的复盘生成情况。`,
      };
    case "report_ready":
      return {
        stage: "debrief",
        href: `/report/${latestSession.id}`,
        label: "查看本轮复盘",
        description: `读懂 ${latestSession.config.targetCompany} 这轮训练的亮点、短板和下一周建议。`,
      };
    case "accepted":
    case "hub_active":
      return {
        stage: "action",
        href: "/hub",
        label: "继续行动计划",
        description: "把最近一次复盘转成任务、计划和高风险场景练习，保持连续推进。",
      };
    case "draft":
      return {
        stage: "goal",
        href: `/simulator/${latestSession.id}`,
        label: "继续准备这轮目标",
        description: `继续完成 ${latestSession.config.targetCompany} 的准备设置，进入正式模拟。`,
      };
  }
}
