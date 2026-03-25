import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hasSupabase } from "@/lib/env";
import type { RolePackId, Viewer } from "@/lib/domain";
import { rolePackIds, ViewerSchema } from "@/lib/domain";
import { getDataStore } from "@/lib/server/store/repository";
import { createSupabaseServerClient } from "@/lib/server/supabase";

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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const viewer = ViewerSchema.parse({
    id: user.id,
    displayName:
      profile?.full_name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "Mobius User",
    email: user.email ?? undefined,
    isDemo: false,
    workspaceMode: profile?.workspace_mode ?? "interview",
    preferredRolePack: resolveRolePack(profile?.preferred_role_pack ?? preferredRolePack),
  });

  await supabase.from("profiles").upsert(
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
