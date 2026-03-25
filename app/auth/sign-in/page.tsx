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
      title="Sign in"
      subtitle="Supabase mode requires a verified session. Demo mode remains available when no backend is configured."
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
