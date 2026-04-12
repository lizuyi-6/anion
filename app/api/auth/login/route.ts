import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { hasSupabase, runtimeEnv } from "@/lib/env";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "@/lib/server/constants";

/** Return a 303 redirect (See Other) — browser follows with GET. */
function seeOther(path: string) {
  const url = new URL(path, runtimeEnv.appUrl);
  return new NextResponse(null, { status: 303, headers: { Location: url.toString() } });
}

export async function POST(request: NextRequest) {
  if (!hasSupabase()) {
    return seeOther("/auth/sign-in?error=not_configured");
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return seeOther("/auth/sign-in?error=bad_request");
  }

  const { email, password } = body;
  if (!email || !password) {
    return seeOther("/auth/sign-in?error=missing_fields");
  }

  // Use raw supabase-js client — bypass @supabase/ssr entirely to avoid
  // its internal session management from invalidating the session.
  const supabase = createClient(
    runtimeEnv.supabaseUrl!,
    runtimeEnv.supabaseAnonKey!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = encodeURIComponent(error.message);
    return seeOther(`/auth/sign-in?error=${msg}`);
  }

  // Manually set the session cookie, matching the format @supabase/ssr uses
  const sessionData = data.session;
  if (!sessionData) {
    return seeOther("/auth/sign-in?error=no_session");
  }

  const sessionJson = JSON.stringify({
    access_token: sessionData.access_token,
    token_type: sessionData.token_type,
    expires_in: sessionData.expires_in,
    expires_at: sessionData.expires_at,
    refresh_token: sessionData.refresh_token,
    user: sessionData.user,
  });
  const cookieValue = `base64-${Buffer.from(sessionJson).toString("base64")}`;

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

  const setCookieHeader = cookieParts.join("; ");
  console.log("[LOGIN] Setting cookie:", `${AUTH_COOKIE_NAME}=[value hidden], parts: [${cookieParts.join(", ")}]`);

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: url.toString(),
      "Set-Cookie": setCookieHeader,
    },
  });

  return response;
}
