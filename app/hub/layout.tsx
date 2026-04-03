import { JourneyShell } from "@/components/journey-shell";
import { requireViewer } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function HubLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <JourneyShell viewer={viewer} activeHref="/hub">
      {children}
    </JourneyShell>
  );
}
