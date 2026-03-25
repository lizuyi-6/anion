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
        transitionError instanceof Error
          ? transitionError.message
          : "Unable to complete protocol switch.",
      );
    }
  };

  const label =
    status === "hub_active"
      ? "Enter Command Center"
      : isPending
        ? phase === "accepting"
          ? "Accepting Offer..."
          : phase === "sequencing"
            ? "Rewriting Protocol..."
            : "Activating Command Center..."
        : "Accept Offer";

  return (
    <div className="stack-sm">
      <button
        type="button"
        className="primary-button protocol-button"
        disabled={isPending}
        onClick={() => {
          void onAccept();
        }}
      >
        {label}
      </button>
      {error ? <p className="error-copy">{error}</p> : null}

      {showOverlay ? (
        <div className="protocol-overlay" role="status" aria-live="polite">
          <div className="protocol-grid" aria-hidden />
          <div className="protocol-panel">
            <span className="eyebrow">Offer Accepted</span>
            <h3>协议切换中</h3>
            <p className="hero-copy">
              冷峻考场正在退场，个人中枢正在接管。系统会把你的高压面试痕迹转译成长期副驾上下文。
            </p>
            <div className="protocol-steps">
              <div className={`protocol-step ${phase === "accepting" ? "active" : "done"}`}>
                1. Lock Offer
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
                2. Rewrite Prompt
              </div>
              <div className={`protocol-step ${phase === "activating" ? "active" : ""}`}>
                3. Activate Hub
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
