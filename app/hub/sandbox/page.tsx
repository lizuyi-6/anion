import { HubConsole } from "@/components/hub-console";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";

export default async function SandboxPage() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const memoryContext = await store.getActiveMemoryContext(viewer.id);

  return (
    <HubConsole
      mode="sandbox"
      title="练一次高风险沟通场景"
      description="先在低风险环境里预演冲突、谈判或高压协作场景，把真正会失分的点提前暴露出来。"
      memoryContext={memoryContext}
    />
  );
}
