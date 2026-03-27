import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppFrame } from "@/components/app-frame";
import { RadarChart } from "@/components/radar-chart";
import type { DiagnosticReport, Viewer } from "@/lib/domain";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const viewer: Viewer = {
  id: "viewer_1",
  displayName: "Abraham",
  isDemo: true,
  workspaceMode: "command_center",
  preferredRolePack: "engineering",
};

const report: DiagnosticReport = {
  id: "report_1",
  sessionId: "session_1",
  scores: [
    { key: "a", label: "深度", score: 70, signal: "稳住了主线。" },
    { key: "b", label: "框定", score: 68, signal: "判断还算清楚。" },
    { key: "c", label: "表达", score: 64, signal: "落结论稍慢。" },
    { key: "d", label: "抗压", score: 72, signal: "抗压尚可。" },
    { key: "e", label: "判断", score: 66, signal: "取舍略薄。" },
    { key: "f", label: "担当", score: 75, signal: "责任边界较清楚。" },
    { key: "g", label: "直觉", score: 69, signal: "工程直觉可用。" },
    { key: "h", label: "韧性", score: 73, signal: "系统韧性意识较强。" },
  ],
  evidence: ["A", "B", "C"],
  evidenceAnchors: [],
  findings: [
    {
      title: "finding",
      severity: "major",
      category: "communication",
      detail: "detail",
      recommendation: "fix",
      evidenceTurnIds: [],
      impact: "impact",
    },
  ],
  starStories: [
    {
      title: "story",
      situation: "s",
      task: "t",
      action: "a",
      result: "r",
    },
  ],
  trainingPlan: ["item1", "item2", "item3"],
  generatedAt: "2026-03-25T00:00:00.000Z",
};

describe("visual components", () => {
  it("renders the command shell with the localized wordmark", () => {
    const { container } = render(
      <AppFrame
        viewer={viewer}
        title="指挥中心"
        subtitle="subtitle"
        shellMode="command"
      >
        <div>Child</div>
      </AppFrame>,
    );

    expect(screen.getByText("莫比乌斯计划")).toBeInTheDocument();
    expect(container.querySelector('[data-shell="command"]')).toBeInTheDocument();
  });

  it("renders the radar chart heading and svg", () => {
    render(<RadarChart report={report} />);

    expect(screen.getByText("高维雷达图")).toBeInTheDocument();
    expect(screen.getByLabelText("诊断雷达图")).toBeInTheDocument();
  });
});
