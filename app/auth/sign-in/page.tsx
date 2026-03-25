import { redirect } from "next/navigation";

import { AppFrame } from "@/components/app-frame";
import { AuthPanel } from "@/components/auth-panel";
import { runtimeEnv } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";

export default async function SignInPage() {
  const viewer = await getViewer();

  if (viewer) {
    redirect("/");
  }

  return (
    <AppFrame
      viewer={{
        id: "guest",
        displayName: "Guest",
        isDemo: true,
        workspaceMode: "interview",
        preferredRolePack: "engineering",
      }}
      title="登录"
      subtitle="Supabase 模式需要经过验证的会话。当未配置后端时，演示模式仍然可用。"
      shellMode="interview"
    >
      <AuthPanel
        supabaseUrl={runtimeEnv.supabaseUrl ?? ""}
        supabaseAnonKey={runtimeEnv.supabaseAnonKey ?? ""}
        appUrl={runtimeEnv.appUrl}
      />
    </AppFrame>
  );
}
