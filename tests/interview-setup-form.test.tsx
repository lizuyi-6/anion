import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewSetupForm } from "@/components/interview-setup-form";
import type { UploadReference } from "@/lib/domain";

const { push, createSession, uploadFiles } = vi.hoisted(() => ({
  push: vi.fn(),
  createSession: vi.fn(),
  uploadFiles: vi.fn(),
}));

vi.mock("@/lib/client/router", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("@/lib/client/api", () => ({
  createSession,
  uploadFiles,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function fillRequiredFields() {
  fireEvent.change(screen.getByTestId("target-company-input"), {
    target: { value: "OpenAI" },
  });
  fireEvent.change(screen.getByTestId("industry-input"), {
    target: { value: "AI" },
  });
  fireEvent.change(screen.getByTestId("job-description-input"), {
    target: {
      value: "负责构建高可靠系统，并在压力下清晰说明关键架构取舍。",
    },
  });
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

  it("disables submit while uploads are in progress and re-enables it after completion", async () => {
    const deferred = createDeferred<UploadReference[]>();
    uploadFiles.mockReturnValue(deferred.promise);

    render(<InterviewSetupForm defaultRolePack="engineering" />);
    fillRequiredFields();

    const submitButton = screen.getByTestId("create-session-button");
    expect(submitButton).toHaveTextContent("进入面试模拟器");
    expect(submitButton).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/上传简历、项目材料、日志或补充文档/), {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
    expect(submitButton).toHaveTextContent("材料上传中...");
    expect(createSession).not.toHaveBeenCalled();

    deferred.resolve([
      {
        id: "upload_1",
        kind: "attachment",
        provider: "memory",
        path: "uploads/resume.pdf",
        mimeType: "application/pdf",
        size: 6,
        originalName: "resume.pdf",
        uploadedAt: "2026-03-26T00:00:00.000Z",
      },
    ]);

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
    expect(submitButton).toHaveTextContent("进入面试模拟器");

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledTimes(1);
    });
    expect(push).toHaveBeenCalledWith("/simulator/session_1");
  });

  it("shows the default role pack and interviewers as selected", () => {
    render(<InterviewSetupForm defaultRolePack="engineering" />);

    const engineeringCard = screen.getByRole("button", { name: /工程/ });
    const hackerCard = screen.getByRole("button", { name: /黑客/ });
    const architectCard = screen.getByRole("button", { name: /架构师/ });

    expect(engineeringCard).toHaveAttribute("aria-pressed", "true");
    expect(engineeringCard).toHaveAttribute("data-selected", "true");
    expect(within(engineeringCard).getByText("已选中")).toBeInTheDocument();

    expect(hackerCard).toHaveAttribute("aria-pressed", "true");
    expect(within(hackerCard).getByText("已选中")).toBeInTheDocument();
    expect(architectCard).toHaveAttribute("aria-pressed", "true");
    expect(within(architectCard).getByText("已选中")).toBeInTheDocument();
  });

  it("moves the selected feedback when switching role packs", () => {
    render(<InterviewSetupForm defaultRolePack="engineering" />);

    const engineeringCard = screen.getByRole("button", { name: /工程/ });
    const productCard = screen.getByRole("button", { name: /产品/ });

    fireEvent.click(productCard);

    expect(engineeringCard).toHaveAttribute("aria-pressed", "false");
    expect(engineeringCard).toHaveAttribute("data-selected", "false");
    expect(within(engineeringCard).queryByText("已选中")).not.toBeInTheDocument();

    expect(productCard).toHaveAttribute("aria-pressed", "true");
    expect(productCard).toHaveAttribute("data-selected", "true");
    expect(within(productCard).getByText("已选中")).toBeInTheDocument();

    const strategistCard = screen.getByRole("button", { name: /战略家/ });
    expect(strategistCard).toHaveAttribute("aria-pressed", "true");
    expect(within(strategistCard).getByText("已选中")).toBeInTheDocument();
  });

  it("toggles interviewer selection feedback independently", () => {
    render(<InterviewSetupForm defaultRolePack="engineering" />);

    const hackerCard = screen.getByRole("button", { name: /黑客/ });
    const founderCard = screen.getByRole("button", { name: /创始人/ });

    fireEvent.click(hackerCard);

    expect(hackerCard).toHaveAttribute("aria-pressed", "false");
    expect(hackerCard).toHaveAttribute("data-selected", "false");
    expect(within(hackerCard).queryByText("已选中")).not.toBeInTheDocument();
    expect(founderCard).toHaveAttribute("aria-pressed", "true");
    expect(within(founderCard).getByText("已选中")).toBeInTheDocument();

    fireEvent.click(hackerCard);

    expect(hackerCard).toHaveAttribute("aria-pressed", "true");
    expect(hackerCard).toHaveAttribute("data-selected", "true");
    expect(within(hackerCard).getByText("已选中")).toBeInTheDocument();
  });
});
