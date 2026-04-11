import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { hasSupabase, runtimeEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  }

  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { email, password, displayName } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "缺少邮箱或密码" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少需要 6 个字符" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    runtimeEnv.supabaseUrl!,
    runtimeEnv.supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName || undefined },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return response;
}
