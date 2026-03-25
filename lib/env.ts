import type { RuntimeMode } from "@/lib/domain";

const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5.2",
  openAiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "session-artifacts",
  triggerSecretKey: process.env.TRIGGER_SECRET_KEY,
  triggerProjectId: process.env.TRIGGER_PROJECT_ID,
};

export const runtimeEnv = Object.freeze(env);

export function hasOpenAi() {
  return Boolean(runtimeEnv.openAiApiKey);
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

export function resolveRuntimeMode(): RuntimeMode {
  return resolveRuntimeModeFromEnv(runtimeEnv);
}
