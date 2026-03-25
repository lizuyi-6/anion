"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchReportStatus, retryReport } from "@/lib/client/api";

export function ReportStatusPanel({
  sessionId,
  initialError,
}: {
  sessionId: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState(initialError ?? null);
  const [status, setStatus] = useState("analyzing");

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      void fetchReportStatus(sessionId)
        .then((next) => {
          if (cancelled) {
            return;
          }

          setStatus(next.status);
          setLastError(next.lastError);
          if (next.reportReady) {
            clearInterval(timer);
            router.refresh();
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLastError("暂时无法刷新分析状态。");
          }
        });
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router, sessionId]);

  const onRetry = async () => {
    setIsRetrying(true);
    try {
      await retryReport(sessionId);
      setLastError(null);
      setStatus("analyzing");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <section className="panel transition-panel">
      <p className="panel-label">A3 / 分析流程</p>
      <h3>{status === "analyzing" ? "终局报告仍在编译" : "分析流程需要重试"}</h3>
      <p className="hero-copy">
        报告页保持异步轮询。面试分析还在运行时，页面会自动刷新，不需要手动反复重载。
      </p>
      <div className="terminal-caret" aria-hidden />
      {lastError ? <p className="error-copy">{lastError}</p> : null}
      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          disabled={isRetrying}
          onClick={() => {
            void onRetry();
          }}
        >
          {isRetrying ? "重试中..." : "重试分析"}
        </button>
      </div>
    </section>
  );
}
