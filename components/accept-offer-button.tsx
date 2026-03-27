"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { acceptOffer, activateHub } from "@/lib/client/api";
import type { SessionStatus } from "@/lib/domain";

type TransitionPhase = "idle" | "accepting" | "sequencing" | "activating";

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
        router.push(`/hub/copilot?session=${sessionId}`);
      });
      return;
    }

    setShowOverlay(true);

    try {
      if (status !== "accepted") {
        setPhase("accepting");
        await acceptOffer(sessionId);
        await sleep(220);
      }

      setPhase("sequencing");
      await sleep(680);
      setPhase("activating");
      await activateHub(sessionId);
      await sleep(220);

      startTransition(() => {
        router.push(`/hub/copilot?session=${sessionId}`);
      });
    } catch (transitionError) {
      setShowOverlay(false);
      setPhase("idle");
      setError(
        transitionError instanceof Error ? transitionError.message : "无法完成协议切换。",
      );
    }
  };

  const label =
    status === "hub_active"
      ? "进入指挥中心"
      : isPending
        ? phase === "accepting"
          ? "正在接受录用..."
          : phase === "sequencing"
            ? "正在重写协议..."
            : "正在激活指挥中心..."
        : "接受录用";

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
            <span className="eyebrow">录用已确认</span>
            <h3>协议切换中</h3>
            <p className="hero-copy">
              冷启动考场正在退场，个人中枢正在接管。系统会把你的高压面试轨迹翻译成长期可复用的副驾上下文。
            </p>
            <div className="protocol-steps">
              <div className={`protocol-step ${phase === "accepting" ? "active" : "done"}`}>
                1. 锁定录用
              </div>
              <div
                className={`protocol-step ${
                  phase === "sequencing"
                    ? "active"
                    : phase === "activating"
                      ? "done"
                      : ""
                }`}
              >
                2. 重写提示词
              </div>
              <div className={`protocol-step ${phase === "activating" ? "active" : ""}`}>
                3. 激活指挥中心
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
