import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

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
  UploadReference,
  Viewer,
} from "@/lib/domain";
import type { UserNotification } from "@/lib/server/services/notifications";
import {
  CommandMessageSchema,
  CommandThreadSchema,
  DiagnosticReportSchema,
  InterviewSessionSchema,
  InterviewTurnSchema,
  MemoryEvidenceSchema,
  MemoryProfileSchema,
} from "@/lib/domain";
import { toId } from "@/lib/utils";
import type { DataStore, SessionUpdate } from "@/lib/server/store/repository";

const DB_PATH = process.env.SQLITE_PATH || "data/mobius.db";

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
  return null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

function toUploadReference(params: {
  id: string;
  provider: "memory" | "supabase";
  kind?: UploadReference["kind"];
  path: string;
  file: File;
  buffer: Buffer;
}): UploadReference {
  const textContent = toTextContent(params.file.name, params.file.type, params.buffer);
  return {
    id: params.id,
    provider: params.provider,
    kind: params.kind ?? "document",
    originalName: params.file.name,
    mimeType: params.file.type || "application/octet-stream",
    size: params.buffer.length,
    path: params.path,
    uploadedAt: new Date().toISOString(),
    textContent: textContent ?? undefined,
  };
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    // Ensure data directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      config TEXT NOT NULL,
      director_state TEXT NOT NULL,
      current_pressure INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      accepted_at TEXT,
      report_id TEXT,
      memory_profile_id TEXT,
      analysis_job_id TEXT,
      analysis_error TEXT,
      analysis_started_at TEXT,
      analysis_completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      speaker_id TEXT NOT NULL,
      speaker_label TEXT NOT NULL,
      content TEXT NOT NULL,
      meta TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, sequence)
    );

    CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_profiles (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_evidence (
      id TEXT PRIMARY KEY,
      memory_profile_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      summary TEXT NOT NULL,
      kind TEXT NOT NULL,
      confidence REAL NOT NULL,
      source_turn_ids TEXT NOT NULL,
      embedding BLOB,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memory_evidence_profile ON memory_evidence(memory_profile_id);

    CREATE TABLE IF NOT EXISTS command_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      session_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_threads_user ON command_threads(user_id);

    CREATE TABLE IF NOT EXISTS command_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_thread ON command_messages(thread_id);

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      workspace_mode TEXT NOT NULL DEFAULT 'interview',
      preferred_role_pack TEXT NOT NULL DEFAULT 'engineering'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      action_href TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
}

export class SqliteDataStore implements DataStore {
  mode = "demo" as const;
  viewer: Viewer;
  isAdmin = false;

  constructor(
    private readonly userId: string = "demo-user",
    private readonly displayName: string = "演示候选人",
    private readonly preferredRolePack: RolePackId = "engineering",
  ) {
    this.viewer = {
      id: userId,
      displayName,
      isDemo: true,
      workspaceMode: "interview",
      preferredRolePack,
    };
    this.loadUserSettings();
  }

  private loadUserSettings() {
    const db = getDb();
    const row = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(this.userId) as {
      workspace_mode: string;
      preferred_role_pack: string;
    } | undefined;
    if (row) {
      this.viewer = {
        ...this.viewer,
        workspaceMode: row.workspace_mode as Viewer["workspaceMode"],
        preferredRolePack: row.preferred_role_pack as RolePackId,
      };
    }
  }

  getDemoViewer(preferredRolePack: RolePackId = "engineering") {
    return {
      ...this.viewer,
      preferredRolePack,
    };
  }

  async uploadFile(file: File, options?: { kind?: UploadReference["kind"] }) {
    const db = getDb();
    const id = toId("upload");
    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = toUploadReference({
      id,
      provider: "memory",
      kind: options?.kind,
      path: `sqlite://${id}/${sanitizeFileName(file.name)}`,
      file,
      buffer,
    });

    db.prepare(`
      INSERT INTO uploads (id, user_id, data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, this.userId, JSON.stringify(upload), new Date().toISOString());

    return upload;
  }

  async createSession(session: InterviewSession) {
    const db = getDb();
    db.prepare(`
      INSERT INTO sessions (id, user_id, status, config, director_state, current_pressure, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.userId,
      session.status,
      JSON.stringify(session.config),
      JSON.stringify(session.directorState),
      session.currentPressure,
      session.createdAt,
      session.updatedAt,
    );
    return session;
  }

  async getSession(sessionId: string) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as {
      id: string;
      user_id: string;
      status: string;
      config: string;
      director_state: string;
      current_pressure: number;
      created_at: string;
      updated_at: string;
      accepted_at: string | null;
      report_id: string | null;
      memory_profile_id: string | null;
      analysis_job_id: string | null;
      analysis_error: string | null;
      analysis_started_at: string | null;
      analysis_completed_at: string | null;
    } | undefined;

    if (!row) return null;

    return InterviewSessionSchema.parse({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      config: JSON.parse(row.config),
      directorState: JSON.parse(row.director_state),
      currentPressure: row.current_pressure,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      acceptedAt: row.accepted_at ?? undefined,
      reportId: row.report_id ?? undefined,
      memoryProfileId: row.memory_profile_id ?? undefined,
      analysisJobId: row.analysis_job_id ?? undefined,
      analysisError: row.analysis_error ?? undefined,
      analysisStartedAt: row.analysis_started_at ?? undefined,
      analysisCompletedAt: row.analysis_completed_at ?? undefined,
    });
  }

  async updateSession(sessionId: string, update: SessionUpdate) {
    const db = getDb();
    const existing = await this.getSession(sessionId);
    if (!existing) {
      throw new Error(`未找到会话：${sessionId}`);
    }

    const next: InterviewSession = {
      ...existing,
      ...update,
      updatedAt: update.updatedAt ?? new Date().toISOString(),
    };

    db.prepare(`
      UPDATE sessions SET
        status = ?,
        director_state = ?,
        current_pressure = ?,
        updated_at = ?,
        accepted_at = ?,
        report_id = ?,
        memory_profile_id = ?,
        analysis_job_id = ?,
        analysis_error = ?,
        analysis_started_at = ?,
        analysis_completed_at = ?
      WHERE id = ?
    `).run(
      next.status,
      JSON.stringify(next.directorState),
      next.currentPressure,
      next.updatedAt,
      next.acceptedAt ?? null,
      next.reportId ?? null,
      next.memoryProfileId ?? null,
      next.analysisJobId ?? null,
      next.analysisError ?? null,
      next.analysisStartedAt ?? null,
      next.analysisCompletedAt ?? null,
      sessionId,
    );

    return next;
  }

  async listSessions(userId: string) {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as Array<{
      id: string;
      user_id: string;
      status: string;
      config: string;
      director_state: string;
      current_pressure: number;
      created_at: string;
      updated_at: string;
      accepted_at: string | null;
      report_id: string | null;
      memory_profile_id: string | null;
      analysis_job_id: string | null;
      analysis_error: string | null;
      analysis_started_at: string | null;
      analysis_completed_at: string | null;
    }>;

    return rows.map((row) => InterviewSessionSchema.parse({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      config: JSON.parse(row.config),
      directorState: JSON.parse(row.director_state),
      currentPressure: row.current_pressure,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      acceptedAt: row.accepted_at ?? undefined,
      reportId: row.report_id ?? undefined,
      memoryProfileId: row.memory_profile_id ?? undefined,
      analysisJobId: row.analysis_job_id ?? undefined,
      analysisError: row.analysis_error ?? undefined,
      analysisStartedAt: row.analysis_started_at ?? undefined,
      analysisCompletedAt: row.analysis_completed_at ?? undefined,
    }));
  }

  async appendTurn(turn: InterviewTurn) {
    const db = getDb();
    db.prepare(`
      INSERT INTO turns (id, session_id, sequence, role, kind, speaker_id, speaker_label, content, meta, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      turn.id,
      turn.sessionId,
      turn.sequence,
      turn.role,
      turn.kind,
      turn.speakerId,
      turn.speakerLabel,
      turn.content,
      turn.meta ? JSON.stringify(turn.meta) : null,
      turn.createdAt,
    );
    return turn;
  }

  async listTurns(sessionId: string) {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM turns WHERE session_id = ? ORDER BY sequence").all(sessionId) as Array<{
      id: string;
      session_id: string;
      sequence: number;
      role: string;
      kind: string;
      speaker_id: string;
      speaker_label: string;
      content: string;
      meta: string | null;
      created_at: string;
    }>;

    return rows.map((row) => InterviewTurnSchema.parse({
      id: row.id,
      sessionId: row.session_id,
      sequence: row.sequence,
      role: row.role,
      kind: row.kind,
      speakerId: row.speaker_id,
      speakerLabel: row.speaker_label,
      content: row.content,
      meta: row.meta ? JSON.parse(row.meta) : {},
      createdAt: row.created_at,
    }));
  }

  async saveReport(report: DiagnosticReport) {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO reports (id, session_id, data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(report.id, report.sessionId, JSON.stringify(report), report.generatedAt);
    return report;
  }

  async getReportBySession(sessionId: string) {
    const db = getDb();
    const row = db.prepare("SELECT data FROM reports WHERE session_id = ?").get(sessionId) as { data: string } | undefined;
    if (!row) return null;
    return DiagnosticReportSchema.parse(JSON.parse(row.data));
  }

  async saveMemoryProfile(profile: MemoryProfile, options?: { isActive?: boolean }) {
    const db = getDb();
    const isActive = options?.isActive ?? false;

    if (isActive) {
      db.prepare("UPDATE memory_profiles SET is_active = 0 WHERE user_id = ?").run(this.userId);
    }

    db.prepare(`
      INSERT OR REPLACE INTO memory_profiles (id, session_id, user_id, data, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      profile.id,
      profile.sessionId,
      this.userId,
      JSON.stringify(profile),
      isActive ? 1 : 0,
      profile.generatedAt,
    );

    return profile;
  }

  async saveMemoryEvidence(evidence: MemoryEvidence[]) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO memory_evidence (id, memory_profile_id, user_id, label, summary, kind, confidence, source_turn_ids, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of evidence) {
      stmt.run(
        e.id,
        e.memoryProfileId,
        e.userId,
        e.label,
        e.summary,
        e.kind,
        e.confidence,
        JSON.stringify(e.sourceTurnIds),
        e.embedding ? Buffer.from(new Float64Array(e.embedding).buffer) : null,
        e.createdAt,
      );
    }
  }

  async listMemoryEvidence(memoryProfileId: string) {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM memory_evidence WHERE memory_profile_id = ?").all(memoryProfileId) as Array<{
      id: string;
      memory_profile_id: string;
      user_id: string;
      label: string;
      summary: string;
      kind: string;
      confidence: number;
      source_turn_ids: string;
      embedding: Buffer | null;
      created_at: string;
    }>;

    return rows.map((row) => MemoryEvidenceSchema.parse({
      id: row.id,
      memoryProfileId: row.memory_profile_id,
      userId: row.user_id,
      label: row.label,
      summary: row.summary,
      kind: row.kind as MemoryEvidence["kind"],
      confidence: row.confidence,
      sourceTurnIds: JSON.parse(row.source_turn_ids),
      embedding: row.embedding ? Array.from(new Float64Array(row.embedding)) : undefined,
      createdAt: row.created_at,
    }));
  }

  async getMemoryProfileBySession(sessionId: string) {
    const db = getDb();
    const row = db.prepare("SELECT data FROM memory_profiles WHERE session_id = ?").get(sessionId) as { data: string } | undefined;
    if (!row) return null;
    return MemoryProfileSchema.parse(JSON.parse(row.data));
  }

  async listMemoryProfiles(userId: string) {
    const db = getDb();
    const rows = db.prepare("SELECT data FROM memory_profiles WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Array<{ data: string }>;
    return rows.map((row) => MemoryProfileSchema.parse(JSON.parse(row.data)));
  }

  async getActiveMemoryProfile(userId: string) {
    const db = getDb();
    const row = db.prepare("SELECT data FROM memory_profiles WHERE user_id = ? AND is_active = 1").get(userId) as { data: string } | undefined;
    if (!row) return null;
    return MemoryProfileSchema.parse(JSON.parse(row.data));
  }

  async getActiveMemoryContext(userId: string): Promise<ActiveMemoryContext | null> {
    const profile = await this.getActiveMemoryProfile(userId);
    if (!profile) return null;

    const allProfiles = await this.listMemoryProfiles(userId);
    const orderedProfiles = [...allProfiles].sort((a, b) =>
      b.generatedAt.localeCompare(a.generatedAt),
    );
    const evidence = (
      await Promise.all(
        orderedProfiles.map((p) => this.listMemoryEvidence(p.id)),
      )
    ).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const timeline = orderedProfiles
      .flatMap((p) => p.replayMoments)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      profile,
      evidence,
      relatedProfiles: orderedProfiles.filter((p) => p.id !== profile.id),
      timeline,
    } satisfies ActiveMemoryContext;
  }

  async activateMemoryProfile(sessionId: string, userId: string) {
    const db = getDb();
    const profile = await this.getMemoryProfileBySession(sessionId);
    if (!profile) return;

    db.prepare("UPDATE memory_profiles SET is_active = 0 WHERE user_id = ?").run(userId);
    db.prepare("UPDATE memory_profiles SET is_active = 1 WHERE session_id = ?").run(sessionId);
  }

  async createThread(thread: CommandThread) {
    const db = getDb();
    db.prepare(`
      INSERT INTO command_threads (id, user_id, mode, title, session_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      thread.id,
      thread.userId,
      thread.mode,
      thread.title ?? "",
      thread.sessionId ?? null,
      JSON.stringify(thread),
      thread.createdAt,
      thread.updatedAt,
    );
    return thread;
  }

  async getThread(threadId: string) {
    const db = getDb();
    const row = db.prepare("SELECT data FROM command_threads WHERE id = ?").get(threadId) as { data: string } | undefined;
    if (!row) return null;
    return CommandThreadSchema.parse(JSON.parse(row.data));
  }

  async listThreads(userId: string, mode?: CommandMode) {
    const db = getDb();
    const rows = mode
      ? db.prepare("SELECT data FROM command_threads WHERE user_id = ? AND mode = ? ORDER BY updated_at DESC").all(userId, mode)
      : db.prepare("SELECT data FROM command_threads WHERE user_id = ? ORDER BY updated_at DESC").all(userId);

    return (rows as Array<{ data: string }>).map((row) => CommandThreadSchema.parse(JSON.parse(row.data)));
  }

  async appendCommandMessage(message: CommandMessage) {
    const db = getDb();
    db.prepare(`
      INSERT INTO command_messages (id, thread_id, data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(message.id, message.threadId, JSON.stringify(message), message.createdAt);

    db.prepare("UPDATE command_threads SET updated_at = ? WHERE id = ?").run(
      message.createdAt,
      message.threadId,
    );

    return message;
  }

  async listCommandMessages(threadId: string) {
    const db = getDb();
    const rows = db.prepare("SELECT data FROM command_messages WHERE thread_id = ? ORDER BY created_at").all(threadId) as Array<{ data: string }>;
    return rows.map((row) => CommandMessageSchema.parse(JSON.parse(row.data)));
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
  }

  async setWorkspaceMode(userId: string, mode: Viewer["workspaceMode"]) {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO user_settings (user_id, workspace_mode, preferred_role_pack)
      VALUES (?, ?, COALESCE((SELECT preferred_role_pack FROM user_settings WHERE user_id = ?), 'engineering'))
    `).run(userId, mode, userId);

    this.viewer = { ...this.viewer, workspaceMode: mode };
  }

  async setPreferredRolePack(userId: string, rolePack: RolePackId) {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO user_settings (user_id, workspace_mode, preferred_role_pack)
      VALUES (?, COALESCE((SELECT workspace_mode FROM user_settings WHERE user_id = ?), 'interview'), ?)
    `).run(userId, userId, rolePack);

    this.viewer = { ...this.viewer, preferredRolePack: rolePack };
  }

  async createNotification(notification: UserNotification): Promise<void> {
    const db = getDb();
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, action_href, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      notification.id,
      notification.userId,
      notification.type,
      notification.title,
      notification.body,
      notification.actionHref ?? null,
      notification.read ? 1 : 0,
      notification.createdAt,
    );
  }

  async listNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<UserNotification[]> {
    const db = getDb();
    const rows = options?.unreadOnly
      ? db.prepare("SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC").all(userId)
      : db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(userId);

    return (rows as Array<{
      id: string; user_id: string; type: string; title: string; body: string;
      action_href: string | null; read: number; created_at: string;
    }>).map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type as UserNotification["type"],
      title: row.title,
      body: row.body,
      actionHref: row.action_href ?? undefined,
      read: row.read === 1,
      createdAt: row.created_at,
    }));
  }

  async markNotificationRead(id: string): Promise<void> {
    const db = getDb();
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
  }
}

let _store: SqliteDataStore | null = null;

export function getSqliteStore(options?: {
  userId?: string;
  displayName?: string;
  preferredRolePack?: RolePackId;
}): SqliteDataStore {
  if (!_store) {
    _store = new SqliteDataStore(
      options?.userId ?? "demo-user",
      options?.displayName ?? "演示候选人",
      options?.preferredRolePack ?? "engineering",
    );
  }
  return _store;
}
