import type { SupabaseClient } from "@supabase/supabase-js";

import { hasOpenAi, resolveRuntimeMode, runtimeEnv } from "@/lib/env";
import type { UserNotification } from "@/lib/server/services/notifications";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMessage,
  CommandMode,
  CommandThread,
  DiagnosticReport,
  InterviewSession,
  InterviewTurn,
  MemoryEvidence,
  MemoryProfile,
  RolePackId,
  RuntimeMode,
  UploadReference,
  Viewer,
} from "@/lib/domain";
import {
  CommandMessageSchema,
  CommandThreadSchema,
  DiagnosticReportSchema,
  InterviewSessionSchema,
  InterviewTurnSchema,
  MemoryEvidenceSchema,
  MemoryProfileSchema,
} from "@/lib/domain";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/server/supabase";
import { toId } from "@/lib/utils";

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

export interface DataStore {
  mode: RuntimeMode;
  viewer: Viewer | null;
  isAdmin: boolean;
  getDemoViewer(preferredRolePack?: RolePackId): Viewer;
  uploadFile(
    file: File,
    options?: { kind?: UploadReference["kind"] },
  ): Promise<UploadReference>;
  createSession(session: InterviewSession): Promise<InterviewSession>;
  getSession(sessionId: string): Promise<InterviewSession | null>;
  updateSession(sessionId: string, update: SessionUpdate): Promise<InterviewSession>;
  listSessions(userId: string): Promise<InterviewSession[]>;
  appendTurn(turn: InterviewTurn): Promise<InterviewTurn>;
  listTurns(sessionId: string): Promise<InterviewTurn[]>;
  saveReport(report: DiagnosticReport): Promise<DiagnosticReport>;
  getReportBySession(sessionId: string): Promise<DiagnosticReport | null>;
  saveMemoryProfile(
    profile: MemoryProfile,
    options?: { isActive?: boolean },
  ): Promise<MemoryProfile>;
  saveMemoryEvidence(evidence: MemoryEvidence[]): Promise<void>;
  listMemoryEvidence(memoryProfileId: string): Promise<MemoryEvidence[]>;
  getMemoryProfileBySession(sessionId: string): Promise<MemoryProfile | null>;
  listMemoryProfiles(userId: string): Promise<MemoryProfile[]>;
  getActiveMemoryProfile(userId: string): Promise<MemoryProfile | null>;
  getActiveMemoryContext(userId: string): Promise<ActiveMemoryContext | null>;
  activateMemoryProfile(sessionId: string, userId: string): Promise<void>;
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
  setWorkspaceMode(userId: string, mode: Viewer["workspaceMode"]): Promise<void>;
  setPreferredRolePack(userId: string, rolePack: RolePackId): Promise<void>;
  createNotification(notification: UserNotification): Promise<void>;
  listNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<UserNotification[]>;
  markNotificationRead(id: string): Promise<void>;
}

function toTextContent(fileName: string, mimeType: string, buffer: Buffer) {
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".log") ||
    fileName.endsWith(".txt")
  ) {
    return buffer.toString("utf8").slice(0, 12000);
  }

  return undefined;
}

function toUploadReference(params: {
  id: string;
  provider: UploadReference["provider"];
  kind?: UploadReference["kind"];
  path: string;
  file: File;
  buffer: Buffer;
}): UploadReference {
  return {
    id: params.id,
    kind: params.kind ?? "attachment",
    provider: params.provider,
    path: params.path,
    mimeType: params.file.type || "application/octet-stream",
    size: params.file.size,
    originalName: params.file.name,
    uploadedAt: new Date().toISOString(),
    textContent: toTextContent(params.file.name, params.file.type, params.buffer),
    base64Data: hasOpenAi() ? params.buffer.toString("base64") : undefined,
  };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function buildActiveMemoryContext(params: {
  activeProfile: MemoryProfile;
  profiles: MemoryProfile[];
  listMemoryEvidence: (memoryProfileId: string) => Promise<MemoryEvidence[]>;
}) {
  const orderedProfiles = [...params.profiles].sort((a, b) =>
    b.generatedAt.localeCompare(a.generatedAt),
  );
  const evidence = (
    await Promise.all(
      orderedProfiles.map((profile) => params.listMemoryEvidence(profile.id)),
    )
  )
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const timeline = orderedProfiles
    .flatMap((profile) => profile.replayMoments)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    profile: params.activeProfile,
    evidence,
    relatedProfiles: orderedProfiles.filter(
      (profile) => profile.id !== params.activeProfile.id,
    ),
    timeline,
  } satisfies ActiveMemoryContext;
}

