import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HubConsole } from "@/components/hub-console";
import { InterviewConsole } from "@/components/interview-console";
import { ReportStatusPanel } from "@/components/report-status-panel";

const uiMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  completeSession: vi.fn(),
  streamInterviewTurn: vi.fn(),
  runCommandModeApi: vi.fn(),
  uploadFiles: vi.fn(),
  fetchReportStatus: vi.fn(),
  retryReport: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: uiMocks.push,
    refresh: uiMocks.refresh,
  }),
}));

vi.mock("@/lib/client/api", () => ({
  completeSession: uiMocks.completeSession,
  streamInterviewTurn: uiMocks.streamInterviewTurn,
  runCommandModeApi: uiMocks.runCommandModeApi,
  uploadFiles: uiMocks.uploadFiles,
  fetchReportStatus: uiMocks.fetchReportStatus,
  retryReport: uiMocks.retryReport,
}));

const session = {
  id: "session_1",
  userId: "viewer_1",
  status: "live" as const,
  config: {
    rolePack: "engineering" as const,
    targetCompany: "Anthropic",
    industry: "AI",
    level: "Senior",
    focusGoal: "被打断后仍能在 60 秒内补齐证据和代价",
    jobDescription: "Build reliable systems and explain trade-offs clearly under pressure.",
    interviewers: ["hacker"],
    materials: [],
    candidateName: "Abraham",
  },
  directorState: {
    openLoops: [],
    pressureScore: 42,
    conflictBudget: 1,
    nextSpeakerId: "hacker",
    needsInterrupt: false,
    needsConflict: false,
    round: 0,
    latestAssessment: "",
    phase: "calibrate" as const,
    activeSeam: "被打断后仍能在 60 秒内补齐证据和代价",
    phaseRound: 1,
    lastTimerOutcome: "within_window" as const,
    timeoutCount: 0,
    lastPressureReasons: [],
  },
  currentPressure: 42,
  createdAt: "2026-03-27T00:00:00.000Z",
  updatedAt: "2026-03-27T00:00:00.000Z",
};

const turns = [
  {
    id: "turn_1",
    sessionId: session.id,
    role: "interviewer" as const,
    speakerId: "hacker",
    speakerLabel: "Hacker",
    kind: "question" as const,
    content: "Tell me about a hard system trade-off.",
    meta: {},
    sequence: 0,
    createdAt: "2026-03-27T00:00:00.000Z",
  },
];

describe("AI error UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uiMocks.fetchReportStatus.mockResolvedValue({
      status: "analyzing",
      reportReady: false,
      memoryReady: false,
      lastError: null,
      retryable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows complete-session failures in the interview console and re-enables the button", async () => {
    uiMocks.completeSession.mockRejectedValue(
      new Error("Anthropic request failed: invalid API key"),
    );

    render(<InterviewConsole session={session} turns={turns} />);

    const button = screen.getByTestId("interview-finish-button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId("interview-error-message")).toHaveTextContent(
        "Anthropic request failed: invalid API key",
      );
    });
    expect(button).toBeEnabled();
  });

  it("shows command mode failures in the hub console and re-enables the run button", async () => {
    uiMocks.runCommandModeApi.mockRejectedValue(
      new Error("Anthropic request failed: invalid API key"),
    );

    render(
      <HubConsole
        mode="copilot"
        title="Copilot"
        description="Debug production issues."
        memoryContext={null}
      />,
    );

    fireEvent.change(screen.getByTestId("hub-command-input"), {
      target: { value: "debug this issue" },
    });
    const button = screen.getByTestId("hub-run-button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId("hub-error-message")).toHaveTextContent(
        "Anthropic request failed: invalid API key",
      );
    });
    expect(button).toBeEnabled();
  });

  it("shows retry failures in the report status panel and re-enables the retry button", async () => {
    uiMocks.retryReport.mockRejectedValue(new Error("Anthropic request failed: rate limit"));

    render(<ReportStatusPanel sessionId="session_1" />);

    const button = screen.getByRole("button", { name: "重新生成复盘" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Anthropic request failed: rate limit")).toBeInTheDocument();
    });
    expect(button).toBeEnabled();
  });
});
