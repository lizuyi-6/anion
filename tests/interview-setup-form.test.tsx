import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewSetupForm } from "@/components/interview-setup-form";

const { push, createSession, uploadFiles } = vi.hoisted(() => ({
  push: vi.fn(),
  createSession: vi.fn(),
  uploadFiles: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("@/lib/client/api", () => ({
  createSession,
  uploadFiles,
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByTestId("target-company-input"), {
    target: { value: "OpenAI" },
  });
  fireEvent.change(screen.getByTestId("industry-input"), {
    target: { value: "AI" },
  });
  fireEvent.change(screen.getByTestId("job-description-input"), {
    target: {
      value: "负责构建高可靠系统，并在高压下清晰解释关键架构取舍和业务影响。",
    },
  });
}

function goToFocusStep() {
  fireEvent.click(screen.getByRole("button", { name: "下一步" }));
  fireEvent.click(screen.getByRole("button", { name: "下一步" }));
}

describe("InterviewSetupForm", () => {
  beforeEach(() => {
    push.mockReset();
    createSession.mockReset();
    uploadFiles.mockReset();
    createSession.mockResolvedValue({ sessionId: "session_1" });
  });

  afterEach(() => {
    cleanup();
  });

  it("requires a focus goal before allowing the final submit", async () => {
    render(<InterviewSetupForm defaultRolePack="engineering" />);

    fillRequiredFields();
    goToFocusStep();

    fireEvent.click(screen.getByTestId("create-session-button"));

    await waitFor(() => {
      expect(
        screen.getByText("请写清这轮最想压测的一条回答链路或能力短板。"),
      ).toBeInTheDocument();
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("submits focusGoal and the wizard data after reaching the last step", async () => {
    render(<InterviewSetupForm defaultRolePack="engineering" />);

    fillRequiredFields();
    goToFocusStep();
    fireEvent.change(screen.getByTestId("focus-goal-input"), {
      target: { value: "被打断后仍能在 60 秒内给出结论、证据和代价" },
    });

    fireEvent.click(screen.getByTestId("create-session-button"));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledTimes(1);
    });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        targetCompany: "OpenAI",
        focusGoal: "被打断后仍能在 60 秒内给出结论、证据和代价",
      }),
    );
    expect(push).toHaveBeenCalledWith("/simulator/session_1");
  });

  it("hydrates prefill values and preserves the selected drill setup", () => {
    render(
      <InterviewSetupForm
        defaultRolePack="engineering"
        prefill={{
          rolePack: "product",
          targetCompany: "Anthropic",
          industry: "AI",
          level: "Staff",
          focusGoal: "用数据和 owner 说清优先级取舍",
          jobDescription:
            "Own product direction, align stakeholders, and defend prioritization trade-offs under pressure.",
          interviewers: ["strategist", "operator"],
        }}
      />,
    );

    expect(screen.getByTestId("target-company-input")).toHaveValue("Anthropic");
    goToFocusStep();

    expect(screen.getByTestId("focus-goal-input")).toHaveValue(
      "用数据和 owner 说清优先级取舍",
    );
    expect(screen.getByText("2 位")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
  });
});
