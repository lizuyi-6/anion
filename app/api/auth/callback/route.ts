import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { hasSupabase, runtimeEnv } from "@/lib/env";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "@/lib/server/constants";

function seeOther(path: string) {
  const url = new URL(path, runtimeEnv.appUrl);
  return new NextResponse(null, { status: 303, headers: { Location: url.toString() } });
}

function buildSessionCookie(session: {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  refresh_token: string;
  user: unknown;
}) {
  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  return `base64-${Buffer.from(sessionJson).toString("base64")}`;
}

function buildRedirectWithCookie(cookieValue: string) {
  const url = new URL("/journey", runtimeEnv.appUrl);
  const isSecure = runtimeEnv.appUrl.startsWith("https://");

  const cookieParts = [
    `${AUTH_COOKIE_NAME}=${cookieValue}`,
    "path=/",
    `max-age=${AUTH_COOKIE_MAX_AGE}`,
    "samesite=lax",
    "httponly",
    isSecure ? "secure" : "",
  ].filter(Boolean);

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: url.toString(),
      "Set-Cookie": cookieParts.join("; "),
    },
  });
}

export async function GET(request: NextRequest) {
  if (!hasSupabase()) {
    console.error("[AUTH_CALLBACK] Supabase not configured");
    return seeOther("/auth/sign-in?error=not_configured");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  try {
    let session: {
      access_token: string;
      token_type: string;
      expires_in: number;
      expires_at?: number;
      refresh_token: string;
      user: unknown;
    } | null = null;

    if (code) {
      console.log("[AUTH_CALLBACK] Exchanging PKCE code for session");
      const supabase = createClient(
        runtimeEnv.supabaseUrl!,
        runtimeEnv.supabaseAnonKey!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AUTH_CALLBACK] Code exchange failed:", error.message);
        return seeOther("/auth/sign-in?error=callback_failed");
      }

      session = data.session;
    } else if (accessToken && refreshToken) {
      console.log("[AUTH_CALLBACK] Using implicit flow tokens from URL");

      const expiresIn = Number(searchParams.get("expires_in")) || 3600;
      const expiresAt = Number(searchParams.get("expires_at")) || Math.floor(Date.now() / 1000) + expiresIn;

      session = {
        access_token: accessToken,
        token_type: searchParams.get("token_type") ?? "bearer",
        expires_in: expiresIn,
        expires_at: expiresAt,
        refresh_token: refreshToken,
        user: null,
      };
    }

    if (!session) {
      console.error("[AUTH_CALLBACK] No session obtained — missing code and tokens");
      return seeOther("/auth/sign-in?error=no_session");
    }

    const cookieValue = buildSessionCookie(session);
    console.log("[AUTH_CALLBACK] Session obtained, setting cookie and redirecting to /journey");

    return buildRedirectWithCookie(cookieValue);
  } catch (err) {
    console.error("[AUTH_CALLBACK] Unexpected error:", err);
    return seeOther("/auth/sign-in?error=callback_failed");
  }
}
