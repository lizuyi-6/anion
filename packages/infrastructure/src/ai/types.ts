/**
 * Local type definitions for AI adapter inputs.
 * These mirror the input shapes used across prompts.ts and adapter.ts.
 */

import type {
  ActiveMemoryContext,
  CommandMode,
  DiagnosticReport,
  InterviewSession,
  InterviewTurn,
  LiveTurnEvent,
  UploadReference,
  Viewer,
} from "@anion/contracts";

export type InterviewGenerationInput = {
  session: InterviewSession;
  turns: InterviewTurn[];
  candidateAnswer?: string;
  forcedKind?: LiveTurnEvent["kind"];
  forcedRationale?: string;
  preferredSpeakerId?: string;
  speakerDirective?: string;
  directorBrief?: string;
  openLoops?: string[];
};

export type DiagnosticReportInput = {
  session: InterviewSession;
  turns: InterviewTurn[];
};

export type MemoryProfileInput = {
  session: InterviewSession;
  report: DiagnosticReport;
  turns: InterviewTurn[];
};

export type CommandInput = {
  mode: CommandMode;
  viewer: Viewer;
  memoryContext: ActiveMemoryContext | null;
  prompt: string;
  attachments: UploadReference[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

export type SandboxTurnInput = {
  threadId: string;
  history: Array<{ role: "user" | "counterpart"; content: string }>;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  memoryContext: ActiveMemoryContext | null;
};
