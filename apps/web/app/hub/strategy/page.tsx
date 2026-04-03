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
      title="可行性研究与战略生成"
      description="输入模糊需求或老板的一句话指令，系统会生成带结构、图示和排期的 FSR，并在可用时保留联网引用。"
      memoryContext={memoryContext}
    />
  );
}
