import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";
import { CompanionChat } from "@/components/companion-chat";
import type { CommandMode } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const memoryContext = await store.getActiveMemoryContext(viewer.id);
  const { mode } = await searchParams;

  return (
    <div className="workspace-grid">
      <CompanionChat
        memoryContext={memoryContext}
        initialMode={(mode as CommandMode) ?? undefined}
      />
    </div>
  );
}
