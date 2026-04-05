import { describe, expect, it } from "vitest";

import { assessInterruptNeed } from "@/lib/server/services/interview";

describe("assessInterruptNeed", () => {
  it("interrupts very long answers", () => {
    const result = assessInterruptNeed("long ".repeat(400), {
      lastQuestion: "How would you preserve consistency on a weak network?",
      pressureScore: 50,
      phase: "calibrate",
      deadlineSeconds: 120,
      elapsedSeconds: 40,
      timerExpired: false,
    });

    expect(result.shouldInterrupt).toBe(true);
    expect(result.kind).toBe("interrupt");
  });

  it("interrupts buzzword-heavy answers without causality", () => {
    const result = assessInterruptNeed(
      "We build synergy through platform ecosystem enablement and an execution loop.",
      {
        lastQuestion: "Why is that trade-off justified?",
        pressureScore: 65,
        phase: "surround",
        deadlineSeconds: 90,
        elapsedSeconds: 30,
        timerExpired: false,
      },
    );

    expect(result.shouldInterrupt).toBe(true);
  });

  it("keeps digging when the answer stays on topic", () => {
    const result = assessInterruptNeed(
      "Because weak networks amplify retries, I make writes idempotent and reconcile with versioned conflict handling.",
      {
        lastQuestion: "How do you preserve consistency on a weak network?",
        pressureScore: 60,
        phase: "calibrate",
        deadlineSeconds: 120,
        elapsedSeconds: 45,
        timerExpired: false,
      },
    );

    expect(result.shouldInterrupt).toBe(false);
    expect(result.kind).toBe("follow_up");
  });
});
