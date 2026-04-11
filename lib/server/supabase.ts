import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { hasSupabase, hasSupabaseAdmin, runtimeEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  if (!hasSupabase()) {
    throw new Error("Supabase 运行环境未配置");
  }

  const cookieStore = await cookies();

  return createServerClient(runtimeEnv.supabaseUrl!, runtimeEnv.supabaseAnonKey!, {
    cookies: {
      getAll() {
        const all = cookieStore.getAll();
        if (process.env.NODE_ENV !== "production") {
          const auth = all.filter(c => c.name.includes("auth-token"));
          if (auth.length) {
            console.log("[SUPA] getAll:", auth.map(c => `${c.name}(${c.value.length})`).join(" "));
          } else {
            console.log("[SUPA] getAll: no auth-token cookies. All:", all.map(c => c.name).join(", ") || "(none)");
          }
        }
        return all;
      },
      setAll() {
        // No-op: session cookies are managed exclusively by API routes and
        // the /auth/callback handler.  Server components must not overwrite
        // or clear the session cookie, as a failed refresh would log the
        // user out on every subsequent request.
      },
    },
  });
}

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdmin()) {
    throw new Error("Supabase 管理端运行环境未配置");
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
