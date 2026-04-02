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
      title="全栈与架构副驾"
      description="把报错、日志、代码片段扔进来。系统会结合你在模拟面试暴露出的短板，跳过废话，直接切根因和修复路径。"
      memoryContext={memoryContext}
    />
  );
}
