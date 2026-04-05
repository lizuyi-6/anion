import { InterviewSetupForm } from "@/components/interview-setup-form";
import { SessionShell } from "@/components/session-shell";
import { formatRolePackLabel } from "@/lib/domain";
import { parseRolePackPrefill, type SessionPrefill } from "@/lib/journey";
import { requireViewer } from "@/lib/server/auth";

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function NewSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const prefill: SessionPrefill = {
    rolePack: parseRolePackPrefill(firstValue(params.rolePack)),
    targetCompany: firstValue(params.targetCompany),
    industry: firstValue(params.industry),
    level: firstValue(params.level),
    focusGoal: firstValue(params.focusGoal),
    jobDescription: firstValue(params.jobDescription),
    candidateName: firstValue(params.candidateName),
    interviewers: firstValue(params.interviewers)
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };

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
      <InterviewSetupForm
        defaultRolePack={viewer.preferredRolePack}
        prefill={prefill}
      />
    </SessionShell>
  );
}
