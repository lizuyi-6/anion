import { HubConsole } from "@/components/hub-console";
import { requireViewer } from "@/lib/server/auth";
import { getDataStore } from "@/lib/server/store/repository";

export default async function CopilotPage() {
  const viewer = await requireViewer();
  const store = await getDataStore({ viewer });
  const memoryContext = await store.getActiveMemoryContext(viewer.id);

  return (
    <HubConsole
      mode="copilot"
      title="修复一个高风险回答"
      description="把最近一次复盘里最需要优先修正的问题、日志或代码片段带进来，先把最影响结果的地方拆开处理。"
      memoryContext={memoryContext}
    />
  );
}
