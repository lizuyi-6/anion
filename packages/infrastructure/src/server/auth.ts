import type { User } from "@supabase/supabase-js";

import { hasSupabaseAdmin, runtimeEnv } from "@anion/config";
import type { RolePackId, Viewer } from "@anion/contracts";
import { rolePackIds, ViewerSchema } from "@anion/contracts";

import { createSupabaseAdminClient, createSupabasePublicClient } from "./supabase";

function resolveRolePack(value: string | undefined | null): RolePackId {
  return rolePackIds.includes(value as RolePackId)
    ? (value as RolePackId)
    : "engineering";
}

function buildViewer(user: User, profile: Record<string, unknown> | null, preferredRolePack?: string | null) {
  return ViewerSchema.parse({
    id: user.id,
    displayName:
      (profile?.full_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Mobius User",
    email: user.email ?? undefined,
    isDemo: false,
    workspaceMode:
      (profile?.workspace_mode as Viewer["workspaceMode"] | undefined) ?? "interview",
    preferredRolePack: resolveRolePack(
      (profile?.preferred_role_pack as string | undefined) ?? preferredRolePack,
    ),
  });
}

async function readProfile(userId: string) {
  if (!hasSupabaseAdmin()) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("*").eq("user_id", userId).limit(1).maybeSingle();
  return data ?? null;
}

async function ensureProfile(viewer: Viewer) {
  if (!hasSupabaseAdmin()) {
    return;
  }

  const admin = createSupabaseAdminClient();
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
}

export function buildLocalViewer(preferredRolePack: RolePackId = "engineering"): Viewer {
  return {
    id: "demo-user",
    displayName: "婕旂ず鍊欓€変汉",
    isDemo: true,
    workspaceMode: "interview",
    preferredRolePack,
  };
}

export async function resolveSupabaseViewer(params: {
  accessToken?: string | null;
  refreshToken?: string | null;
  preferredRolePack?: string | null;
}) {
  if (!params.accessToken) {
    return {
      viewer: null,
      nextAccessToken: null,
      nextRefreshToken: null,
    };
  }

  const client = createSupabasePublicClient();
  const userResult = await client.auth.getUser(params.accessToken);
  let user = userResult.data.user ?? null;
  let nextAccessToken: string | null = params.accessToken;
  let nextRefreshToken = params.refreshToken ?? null;

  if (!user && params.refreshToken) {
    const refresh = await client.auth.refreshSession({
      refresh_token: params.refreshToken,
    });

    user = refresh.data.user ?? null;
    nextAccessToken = refresh.data.session?.access_token ?? null;
    nextRefreshToken = refresh.data.session?.refresh_token ?? null;
  }

  if (!user) {
    return {
      viewer: null,
      nextAccessToken: null,
      nextRefreshToken: null,
    };
  }

  const profile = await readProfile(user.id);
  const viewer = buildViewer(user, profile, params.preferredRolePack);
  await ensureProfile(viewer);

  return {
    viewer,
    nextAccessToken,
    nextRefreshToken,
  };
}

export async function beginMagicLinkSignIn(email: string, next = "/") {
  const client = createSupabasePublicClient();
  const redirectTo = new URL("/api/v1/auth/callback", runtimeEnv.publicOrigin);
  redirectTo.searchParams.set("next", next);

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo.toString(),
    },
  });

  if (error) {
    throw error;
  }
}

export async function beginGoogleSignIn(next = "/") {
  const client = createSupabasePublicClient();
  const redirectTo = new URL("/api/v1/auth/callback", runtimeEnv.publicOrigin);
  redirectTo.searchParams.set("next", next);

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error) {
    throw error;
  }

  return data.url;
}

export async function exchangeAuthCode(code: string, preferredRolePack?: string | null) {
  const client = createSupabasePublicClient();
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    throw error;
  }

  const user = data.user;
  if (!user || !data.session) {
    return {
      viewer: null,
      accessToken: null,
      refreshToken: null,
    };
  }

  const profile = await readProfile(user.id);
  const viewer = buildViewer(user, profile, preferredRolePack);
  await ensureProfile(viewer);

  return {
    viewer,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function revokeAuthSession(accessToken?: string | null) {
  if (!accessToken || !hasSupabaseAdmin()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  await admin.auth.admin.signOut(accessToken);
}
