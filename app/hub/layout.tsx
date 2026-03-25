import { AppFrame } from "@/components/app-frame";
import { requireViewer } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function HubLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <AppFrame
      viewer={viewer}
      title="Command Center"
      subtitle="系统提示词已经切换。这里不再找你的漏洞，而是利用已沉淀的能力图谱补齐短板、生成策略并预演博弈。"
      shellMode="command"
    >
      {children}
    </AppFrame>
  );
}
