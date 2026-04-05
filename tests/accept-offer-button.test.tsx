import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptOfferButton } from "@/components/accept-offer-button";

const { push, acceptOffer, activateHub } = vi.hoisted(() => ({
  push: vi.fn(),
  acceptOffer: vi.fn(),
  activateHub: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock("@/lib/client/api", () => ({
  acceptOffer,
  activateHub,
}));

describe("AcceptOfferButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    acceptOffer.mockReset();
    activateHub.mockReset();
    acceptOffer.mockResolvedValue({ ok: true });
    activateHub.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the protocol transition before entering the hub", async () => {
    render(<AcceptOfferButton sessionId="session_1" status="report_ready" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "生成行动计划" }));
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(acceptOffer).toHaveBeenCalledWith("session_1");
    expect(activateHub).toHaveBeenCalledWith("session_1");
    expect(screen.getByTestId("accept-offer-overlay")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/hub");
  });

  it("re-enters the hub immediately when the session is already active", () => {
    render(<AcceptOfferButton sessionId="session_1" status="hub_active" />);

    fireEvent.click(screen.getByRole("button", { name: "进入行动计划" }));

    expect(acceptOffer).not.toHaveBeenCalled();
    expect(activateHub).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/hub");
  });
});
