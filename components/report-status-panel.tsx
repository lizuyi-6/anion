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
        .catch((error) => {
          if (!cancelled) {
            setLastError(error instanceof Error ? error.message : "无法刷新复盘状态");
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
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "无法重新生成复盘");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <section className="panel transition-panel" data-testid="report-status-panel">
      <p className="panel-label">复盘洞察</p>
      <h3>{status === "analyzing" ? "本轮复盘仍在生成" : "复盘生成失败，需要重试"}</h3>
      <p className="hero-copy">
        页面会持续刷新复盘状态。一旦分析完成，这里会自动更新成完整的亮点、短板和下一周行动建议。
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
          {isRetrying ? "正在重试..." : "重新生成复盘"}
        </button>
      </div>
    </section>
  );
}
