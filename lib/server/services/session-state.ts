import type { InterviewSession } from "@/lib/domain";

export function canAcceptOffer(session: InterviewSession) {
  return session.status === "report_ready" || session.status === "accepted";
}

export function canActivateCommandCenter(session: InterviewSession) {
  return session.status === "accepted" || session.status === "hub_active";
}

export function isAnalysisRetryable(session: InterviewSession) {
  if (
    session.status === "report_ready" ||
    session.status === "accepted" ||
    session.status === "hub_active"
  ) {
    return false;
  }

  return true;
}
