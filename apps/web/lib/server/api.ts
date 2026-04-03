import { headers } from "next/headers";

import {
  ActiveMemoryContextResponseSchema,
  AuthSessionResponseSchema,
  SessionDetailSchema,
  SessionDiagnosticsSchema,
  type InterviewSession,
  type Viewer,
  type CommandMessage,
  type CommandMode,
} from "@/lib/domain";
import { runtimeEnv } from "@/lib/env";

async function serverFetch(path: string, init?: RequestInit) {
  const headerStore = await headers();
  const cookie = headerStore.get("cookie");
  const response = await fetch(`${runtimeEnv.serviceOrigins.api}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(cookie ? { cookie } : {}),
    },
  });

  return response;
}

async function readJsonOrThrow<T>(response: Response, parse: (value: unknown) => T) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "API request failed")
        : "API request failed",
    );
  }

  return parse(payload);
}

export async function fetchViewerSession() {
  const response = await serverFetch("/api/v1/auth/session");
  return readJsonOrThrow(response, (value) => AuthSessionResponseSchema.parse(value));
}

export async function fetchSessions() {
  const response = await serverFetch("/api/v1/sessions");
  return readJsonOrThrow(response, (value) => value as InterviewSession[]);
}

export async function fetchSessionDetail(sessionId: string) {
  const response = await serverFetch(`/api/v1/sessions/${sessionId}/detail`);
  return readJsonOrThrow(response, (value) => SessionDetailSchema.parse(value));
}

export async function fetchDiagnostics(sessionId: string) {
  const response = await serverFetch(`/api/v1/reports/${sessionId}`);
  return readJsonOrThrow(response, (value) => SessionDiagnosticsSchema.parse(value));
}

export async function fetchActiveMemoryContext() {
  const response = await serverFetch("/api/v1/memory/active");
  return readJsonOrThrow(response, (value) => ActiveMemoryContextResponseSchema.parse(value));
}

export async function fetchThreadHistory(mode: CommandMode) {
  void mode;
  return [] as CommandMessage[];
}

export function viewerInitial(viewer: Viewer) {
  return viewer.displayName.trim().charAt(0).toUpperCase() || "M";
}