class MemoryDataStore implements DataStore {
  mode = "demo" as const;
  viewer: Viewer = {
    id: "demo-user",
    displayName: "演示候选人",
    isDemo: true,
    workspaceMode: "interview",
    preferredRolePack: "engineering",
  };
  isAdmin = false;

  private uploads = new Map<string, UploadReference>();
  private sessions = new Map<string, InterviewSession>();
  private turns = new Map<string, InterviewTurn[]>();
  private reports = new Map<string, DiagnosticReport>();
  private memoryProfiles = new Map<string, MemoryProfile>();
  private memoryEvidence = new Map<string, MemoryEvidence[]>();
  private activeMemoryProfileByUser = new Map<string, string>();
  private threads = new Map<string, CommandThread>();
  private commandMessages = new Map<string, CommandMessage[]>();
  private notifications = new Map<string, UserNotification>();

  getDemoViewer(preferredRolePack: RolePackId = "engineering") {
    this.viewer = {
      ...this.viewer,
      preferredRolePack,
    };

    return this.viewer;
  }

  async uploadFile(file: File, options?: { kind?: UploadReference["kind"] }) {
    try {
      const id = toId("upload");
      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = toUploadReference({
        id,
        provider: "memory",
        kind: options?.kind,
        path: `memory://${id}/${sanitizeFileName(file.name)}`,
        file,
        buffer,
      });

      this.uploads.set(upload.id, upload);
      console.log(`文件上传成功: ${upload.originalName} (${upload.size} bytes)`);
      return upload;
    } catch (error) {
      console.error("MemoryDataStore 文件上传失败:", error);
      throw new Error("文件上传失败");
    }
  }

  async createSession(session: InterviewSession) {
    this.sessions.set(session.id, session);
    this.turns.set(session.id, []);
    return session;
  }

  async getSession(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async updateSession(sessionId: string, update: SessionUpdate) {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new Error(`未找到会话：${sessionId}`);
    }

    const next: InterviewSession = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString(),
    };

