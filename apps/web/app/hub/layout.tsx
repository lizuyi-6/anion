import { HubShell } from "@/components/hub-shell";
import { requireViewer } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function HubLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();

  return <HubShell viewer={viewer} activeTrack={viewer.preferredRolePack}>{children}</HubShell>;
}
