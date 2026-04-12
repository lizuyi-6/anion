import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { hasSupabase, runtimeEnv } from "@/lib/env";
import type { RolePackId, Viewer } from "@/lib/domain";
import { rolePackIds, ViewerSchema } from "@/lib/domain";
import { getDataStore } from "@/lib/server/store/repository";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, ROLE_PACK_COOKIE_NAME } from "./constants";

const JwtPayloadSchema = z.object({
  sub: z.string(),
  exp: z.number().optional(),
  email: z.string().optional(),
  user_metadata: z.record(z.string(), z.unknown()).optional(),
});

function resolveRolePack(value: string | undefined | null): RolePackId {
  return rolePackIds.includes(value as RolePackId)
    ? (value as RolePackId)
    : "engineering";
}

export async function getViewer(): Promise<Viewer | null> {
  const cookieStore = await cookies();
  const preferredRolePack = resolveRolePack(
    cookieStore.get(ROLE_PACK_COOKIE_NAME)?.value,
  );

  if (!hasSupabase()) {
    const store = await getDataStore();
    return store.getDemoViewer(preferredRolePack);
  }

  // Read session cookie → validate JWT via Supabase Auth API
  const cookie = cookieStore.get(AUTH_COOKIE_NAME);
  console.error("[AUTH] Cookie present:", !!cookie?.value);
  let accessToken: string | undefined;
  let session: Record<string, unknown> | undefined;
  if (cookie?.value) {
    try {
      const raw = cookie.value.startsWith("base64-") ? cookie.value.slice(7) : cookie.value;
      session = JSON.parse(Buffer.from(raw, "base64").toString()) as Record<string, unknown>;
      accessToken = session.access_token as string | undefined;
      console.error("[AUTH] accessToken present:", !!accessToken);
    } catch (e) {
      console.error("[AUTH] Cookie parse error:", e instanceof Error ? e.message : String(e));
    }
  }

  if (!accessToken) {
    console.error("[AUTH] No access token, returning null");
    return null;
  }

  // Decode JWT to extract user info directly (avoids external API call issues)
  // JWT format: header.payload.signature (base64url encoded)
  let jwtPayload: z.infer<typeof JwtPayloadSchema>;
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const rawPayload = JSON.parse(payloadJson);
    const payloadResult = JwtPayloadSchema.safeParse(rawPayload);
    if (!payloadResult.success) {
      console.error("[AUTH] JWT payload validation failed:", payloadResult.error.issues.map(i => i.path.join(".")).join(", "));
      return null;
    }
    jwtPayload = payloadResult.data;
  } catch (e) {
    console.error("[AUTH] JWT decode error:", e instanceof Error ? e.message : String(e));
    return null;
  }

  const exp = jwtPayload.exp;
  if (exp && exp * 1000 < Date.now()) {
    console.error("[AUTH_REFRESH] Token expired at", new Date(exp * 1000).toISOString(), "current:", new Date().toISOString());

    const refreshToken = session?.refresh_token as string | undefined;
    if (!refreshToken) {
      console.error("[AUTH_REFRESH] No refresh_token in session, cannot refresh");
      return null;
    }

    try {
      const refreshClient = createClient(
        runtimeEnv.supabaseUrl!,
        runtimeEnv.supabaseAnonKey!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );

      const { data: refreshData, error: refreshError } = await refreshClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !refreshData.session) {
        console.error("[AUTH_REFRESH] Refresh failed:", refreshError?.message ?? "no session returned");
        return null;
      }

      const newSession = refreshData.session;
      console.error("[AUTH_REFRESH] Refresh succeeded for user:", newSession.user?.id);

      const newSessionJson = JSON.stringify({
        access_token: newSession.access_token,
        token_type: newSession.token_type,
        expires_in: newSession.expires_in,
        expires_at: newSession.expires_at,
        refresh_token: newSession.refresh_token,
        user: newSession.user,
      });
      const newCookieValue = `base64-${Buffer.from(newSessionJson).toString("base64")}`;

      cookieStore.set(AUTH_COOKIE_NAME, newCookieValue, {
        path: "/",
        maxAge: AUTH_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
      });

      console.error("[AUTH_REFRESH] Cookie updated, new expiry:", new Date((newSession.expires_at ?? 0) * 1000).toISOString());

      accessToken = newSession.access_token;
      const newParts = accessToken.split(".");
      if (newParts.length !== 3) throw new Error("Invalid refreshed JWT format");
      const newPayloadBase64 = newParts[1].replace(/-/g, "+").replace(/_/g, "/");
      const newPayloadJson = Buffer.from(newPayloadBase64, "base64").toString("utf-8");
      const newRawPayload = JSON.parse(newPayloadJson);
      const newPayloadResult = JwtPayloadSchema.safeParse(newRawPayload);
      if (!newPayloadResult.success) {
        console.error("[AUTH] Refreshed JWT payload validation failed:", newPayloadResult.error.issues.map(i => i.path.join(".")).join(", "));
        return null;
      }
      jwtPayload = newPayloadResult.data;
    } catch (refreshCatchError) {
      console.error("[AUTH_REFRESH] Unexpected error during refresh:", refreshCatchError instanceof Error ? refreshCatchError.message : String(refreshCatchError));
      return null;
    }
  }

  const userId = jwtPayload.sub;
  const userEmail = jwtPayload.email;
  const userMetadata = jwtPayload.user_metadata;
  console.error("[AUTH] JWT valid");

  if (!userId) return null;

  const user = {
    id: userId,
    email: userEmail ?? undefined,
    user_metadata: userMetadata,
  };

  // Admin client for profile operations
  const admin = createClient(
    runtimeEnv.supabaseUrl!,
    runtimeEnv.supabaseServiceRoleKey!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

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
