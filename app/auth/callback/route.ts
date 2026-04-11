import { NextResponse } from "next/server";

import { runtimeEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/journey";
  const next = rawNext.startsWith("/") ? rawNext : "/journey";

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] Code exchange failed:", error.message);
        return NextResponse.redirect(
          new URL(`/auth/sign-in?error=${encodeURIComponent("登录回调失败，请重试")}`, runtimeEnv.appUrl),
        );
      }
    } catch (error) {
      console.error("[auth/callback] Unexpected error:", error);
      return NextResponse.redirect(
        new URL(`/auth/sign-in?error=${encodeURIComponent("登录回调异常，请重试")}`, runtimeEnv.appUrl),
      );
    }
  }

  return NextResponse.redirect(new URL(next, runtimeEnv.appUrl));
}
