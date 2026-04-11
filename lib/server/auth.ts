import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { hasSupabase, runtimeEnv } from "@/lib/env";
import type { RolePackId, Viewer } from "@/lib/domain";
import { rolePackIds, ViewerSchema } from "@/lib/domain";
import { getDataStore } from "@/lib/server/store/repository";

function resolveRolePack(value: string | undefined | null): RolePackId {
  return rolePackIds.includes(value as RolePackId)
    ? (value as RolePackId)
    : "engineering";
}

export async function getViewer(): Promise<Viewer | null> {
  const cookieStore = await cookies();
  const preferredRolePack = resolveRolePack(
    cookieStore.get("mobius-role-pack")?.value,
  );

  if (!hasSupabase()) {
    const store = await getDataStore();
    return store.getDemoViewer(preferredRolePack);
  }

  // Read session cookie → validate JWT via Supabase Auth API
  const cookie = cookieStore.get("sb-host-auth-token");
  let accessToken: string | undefined;
  if (cookie?.value) {
    try {
      const raw = cookie.value.startsWith("base64-") ? cookie.value.slice(7) : cookie.value;
      const session = JSON.parse(Buffer.from(raw, "base64").toString()) as Record<string, unknown>;
      accessToken = session.access_token as string | undefined;
    } catch {
      // invalid cookie — treat as logged out
    }
  }

  if (!accessToken) return null;

  // Validate JWT signature server-side (prevents forgery)
  const admin = createClient(
    runtimeEnv.supabaseUrl!,
    runtimeEnv.supabaseServiceRoleKey!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: { user: authUser }, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authUser) return null;

  const user = {
    id: authUser.id,
    email: authUser.email ?? undefined,
    user_metadata: authUser.user_metadata as Record<string, unknown> | undefined,
  };

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const viewer = ViewerSchema.parse({
    id: user.id,
    displayName:
      profile?.full_name ??
      (user.user_metadata?.full_name as string) ??
      user.email?.split("@")[0] ??
      "Mobius User",
    email: user.email ?? undefined,
    isDemo: false,
    workspaceMode: profile?.workspace_mode ?? "interview",
    preferredRolePack: resolveRolePack(profile?.preferred_role_pack ?? preferredRolePack),
  });

  await admin.from("profiles").upsert(
    {
      user_id: viewer.id,
      full_name: viewer.displayName,
      preferred_role_pack: viewer.preferredRolePack,
      workspace_mode: viewer.workspaceMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return viewer;
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/auth/sign-in");
  }
  return viewer;
}
