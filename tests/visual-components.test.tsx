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

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
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
    { key: "depth", label: "Depth", score: 70, signal: "Strong main line." },
    { key: "structure", label: "Structure", score: 68, signal: "Mostly clear." },
    { key: "expression", label: "Expression", score: 64, signal: "Needs tighter close." },
    { key: "pressure", label: "Pressure", score: 72, signal: "Held up well." },
    { key: "judgment", label: "Judgment", score: 66, signal: "Tradeoffs still thin." },
    { key: "ownership", label: "Ownership", score: 75, signal: "Clear scope." },
    { key: "intuition", label: "Intuition", score: 69, signal: "Practical instincts." },
    { key: "system", label: "System", score: 73, signal: "Good systems sense." },
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
  pressureMoments: [],
  recoveryMoments: [],
  pressureDrills: [],
  generatedAt: "2026-03-25T00:00:00.000Z",
};

describe("visual components", () => {
  it("renders the command shell with the localized wordmark", () => {
    const { container } = render(
      <AppFrame
        viewer={viewer}
        title="Command Center"
        subtitle="subtitle"
        shellMode="command"
      >
        <div>Child</div>
      </AppFrame>,
    );

    expect(container.querySelector(".wordmark")).toBeInTheDocument();
    expect(container.querySelector('[data-shell="command"]')).toBeInTheDocument();
  });

  it("renders the radar chart heading and svg", () => {
    const { container } = render(<RadarChart report={report} />);

    expect(container.querySelector("h3")).toBeInTheDocument();
    expect(container.querySelector("svg.radar-svg")).toBeInTheDocument();
  });
});
