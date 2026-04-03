import { InterviewSetupForm } from "@/components/interview-setup-form";
import { SessionShell } from "@/components/session-shell";
import { formatRolePackLabel } from "@/lib/domain";
import { requireViewer } from "@/lib/server/auth";

export default async function NewSimulatorPage() {
  const viewer = await requireViewer();

  return (
    <SessionShell
      viewer={viewer}
      activeHref="/simulator/new"
      stage="goal"
      eyebrow="目标设定"
      title="先把这轮准备目标说清楚"
      description="只需要三步：确认目标岗位、补充已有材料、选择这轮最想重点练的能力。后面的模拟和复盘会自动接上。"
      supportingMeta={[
        { label: "默认受众", value: `${formatRolePackLabel(viewer.preferredRolePack)}岗位` },
        { label: "流程长度", value: "3 步完成" },
        { label: "完成后", value: "直接进入模拟训练" },
      ]}
    >
      <InterviewSetupForm defaultRolePack={viewer.preferredRolePack} />
    </SessionShell>
  );
}
