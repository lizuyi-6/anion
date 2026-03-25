import { NextResponse } from "next/server";

import { runtimeEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/server/supabase";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/auth/sign-in", runtimeEnv.appUrl));
}
