import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { hasSupabase, runtimeEnv } from "@/lib/env";

const COOKIE_NAME = "sb-host-auth-token";

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
  const sessionJson = JSON.stringify({
    access_token: data.session!.access_token,
    token_type: data.session!.token_type,
    expires_in: data.session!.expires_in,
    expires_at: data.session!.expires_at,
    refresh_token: data.session!.refresh_token,
    user: data.session!.user,
  });
  const cookieValue = `base64-${Buffer.from(sessionJson).toString("base64")}`;

  const url = new URL("/journey", runtimeEnv.appUrl);
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: url.toString() },
  });
  response.cookies.set(COOKIE_NAME, cookieValue, {
    path: "/",
    maxAge: 34560000,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
