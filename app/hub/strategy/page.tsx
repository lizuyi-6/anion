import { HubConsole } from "@/components/hub-console";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";

export default async function StrategyPage() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const memoryContext = await store.getActiveMemoryContext(viewer.id);

  return (
    <HubConsole
      mode="strategy"
      title="生成下一周准备计划"
      description="把这轮复盘压成一份真正可执行的计划：先练什么、先补什么、什么算完成。"
      memoryContext={memoryContext}
    />
  );
}
