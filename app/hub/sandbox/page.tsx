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
      title="职场博弈沙盘模拟"
      description="设定对手人格、冲突议题和会议背景，系统会分析当前均衡点、推荐动作和长期代价。"
      memoryContext={memoryContext}
    />
  );
}
