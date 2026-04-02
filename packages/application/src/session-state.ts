import type { InterviewSession } from "@anion/contracts";

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
    session.status === "hub_active" ||
    session.status === "live" ||
    session.status === "draft"
  ) {
    return false;
  }

  return true;
}


