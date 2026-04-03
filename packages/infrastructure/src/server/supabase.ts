import { createClient } from "@supabase/supabase-js";

import { hasSupabase, hasSupabaseAdmin, runtimeEnv } from "@anion/config";

function assertSupabase() {
  if (!hasSupabase()) {
    throw new Error("Supabase environment variables are not configured.");
  }
}

export function createSupabasePublicClient() {
  assertSupabase();

  return createClient(runtimeEnv.supabaseUrl!, runtimeEnv.supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseUserClient(accessToken: string) {
  assertSupabase();

  return createClient(runtimeEnv.supabaseUrl!, runtimeEnv.supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdmin()) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return createClient(runtimeEnv.supabaseUrl!, runtimeEnv.supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
