import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { hasSupabase, hasSupabaseAdmin, runtimeEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  if (!hasSupabase()) {
    throw new Error("Supabase runtime is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(runtimeEnv.supabaseUrl!, runtimeEnv.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components may be unable to write cookies. Middleware handles refresh.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdmin()) {
    throw new Error("Supabase admin runtime is not configured");
  }

  return createClient(
    runtimeEnv.supabaseUrl!,
    runtimeEnv.supabaseServiceRoleKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
