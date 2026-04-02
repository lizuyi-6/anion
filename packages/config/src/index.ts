import type { AiDriver, AuthDriver, DataDriver, QueueDriver } from "@anion/contracts";

export type AiProvider = AiDriver;

function toInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const portBase = toInt(process.env.PORT_BASE, 3000);
const webPort = toInt(process.env.WEB_PORT, portBase);
const apiPort = toInt(process.env.API_PORT, portBase + 1);
const workerPort = toInt(process.env.WORKER_PORT, portBase + 2);

const serviceOrigins = {
  web: process.env.WEB_ORIGIN ?? `http://127.0.0.1:${webPort}`,
  api: process.env.API_ORIGIN ?? `http://127.0.0.1:${apiPort}`,
  worker: process.env.WORKER_ORIGIN ?? `http://127.0.0.1:${workerPort}`,
} as const;

const env = {
  portBase,
  webPort,
  apiPort,
  workerPort,
  publicOrigin: process.env.PUBLIC_ORIGIN ?? serviceOrigins.web,
  serviceOrigins,
  authDriver: (process.env.AUTH_DRIVER ??
    (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? "supabase" : "local")) as AuthDriver,
  dataDriver: (process.env.DATA_DRIVER ??
    (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? "supabase" : "memory")) as DataDriver,
  queueDriver: (process.env.QUEUE_DRIVER ??
    (process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_ID ? "trigger" : "inline")) as QueueDriver,
  aiDriver: (process.env.AI_DRIVER ??
    (process.env.MINIMAX_API_KEY
      ? "minimax"
      : process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : process.env.OPENAI_API_KEY
          ? "openai"
          : "mock")) as AiDriver,
  minimaxApiKey: process.env.MINIMAX_API_KEY,
  minimaxModel: process.env.MINIMAX_MODEL ?? "MiniMax-M2.7",
  minimaxBaseUrl: process.env.MINIMAX_BASE_URL ?? "https://api.minimax.chat/v1",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.2",
  openAiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "session-artifacts",
  triggerSecretKey: process.env.TRIGGER_SECRET_KEY,
  triggerProjectId: process.env.TRIGGER_PROJECT_ID,
  authAccessCookie: process.env.AUTH_ACCESS_COOKIE ?? "anion-access-token",
  authRefreshCookie: process.env.AUTH_REFRESH_COOKIE ?? "anion-refresh-token",
} as const;

export const runtimeEnv = Object.freeze(env);

export function hasMiniMax() {
  return Boolean(runtimeEnv.minimaxApiKey);
}

export function hasOpenAi() {
  return Boolean(runtimeEnv.openAiApiKey);
}

export function hasAnthropic() {
  return Boolean(runtimeEnv.anthropicApiKey);
}

export function resolveAiProvider(): AiProvider {
  return runtimeEnv.aiDriver;
}

export function hasSupabase() {
  return Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabaseAnonKey);
}

export function hasSupabaseAdmin() {
  return Boolean(
    runtimeEnv.supabaseUrl &&
      runtimeEnv.supabaseAnonKey &&
      runtimeEnv.supabaseServiceRoleKey,
  );
}

export function hasTrigger() {
  return Boolean(runtimeEnv.triggerSecretKey && runtimeEnv.triggerProjectId);
}

export function getServiceOrigin(service: keyof typeof serviceOrigins) {
  return runtimeEnv.serviceOrigins[service];
}
