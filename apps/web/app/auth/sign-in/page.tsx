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
      subtitle="The frontend now delegates authentication to the API service and keeps only the sign-in surface here."
      shellMode="interview"
    >
      <AuthPanel authDriver={runtimeEnv.authDriver} />
    </AppFrame>
  );
}
