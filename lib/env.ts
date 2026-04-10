import type { RuntimeMode } from "@/lib/domain";

export type AiProvider = "openai" | "anthropic";

const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.2",
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
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
  openclawGatewayUrl: process.env.OPENCLAW_GATEWAY_URL,
  openclawWebhookUrl: process.env.OPENCLAW_WEBHOOK_URL,
  openclawSharedSecret: process.env.OPENCLAW_SHARED_SECRET,
  openclawEnabled: process.env.OPENCLAW_ENABLED === "true",
};

export const runtimeEnv = Object.freeze(env);

export function hasOpenAi() {
  return Boolean(runtimeEnv.openAiApiKey);
}

export function hasAnthropic() {
  return Boolean(runtimeEnv.anthropicApiKey);
}

export function resolveAiProvider(): AiProvider {
  if (hasAnthropic()) {
    return "anthropic";
  }
  if (hasOpenAi()) {
    return "openai";
  }
  throw new Error("未配置 AI 提供者。请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY。");
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

export function resolveRuntimeModeFromEnv(envLike: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}): RuntimeMode {
  return envLike.supabaseUrl && envLike.supabaseAnonKey ? "supabase" : "demo";
}

export function hasOpenClaw(): boolean {
  return Boolean(runtimeEnv.openclawEnabled && runtimeEnv.openclawGatewayUrl);
}

export function getOpenClawGatewayUrl(): string {
  return runtimeEnv.openclawGatewayUrl ?? "";
}

export function resolveRuntimeMode(): RuntimeMode {
  return resolveRuntimeModeFromEnv(runtimeEnv);
}
