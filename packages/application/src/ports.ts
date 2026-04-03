import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMessage,
  CommandMode,
  CommandThread,
  DiagnosticReport,
  InterviewSession,
  InterviewTurn,
  LiveTurnEvent,
  MemoryEvidence,
  MemoryProfile,
  RolePackId,
  UploadReference,
  Viewer,
} from "@anion/contracts";

export type SessionUpdate = Partial<
  Pick<
    InterviewSession,
    | "status"
    | "directorState"
    | "currentPressure"
    | "updatedAt"
    | "acceptedAt"
    | "reportId"
    | "memoryProfileId"
    | "analysisJobId"
    | "analysisError"
    | "analysisStartedAt"
    | "analysisCompletedAt"
  >
>;

export interface UploadStore {
  uploadFile(file: File, options?: { kind?: UploadReference["kind"] }): Promise<UploadReference>;
}

export interface SessionRepository {
  createSession(session: InterviewSession): Promise<InterviewSession>;
  getSession(sessionId: string): Promise<InterviewSession | null>;
  updateSession(sessionId: string, update: SessionUpdate): Promise<InterviewSession>;
  listSessions(userId: string): Promise<InterviewSession[]>;
  setPreferredRolePack(userId: string, rolePack: RolePackId): Promise<void>;
  setWorkspaceMode(userId: string, mode: Viewer["workspaceMode"]): Promise<void>;
}

export interface TurnRepository {
  appendTurn(turn: InterviewTurn): Promise<InterviewTurn>;
  listTurns(sessionId: string): Promise<InterviewTurn[]>;
}

export interface ReportRepository {
  saveReport(report: DiagnosticReport): Promise<DiagnosticReport>;
  getReportBySession(sessionId: string): Promise<DiagnosticReport | null>;
}

export interface MemoryRepository {
  saveMemoryProfile(profile: MemoryProfile, options?: { isActive?: boolean }): Promise<MemoryProfile>;
  saveMemoryEvidence(evidence: MemoryEvidence[]): Promise<void>;
  listMemoryEvidence(memoryProfileId: string): Promise<MemoryEvidence[]>;
  getMemoryProfileBySession(sessionId: string): Promise<MemoryProfile | null>;
  listMemoryProfiles(userId: string): Promise<MemoryProfile[]>;
  getActiveMemoryProfile(userId: string): Promise<MemoryProfile | null>;
  getActiveMemoryContext(userId: string): Promise<ActiveMemoryContext | null>;
  activateMemoryProfile(sessionId: string, userId: string): Promise<void>;
}

export interface ThreadRepository {
  createThread(thread: CommandThread): Promise<CommandThread>;
  getThread(threadId: string): Promise<CommandThread | null>;
  listThreads(userId: string, mode?: CommandMode): Promise<CommandThread[]>;
  appendCommandMessage(message: CommandMessage): Promise<CommandMessage>;
  listCommandMessages(threadId: string): Promise<CommandMessage[]>;
  saveArtifact(
    threadId: string,
    userId: string,
    mode: CommandMode,
    artifact: CommandArtifact,
  ): Promise<void>;
}

export interface IdentityGateway {
  getDemoViewer(preferredRolePack?: RolePackId): Viewer;
}

export interface JobQueue {
  enqueueInterviewAnalysis(sessionId: string): Promise<{ id: string }>;
}

export type ApplicationStore = UploadStore &
  SessionRepository &
  TurnRepository &
  ReportRepository &
  MemoryRepository &
  ThreadRepository &
  IdentityGateway;

export interface InterviewAiProvider {
  generateInterviewEvent(params: Record<string, unknown>): Promise<LiveTurnEvent>;
  reviewEvent?(
    params: Record<string, unknown>,
  ): Promise<{ approved: boolean; reason?: string }>;
}

export interface AnalysisAiProvider {
  generateDiagnosticReport(params: {
    session: InterviewSession;
    turns: InterviewTurn[];
  }): Promise<DiagnosticReport>;
  generateMemoryProfile(params: {
    report: DiagnosticReport;
    session: InterviewSession;
    turns: InterviewTurn[];
  }): Promise<MemoryProfile>;
  generateEmbeddings?(values: string[]): Promise<number[][] | null>;
}

export interface CommandAiProvider {
  generateCommandArtifact(params: Record<string, unknown>): Promise<CommandArtifact>;
  generateSandboxTurn(params: Record<string, unknown>): Promise<{
    id: string;
    threadId: string;
    counterpartMessage: string;
    counterpartTone: string;
    strategicCommentary: string;
    pressureLevel: number;
    timestamp: string;
  }>;
}


