"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { acceptOffer, activateHub } from "@/lib/client/api";
import type { SessionStatus } from "@/lib/domain";

type TransitionPhase = "idle" | "locking" | "planning" | "activating";

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function AcceptOfferButton({
  sessionId,
  status,
}: {
  sessionId: string;
  status: SessionStatus;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [showOverlay, setShowOverlay] = useState(false);
  const [error, setError] = useState("");

  const isPending = phase !== "idle";

  const onAccept = async () => {
    setError("");

    if (status === "hub_active") {
      startTransition(() => {
        router.push("/hub");
      });
      return;
    }

    setShowOverlay(true);

    try {
      if (status !== "accepted") {
        setPhase("locking");
        await acceptOffer(sessionId);
        await sleep(220);
      }

      setPhase("planning");
      await sleep(560);
      setPhase("activating");
      await activateHub(sessionId);
      await sleep(220);

      startTransition(() => {
        router.push("/hub");
      });
    } catch (transitionError) {
      setShowOverlay(false);
      setPhase("idle");
      setError(
        transitionError instanceof Error ? transitionError.message : "无法生成行动计划。",
      );
    }
  };

  const label =
    status === "hub_active"
      ? "进入行动计划"
      : isPending
        ? phase === "locking"
          ? "正在锁定本轮结果..."
          : phase === "planning"
            ? "正在整理行动重点..."
            : "正在打开行动计划..."
        : "生成行动计划";

  return (
    <div className="stack-sm">
      <button
        type="button"
        className="primary-button protocol-button"
        disabled={isPending}
        data-testid="accept-offer-button"
        onClick={() => {
          void onAccept();
        }}
      >
        {label}
      </button>
      {error ? <p className="error-copy">{error}</p> : null}

      {showOverlay ? (
        <div
          className="protocol-overlay"
          role="status"
          aria-live="polite"
          data-testid="accept-offer-overlay"
        >
          <div className="protocol-grid" aria-hidden />
          <div className="protocol-panel">
            <span className="eyebrow">行动计划生成中</span>
            <h3>正在把复盘转成后续动作</h3>
            <p className="hero-copy">
              我们会把这轮复盘里的关键问题、高风险回答和下一周重点整理好，然后带你进入行动计划页继续推进。
            </p>
            <div className="protocol-steps">
              <div
                className={`protocol-step ${
                  phase === "locking"
                    ? "active"
                    : phase === "planning" || phase === "activating"
                      ? "done"
                      : ""
                }`}
              >
                1. 锁定本轮复盘
              </div>
              <div
                className={`protocol-step ${
                  phase === "planning"
                    ? "active"
                    : phase === "activating"
                      ? "done"
                      : ""
                }`}
              >
                2. 整理重点动作
              </div>
              <div className={`protocol-step ${phase === "activating" ? "active" : ""}`}>
                3. 打开行动计划
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
