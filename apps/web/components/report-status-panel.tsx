"use client";

import { useEffect, useState } from "react";

import { fetchReportStatus, retryReport } from "@/lib/client/api";
import { useRouter } from "@/lib/client/router";

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
            setLastError(
              error instanceof Error ? error.message : "Failed to refresh analysis status",
            );
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
      setLastError(error instanceof Error ? error.message : "Failed to retry analysis");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <section className="panel transition-panel" data-testid="report-status-panel">
      <p className="panel-label">A3 / Analysis</p>
      <h3>{status === "analyzing" ? "Report is still processing" : "Analysis needs a retry"}</h3>
      <p className="hero-copy">
        The report page keeps polling while analysis is running and refreshes itself once the
        report becomes available.
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
          {isRetrying ? "Retrying..." : "Retry analysis"}
        </button>
      </div>
    </section>
  );
}
