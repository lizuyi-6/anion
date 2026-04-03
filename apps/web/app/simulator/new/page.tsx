import { AppFrame } from "@/components/app-frame";
import { InterviewSetupForm } from "@/components/interview-setup-form";
import { requireViewer } from "@/lib/server/auth";

export default async function NewSimulatorPage() {
  const viewer = await requireViewer();

  return (
    <AppFrame
      viewer={viewer}
      activeHref="/simulator/new"
      title="千面考官沙盒"
      subtitle="配置目标公司、岗位、JD、面试官矩阵与候选人材料。首版以文本流式对弈为主，语音链路后续再接。"
      shellMode="interview"
    >
      <InterviewSetupForm defaultRolePack={viewer.preferredRolePack} />
    </AppFrame>
  );
}
