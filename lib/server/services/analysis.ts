import { tasks } from "@trigger.dev/sdk/v3";

import { getAiProvider } from "@/lib/ai/adapter";
import { hasSupabaseAdmin, hasTrigger, resolveRuntimeMode } from "@/lib/env";
import type {
  DiagnosticReport,
  InterviewSession,
  MemoryEvidence,
  MemoryProfile,
} from "@/lib/domain";
import { toId } from "@/lib/utils";
import type { DataStore } from "@/lib/server/store/repository";
import { getDataStore } from "@/lib/server/store/repository";
import { isAnalysisRetryable } from "@/lib/server/services/session-state";

function normalizeMemoryEntries(params: {
  userId: string;
  profile: MemoryProfile;
  kind: MemoryEvidence["kind"];
  nodes: MemoryProfile["skills"];
}) {
  return params.nodes.map((node) => ({
    id: toId("memory_evidence"),
    memoryProfileId: params.profile.id,
    userId: params.userId,
    label: node.label,
    summary: node.summary,
    kind: params.kind,
    confidence: node.confidence,
    sourceTurnIds: node.sourceTurnIds,
    createdAt: params.profile.generatedAt,
  }));
}

export function buildMemoryEvidence(params: {
  userId: string;
  profile: MemoryProfile;
}) {
  return [
    ...normalizeMemoryEntries({
      userId: params.userId,
      profile: params.profile,
      kind: "skill",
      nodes: params.profile.skills,
    }),
    ...normalizeMemoryEntries({
      userId: params.userId,
      profile: params.profile,
      kind: "gap",
      nodes: params.profile.gaps,
    }),
    ...normalizeMemoryEntries({
      userId: params.userId,
      profile: params.profile,
      kind: "behavior",
      nodes: params.profile.behaviorTraits,
    }),
    ...normalizeMemoryEntries({
      userId: params.userId,
      profile: params.profile,
      kind: "win",
      nodes: params.profile.wins,
    }),
  ] satisfies MemoryEvidence[];
}

async function resolveAnalysisStore(store?: DataStore) {
  if (store) {
    return store;
  }

  return getDataStore({
    admin: resolveRuntimeMode() === "supabase" && hasSupabaseAdmin(),
  });
}

export async function executeInterviewAnalysis(params: {
  sessionId: string;
  store?: DataStore;
}) {
  const store = await resolveAnalysisStore(params.store);
  const session = await store.getSession(params.sessionId);

  if (!session) {
    throw new Error(`未找到会话：${params.sessionId}`);
  }

  const turns = await store.listTurns(params.sessionId);
  const ai = getAiProvider();

  await store.updateSession(session.id, {
    status: "analyzing",
    analysisError: undefined,
    analysisStartedAt: session.analysisStartedAt ?? new Date().toISOString(),
    analysisCompletedAt: undefined,
  });

  try {
    const report = await ai.generateDiagnosticReport({ session, turns });
    const memoryProfile = await ai.generateMemoryProfile({
      report,
      session,
      turns,
    });
    const evidence = buildMemoryEvidence({
      userId: session.userId,
      profile: memoryProfile,
    });
    let embeddings: number[][] | null = null;
    try {
      embeddings = (await ai.generateEmbeddings?.(
        evidence.map((entry) => `${entry.kind}: ${entry.label}. ${entry.summary}`),
      )) ?? null;
    } catch (embeddingError) {
      console.error("Embedding generation failed, proceeding without embeddings:", embeddingError);
    }
    const evidenceWithEmbeddings = evidence.map((entry, index) => ({
      ...entry,
      embedding: embeddings?.[index],
    }));

    await store.saveReport(report);
    await store.saveMemoryProfile(memoryProfile);
    await store.saveMemoryEvidence(evidenceWithEmbeddings);
    await store.updateSession(session.id, {
      status: "report_ready",
      reportId: report.id,
      memoryProfileId: memoryProfile.id,
      analysisError: undefined,
      analysisCompletedAt: new Date().toISOString(),
    });

    return {
      report,
      memoryProfile,
      evidence: evidenceWithEmbeddings,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "面试分析失败";
    await store.updateSession(session.id, {
      status: "analysis_failed",
      analysisError: message,
      analysisCompletedAt: undefined,
    });
    throw error;
  }
}

export async function queueInterviewAnalysis(params: {
  sessionId: string;
  store: DataStore;
}) {
  const session = await params.store.getSession(params.sessionId);

  if (!session) {
    throw new Error(`未找到会话：${params.sessionId}`);
  }

  await params.store.updateSession(params.sessionId, {
    status: "analyzing",
    analysisError: undefined,
    analysisStartedAt: new Date().toISOString(),
    analysisCompletedAt: undefined,
  });

  if (resolveRuntimeMode() === "supabase" && hasTrigger() && hasSupabaseAdmin()) {
    const handle = (await tasks.trigger("analyze-interview-session", {
      sessionId: params.sessionId,
    })) as { id?: string };

    await params.store.updateSession(params.sessionId, {
      analysisJobId: handle.id ?? toId("analysis_job"),
    });

    return {
      queued: true,
      report: null,
      memoryProfile: null,
    };
  }

  const result = await executeInterviewAnalysis({
    sessionId: params.sessionId,
    store: params.store,
  });
  return {
    queued: false,
    report: result.report,
    memoryProfile: result.memoryProfile,
  };
}

export async function getSessionDiagnostics(
  sessionId: string,
  store: DataStore,
): Promise<{
  session: InterviewSession | null;
  report: DiagnosticReport | null;
  memoryProfile: MemoryProfile | null;
}> {
  const session = await store.getSession(sessionId);
  if (!session) {
    return {
      session: null,
      report: null,
      memoryProfile: null,
    };
  }

  return {
    session,
    report: await store.getReportBySession(sessionId),
    memoryProfile: await store.getMemoryProfileBySession(sessionId),
  };
}

export async function getReportStatus(sessionId: string, store: DataStore) {
  const session = await store.getSession(sessionId);
  if (!session) {
    return null;
  }

  const [report, memoryProfile] = await Promise.all([
    store.getReportBySession(sessionId),
    store.getMemoryProfileBySession(sessionId),
  ]);

  return {
    status: session.status,
    reportReady: Boolean(report),
    memoryReady: Boolean(memoryProfile),
    lastError: session.analysisError ?? null,
    retryable: isAnalysisRetryable(session),
  };
}

export async function retryInterviewAnalysis(params: {
  sessionId: string;
  store: DataStore;
}) {
  const session = await params.store.getSession(params.sessionId);
  if (!session) {
    throw new Error(`未找到会话：${params.sessionId}`);
  }

  if (!isAnalysisRetryable(session)) {
    return {
      queued: false,
      report: await params.store.getReportBySession(params.sessionId),
      memoryProfile: await params.store.getMemoryProfileBySession(params.sessionId),
    };
  }

  return queueInterviewAnalysis(params);
}