    this.sessions.set(sessionId, next);
    return next;
  }

  async listSessions(userId: string) {
    return [...this.sessions.values()]
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async appendTurn(turn: InterviewTurn) {
    const list = this.turns.get(turn.sessionId) ?? [];
    list.push(turn);
    this.turns.set(turn.sessionId, list);
    return turn;
  }

  async listTurns(sessionId: string) {
    return (this.turns.get(sessionId) ?? []).sort(
      (a, b) => a.sequence - b.sequence,
    );
  }

  async saveReport(report: DiagnosticReport) {
    this.reports.set(report.sessionId, report);
    return report;
  }

  async getReportBySession(sessionId: string) {
    return this.reports.get(sessionId) ?? null;
  }

  async saveMemoryProfile(
    profile: MemoryProfile,
    options?: { isActive?: boolean },
  ) {
    this.memoryProfiles.set(profile.sessionId, profile);
    const session = await this.getSession(profile.sessionId);
    if (options?.isActive && session) {
      this.activeMemoryProfileByUser.set(session.userId, profile.id);
    }

    return profile;
  }

  async saveMemoryEvidence(evidence: MemoryEvidence[]) {
    for (const entry of evidence) {
      const list = this.memoryEvidence.get(entry.memoryProfileId) ?? [];
      list.push(entry);
      this.memoryEvidence.set(entry.memoryProfileId, list);
    }
  }

  async listMemoryEvidence(memoryProfileId: string) {
    return this.memoryEvidence.get(memoryProfileId) ?? [];
  }

  async getMemoryProfileBySession(sessionId: string) {
    return this.memoryProfiles.get(sessionId) ?? null;
  }

  async listMemoryProfiles(userId: string) {
    const sessions = await this.listSessions(userId);
    return sessions
      .map((session) => this.memoryProfiles.get(session.id) ?? null)
      .filter((profile): profile is MemoryProfile => profile !== null)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async getActiveMemoryProfile(userId: string) {
    const activeProfileId = this.activeMemoryProfileByUser.get(userId);
    if (activeProfileId) {
      return (
        [...this.memoryProfiles.values()].find((profile) => profile.id === activeProfileId) ??
        null
      );
    }

    const sessions = await this.listSessions(userId);
    const activeSession = sessions.find(
      (session) =>
        session.status === "accepted" || session.status === "hub_active",
    );
    return activeSession
      ? (this.memoryProfiles.get(activeSession.id) ?? null)
      : null;
  }

  async getActiveMemoryContext(userId: string) {
    const profile = await this.getActiveMemoryProfile(userId);
    if (!profile) {
      return null;
    }

    return buildActiveMemoryContext({
      activeProfile: profile,
      profiles: await this.listMemoryProfiles(userId),
      listMemoryEvidence: (memoryProfileId) => this.listMemoryEvidence(memoryProfileId),
    });
  }

  async activateMemoryProfile(sessionId: string, userId: string) {
    const profile = await this.getMemoryProfileBySession(sessionId);
    if (!profile) {
      return;
    }

    this.activeMemoryProfileByUser.set(userId, profile.id);
  }

  async createThread(thread: CommandThread) {
    this.threads.set(thread.id, thread);
    this.commandMessages.set(thread.id, []);
    return thread;
  }

  async getThread(threadId: string) {
    return this.threads.get(threadId) ?? null;
  }

  async listThreads(userId: string, mode?: CommandMode) {
    return [...this.threads.values()]
      .filter(
        (thread) => thread.userId === userId && (!mode || thread.mode === mode),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async appendCommandMessage(message: CommandMessage) {
    const list = this.commandMessages.get(message.threadId) ?? [];
    list.push(message);
    this.commandMessages.set(message.threadId, list);

    const thread = this.threads.get(message.threadId);
    if (thread) {
      this.threads.set(message.threadId, {
        ...thread,
        updatedAt: message.createdAt,
      });
    }

    return message;
  }

  async listCommandMessages(threadId: string) {
    return this.commandMessages.get(threadId) ?? [];
  }

  async saveArtifact(
    threadId: string,
    userId: string,
    mode: CommandMode,
    artifact: CommandArtifact,
  ) {
    void threadId;
    void userId;
    void mode;
    void artifact;
    return;
  }

  async setWorkspaceMode(_userId: string, mode: Viewer["workspaceMode"]) {
    this.viewer = {
      ...this.viewer,
      workspaceMode: mode,
    };
  }

  async setPreferredRolePack(_userId: string, rolePack: RolePackId) {
    this.viewer = {
      ...this.viewer,
      preferredRolePack: rolePack,
    };
  }

  async createNotification(notification: UserNotification): Promise<void> {
    this.notifications.set(notification.id, notification);
  }

  async listNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<UserNotification[]> {
    const all = [...this.notifications.values()].filter((n) => n.userId === userId);
    if (options?.unreadOnly) return all.filter((n) => !n.read);
    return all;
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = this.notifications.get(id);
    if (n) n.read = true;
  }
}

class SupabaseDataStore implements DataStore {
  mode = "supabase" as const;

  constructor(
    private readonly supabase: SupabaseClient,
    public readonly viewer: Viewer | null,
    public readonly isAdmin: boolean,
  ) {}

  getDemoViewer(preferredRolePack: RolePackId = "engineering") {
    return {
      id: "demo-user",
      displayName: "演示候选人",
      isDemo: true,
      workspaceMode: "interview" as const,
      preferredRolePack,
    };
  }

  private getUserIdForQuery(requestedUserId?: string) {
    if (this.isAdmin) {
      if (!requestedUserId) {
        throw new Error("管理员数据仓库需要显式提供用户 ID");
      }
      return requestedUserId;
    }

    if (!this.viewer) {
      throw new Error("需要已认证的查看者");
    }

    if (requestedUserId && requestedUserId !== this.viewer.id) {
      throw new Error("禁止访问");
    }

    return this.viewer.id;
  }

  private async selectSessionUserId(sessionId: string) {
    const session = await this.getSession(sessionId);
    return session?.userId ?? null;
  }

  async uploadFile(file: File, options?: { kind?: UploadReference["kind"] }) {
    try {
      const ownerId = this.getUserIdForQuery();
      const id = toId("upload");
      const safeName = sanitizeFileName(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      const path = `${ownerId}/${new Date().toISOString().slice(0, 10)}/${id}-${safeName}`;
      const { error } = await this.supabase.storage
        .from(runtimeEnv.supabaseBucket)
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (error) {
        console.error("Supabase 存储上传失败:", error);
        throw new Error("文件上传到存储服务失败");
      }

      console.log(`文件上传成功: ${file.name} -> ${path}`);
      return toUploadReference({
        id,
        provider: "supabase",
        kind: options?.kind,
        path,
        file,
        buffer,
      });
    } catch (error) {
      console.error("SupabaseDataStore 文件上传失败:", error);
      throw new Error("文件上传失败");
    }
  }

  async createSession(session: InterviewSession) {
    const { error } = await this.supabase.from("interview_sessions").insert({
      id: session.id,
      user_id: this.getUserIdForQuery(session.userId),
      status: session.status,
      role_pack: session.config.rolePack,
      target_company: session.config.targetCompany,
      level: session.config.level,
      job_description: session.config.jobDescription,
      config: session.config,
      director_state: session.directorState,
      current_pressure: session.currentPressure,
      accepted_at: session.acceptedAt ?? null,
      report_id: session.reportId ?? null,
      memory_profile_id: session.memoryProfileId ?? null,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      analysis_job_id: session.analysisJobId ?? null,
      analysis_error: session.analysisError ?? null,
      analysis_started_at: session.analysisStartedAt ?? null,
      analysis_completed_at: session.analysisCompletedAt ?? null,
    });

    if (error) {
      throw error;
    }

    if (session.config.materials.length > 0) {
      const artifactRows = session.config.materials.map((material) => ({
        session_id: session.id,
        user_id: session.userId,
        kind: material.kind,
        payload: material,
      }));
      const artifactInsert = await this.supabase
        .from("session_artifacts")
        .insert(artifactRows);

      if (artifactInsert.error) {
        throw artifactInsert.error;
      }
    }

    return session;
  }

  async getSession(sessionId: string) {
    let query = this.supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .limit(1);

    if (!this.isAdmin) {
      query = query.eq("user_id", this.getUserIdForQuery());
    }

    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return InterviewSessionSchema.parse({
      id: data.id,
      userId: data.user_id,
      status: data.status,
      config: data.config,
      directorState: data.director_state,
      currentPressure: data.current_pressure,
      acceptedAt: data.accepted_at ?? undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      reportId: data.report_id ?? undefined,
      memoryProfileId: data.memory_profile_id ?? undefined,
      analysisJobId: data.analysis_job_id ?? undefined,
      analysisError: data.analysis_error ?? undefined,
      analysisStartedAt: data.analysis_started_at ?? undefined,
      analysisCompletedAt: data.analysis_completed_at ?? undefined,
    });
  }

  async updateSession(sessionId: string, update: SessionUpdate) {
    const existing = await this.getSession(sessionId);
    if (!existing) {
      throw new Error(`未找到会话：${sessionId}`);
    }

    const next: InterviewSession = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from("interview_sessions")
      .update({
        status: next.status,
        director_state: next.directorState,
        current_pressure: next.currentPressure,
        updated_at: next.updatedAt,
        accepted_at: next.acceptedAt ?? null,
        report_id: next.reportId ?? null,
        memory_profile_id: next.memoryProfileId ?? null,
        analysis_job_id: next.analysisJobId ?? null,
        analysis_error: next.analysisError ?? null,
        analysis_started_at: next.analysisStartedAt ?? null,
        analysis_completed_at: next.analysisCompletedAt ?? null,
      })
      .eq("id", sessionId)
      .eq("user_id", existing.userId);

    if (error) {
      throw error;
    }

    return next;
  }

  async listSessions(userId: string) {
    const { data, error } = await this.supabase
      .from("interview_sessions")
      .select("*")
      .eq("user_id", this.getUserIdForQuery(userId))
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) =>
      InterviewSessionSchema.parse({
        id: row.id,
        userId: row.user_id,
        status: row.status,
        config: row.config,
        directorState: row.director_state,
        currentPressure: row.current_pressure,
        acceptedAt: row.accepted_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reportId: row.report_id ?? undefined,
        memoryProfileId: row.memory_profile_id ?? undefined,
        analysisJobId: row.analysis_job_id ?? undefined,
        analysisError: row.analysis_error ?? undefined,
        analysisStartedAt: row.analysis_started_at ?? undefined,
        analysisCompletedAt: row.analysis_completed_at ?? undefined,
      }),
    );
  }

  async appendTurn(turn: InterviewTurn) {
    const ownerId =
      (await this.selectSessionUserId(turn.sessionId)) ?? this.getUserIdForQuery();
    const { error } = await this.supabase.from("interview_turns").insert({
      id: turn.id,
      session_id: turn.sessionId,
      user_id: ownerId,
      role: turn.role,
      speaker_id: turn.speakerId,
      speaker_label: turn.speakerLabel,
      kind: turn.kind,
      content: turn.content,
      meta: turn.meta,
      sequence: turn.sequence,
      created_at: turn.createdAt,
    });

    if (error) {
      throw error;
    }

    return turn;
  }

  async listTurns(sessionId: string) {
    const ownerId =
      (await this.selectSessionUserId(sessionId)) ??
      (!this.isAdmin ? this.getUserIdForQuery() : null);
    let query = this.supabase
      .from("interview_turns")
      .select("*")
      .eq("session_id", sessionId)
      .order("sequence", { ascending: true });

    if (ownerId) {
      query = query.eq("user_id", ownerId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) =>
      InterviewTurnSchema.parse({
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        speakerId: row.speaker_id,
        speakerLabel: row.speaker_label,
        kind: row.kind,
        content: row.content,
        meta: row.meta ?? {},
        sequence: row.sequence,
        createdAt: row.created_at,
      }),
    );
  }

  async saveReport(report: DiagnosticReport) {
    const ownerId =
      (await this.selectSessionUserId(report.sessionId)) ??
      this.getUserIdForQuery();
    const { error } = await this.supabase.from("diagnostic_reports").upsert(
      {
        id: report.id,
        session_id: report.sessionId,
        user_id: ownerId,
        payload: report,
        created_at: report.generatedAt,
      },
      { onConflict: "session_id" },
    );

    if (error) {
      throw error;
    }

    return report;
  }

  async getReportBySession(sessionId: string) {
    const ownerId =
      (await this.selectSessionUserId(sessionId)) ??
      (!this.isAdmin ? this.getUserIdForQuery() : null);

    let query = this.supabase
      .from("diagnostic_reports")
      .select("*")
      .eq("session_id", sessionId)
      .limit(1);

    if (ownerId) {
      query = query.eq("user_id", ownerId);
    }

    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return DiagnosticReportSchema.parse(data.payload);
  }

  async saveMemoryProfile(
    profile: MemoryProfile,
    options?: { isActive?: boolean },
  ) {
    const ownerId =
      (await this.selectSessionUserId(profile.sessionId)) ??
      this.getUserIdForQuery();
    const { error } = await this.supabase.from("memory_profiles").upsert(
      {
        id: profile.id,
        session_id: profile.sessionId,
        user_id: ownerId,
        payload: profile,
        is_active: options?.isActive ?? false,
        created_at: profile.generatedAt,
      },
      { onConflict: "session_id" },
    );

    if (error) {
      throw error;
    }

    return profile;
  }

  async saveMemoryEvidence(evidence: MemoryEvidence[]) {
    if (evidence.length === 0) {
      return;
    }

    const rows = evidence.map((entry) => ({
      id: entry.id,
      memory_profile_id: entry.memoryProfileId,
      user_id: entry.userId,
      label: entry.label,
      summary: entry.summary,
      kind: entry.kind,
      embedding: entry.embedding ?? null,
      payload: {
        confidence: entry.confidence,
        sourceTurnIds: entry.sourceTurnIds,
      },
      created_at: entry.createdAt,
    }));

    const { error } = await this.supabase.from("memory_evidence").insert(rows);
    if (error) {
      throw error;
    }
  }

  async listMemoryEvidence(memoryProfileId: string) {
    let query = this.supabase
      .from("memory_evidence")
      .select("*")
      .eq("memory_profile_id", memoryProfileId)
      .order("created_at", { ascending: false });

    if (!this.isAdmin) {
      query = query.eq("user_id", this.getUserIdForQuery());
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) =>
      MemoryEvidenceSchema.parse({
        id: row.id,
        memoryProfileId: row.memory_profile_id,
        userId: row.user_id,
        label: row.label,
        summary: row.summary,
        kind: row.kind,
        confidence: row.payload?.confidence ?? 0.5,
        sourceTurnIds: row.payload?.sourceTurnIds ?? [],
        createdAt: row.created_at,
        embedding: row.embedding ?? undefined,
      }),
    );
  }

  async getMemoryProfileBySession(sessionId: string) {
    let query = this.supabase
      .from("memory_profiles")
      .select("*")
      .eq("session_id", sessionId)
      .limit(1);

    if (!this.isAdmin) {
      query = query.eq("user_id", this.getUserIdForQuery());
    }

    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return MemoryProfileSchema.parse(data.payload);
  }

  async listMemoryProfiles(userId: string) {
    const { data, error } = await this.supabase
      .from("memory_profiles")
      .select("*")
      .eq("user_id", this.getUserIdForQuery(userId))
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => MemoryProfileSchema.parse(row.payload));
  }

  async getActiveMemoryProfile(userId: string) {
    const { data, error } = await this.supabase
      .from("memory_profiles")
      .select("*")
      .eq("user_id", this.getUserIdForQuery(userId))
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? MemoryProfileSchema.parse(data.payload) : null;
  }

  async getActiveMemoryContext(userId: string) {
    const profile = await this.getActiveMemoryProfile(userId);
    if (!profile) {
      return null;
    }

    return buildActiveMemoryContext({
      activeProfile: profile,
      profiles: await this.listMemoryProfiles(userId),
      listMemoryEvidence: (memoryProfileId) => this.listMemoryEvidence(memoryProfileId),
    });
  }

  async activateMemoryProfile(sessionId: string, userId: string) {
    const ownerId = this.getUserIdForQuery(userId);
    const profile = await this.getMemoryProfileBySession(sessionId);
    if (!profile) {
      return;
    }

    // Atomic activation: deactivate all then activate target in a single RPC
    const { error } = await this.supabase.rpc("activate_memory_profile", {
      p_profile_id: profile.id,
      p_user_id: ownerId,
    });
    if (error) {
      // Fallback to non-atomic if RPC doesn't exist yet
      const reset = await this.supabase
        .from("memory_profiles")
        .update({ is_active: false })
        .eq("user_id", ownerId);
      if (reset.error) {
        throw reset.error;
      }

      const activate = await this.supabase
        .from("memory_profiles")
        .update({ is_active: true })
        .eq("id", profile.id)
        .eq("user_id", ownerId);
      if (activate.error) {
        throw activate.error;
      }
    }
  }

  async createThread(thread: CommandThread) {
    const { error } = await this.supabase.from("command_threads").insert({
      id: thread.id,
      user_id: this.getUserIdForQuery(thread.userId),
      mode: thread.mode,
      title: thread.title,
      session_id: thread.sessionId ?? null,
      created_at: thread.createdAt,
      updated_at: thread.updatedAt,
    });

    if (error) {
      throw error;
    }

    return thread;
  }

  async getThread(threadId: string) {
    let query = this.supabase
      .from("command_threads")
      .select("*")
      .eq("id", threadId)
      .limit(1);

    if (!this.isAdmin) {
      query = query.eq("user_id", this.getUserIdForQuery());
    }

    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return CommandThreadSchema.parse({
      id: data.id,
      userId: data.user_id,
      mode: data.mode,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      sessionId: data.session_id ?? undefined,
    });
  }

  async listThreads(userId: string, mode?: CommandMode) {
    let query = this.supabase
      .from("command_threads")
      .select("*")
      .eq("user_id", this.getUserIdForQuery(userId))
      .order("updated_at", { ascending: false });

    if (mode) {
      query = query.eq("mode", mode);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) =>
      CommandThreadSchema.parse({
        id: row.id,
        userId: row.user_id,
        mode: row.mode,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sessionId: row.session_id ?? undefined,
      }),
    );
  }

  async appendCommandMessage(message: CommandMessage) {
    const thread = await this.getThread(message.threadId);
    if (!thread) {
      throw new Error(`未找到会话线程：${message.threadId}`);
    }

    const { error } = await this.supabase.from("command_messages").insert({
      id: message.id,
      thread_id: message.threadId,
      user_id: thread.userId,
      role: message.role,
      content: message.content,
      attachments: message.attachments,
      payload: message.artifact ?? null,
      created_at: message.createdAt,
    });

    if (error) {
      throw error;
    }

    const touch = await this.supabase
      .from("command_threads")
      .update({ updated_at: message.createdAt })
      .eq("id", message.threadId)
      .eq("user_id", thread.userId);
    if (touch.error) {
      throw touch.error;
    }

    return message;
  }

  async listCommandMessages(threadId: string) {
    const thread = await this.getThread(threadId);
    if (!thread) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("command_messages")
      .select("*")
      .eq("thread_id", threadId)
      .eq("user_id", thread.userId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) =>
      CommandMessageSchema.parse({
        id: row.id,
        threadId: row.thread_id,
        mode: thread.mode,
        role: row.role,
        content: row.content,
        attachments: row.attachments ?? [],
        artifact: row.payload ?? undefined,
        createdAt: row.created_at,
      }),
    );
  }

  async saveArtifact(
    threadId: string,
    userId: string,
    mode: CommandMode,
    artifact: CommandArtifact,
  ) {
    const { error } = await this.supabase.from("generated_artifacts").insert({
      thread_id: threadId,
      user_id: this.getUserIdForQuery(userId),
      kind: mode,
      payload: artifact,
    });

    if (error) {
      throw error;
    }
  }

  async setWorkspaceMode(userId: string, mode: Viewer["workspaceMode"]) {
    const { error } = await this.supabase.from("profiles").upsert(
      {
        user_id: this.getUserIdForQuery(userId),
        workspace_mode: mode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw error;
    }
  }

  async setPreferredRolePack(userId: string, rolePack: RolePackId) {
    const { error } = await this.supabase.from("profiles").upsert(
      {
        user_id: this.getUserIdForQuery(userId),
        preferred_role_pack: rolePack,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw error;
    }
  }

  async createNotification(notification: UserNotification): Promise<void> {
    const { error } = await this.supabase.from("notifications").insert({
      id: notification.id,
      user_id: this.getUserIdForQuery(notification.userId),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      action_href: notification.actionHref ?? null,
      read: notification.read,
      created_at: notification.createdAt,
    });

    if (error) {
      throw error;
    }
  }

  async listNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<UserNotification[]> {
    let query = this.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", this.getUserIdForQuery(userId))
      .order("created_at", { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      actionHref: row.action_href ?? undefined,
      read: row.read,
      createdAt: row.created_at,
    }));
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
}

declare global {
  var __mobiusStore: MemoryDataStore | undefined;
  var __mobiusFallbackStore: MemoryDataStore | undefined;
}

export { MemoryDataStore, SupabaseDataStore };

export async function getDataStore(options?: {
  viewer?: Viewer | null;
  admin?: boolean;
}): Promise<DataStore> {
  if (resolveRuntimeMode() === "demo") {
    // Allow tests to inject a MemoryDataStore via globalThis.__mobiusStore
    if (globalThis.__mobiusStore) {
      return globalThis.__mobiusStore;
    }
    // Use SQLite for persistence in demo mode, fall back to in-memory store (singleton)
    try {
      const { getSqliteStore } = await import("./sqlite");
      const userId = options?.viewer?.id ?? "demo-user";
      const displayName = options?.viewer?.displayName ?? "演示候选人";
      const preferredRolePack = options?.viewer?.preferredRolePack ?? "engineering";
      return getSqliteStore({ userId, displayName, preferredRolePack });
    } catch (error) {
      console.error(
        "[MOBIUS] SQLite 初始化失败，回退到内存存储。所有数据将在重启后丢失！",
        error,
      );
      if (!globalThis.__mobiusFallbackStore) {
        globalThis.__mobiusFallbackStore = new MemoryDataStore();
      }
      return globalThis.__mobiusFallbackStore;
    }
  }

  if (options?.admin) {
    return new SupabaseDataStore(createSupabaseAdminClient(), options.viewer ?? null, true);
  }

  return new SupabaseDataStore(
    await createSupabaseServerClient(),
    options?.viewer ?? null,
    false,
  );
}
