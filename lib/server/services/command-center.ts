import { getAiProvider } from "@/lib/ai/adapter";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
  CommandThread,
  SandboxTurnEvent,
  UploadReference,
  Viewer,
} from "@/lib/domain";
import { formatCommandModeLabel } from "@/lib/domain";
import type { DataStore } from "@/lib/server/store/repository";
import { summarizeText, toId } from "@/lib/utils";

export async function resolveThread(params: {
  store: DataStore;
  viewer: Viewer;
  mode: CommandMode;
  threadId?: string;
  sessionId?: string;
  input: string;
}) {
  if (params.threadId) {
    const existing = await params.store.getThread(params.threadId);
    if (existing) {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const thread: CommandThread = {
    id: toId("thread"),
    userId: params.viewer.id,
    mode: params.mode,
    title: `${formatCommandModeLabel(params.mode)} | ${summarizeText(params.input, 42)}`,
    createdAt: now,
    updatedAt: now,
    sessionId: params.sessionId,
  };

  await params.store.createThread(thread);
  return thread;
}

export async function runCommandMode(params: {
  store: DataStore;
  viewer: Viewer;
  mode: CommandMode;
  threadId?: string;
  sessionId?: string;
  input: string;
  attachments: UploadReference[];
  memoryContext: ActiveMemoryContext | null;
}) {
  const ai = getAiProvider();
  const thread = await resolveThread(params);
  const history = await params.store.listCommandMessages(thread.id);
  const createdAt = new Date().toISOString();

  await params.store.appendCommandMessage({
    id: toId("msg"),
    threadId: thread.id,
    mode: params.mode,
    role: "user",
    content: params.input,
    attachments: params.attachments,
    createdAt,
  });

  const artifact = await ai.generateCommandArtifact({
    mode: params.mode,
    viewer: params.viewer,
    memoryContext: params.memoryContext,
    prompt: params.input,
    attachments: params.attachments,
    history: history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const assistantMessage = summarizeArtifact(artifact);
  await params.store.appendCommandMessage({
    id: toId("msg"),
    threadId: thread.id,
    mode: params.mode,
    role: "assistant",
    content: assistantMessage,
    attachments: [],
    artifact,
    createdAt: new Date().toISOString(),
  });

  await params.store.saveArtifact(thread.id, params.viewer.id, params.mode, artifact);

  return {
    thread,
    artifact,
    history: await params.store.listCommandMessages(thread.id),
  };
}

function summarizeArtifact(artifact: CommandArtifact) {
  switch (artifact.mode) {
    case "copilot":
      return [
        artifact.rootCause,
        "",
        "最短修复路径：",
        ...artifact.shortestFix.map((item) => `- ${item}`),
        ...(artifact.watchouts.length > 0
          ? ["", "注意事项：", ...artifact.watchouts.map((item) => `- ${item}`)]
          : []),
      ].join("\n");
    case "strategy":
      return [
        ...artifact.sections.map((section) => `${section.title}\n${section.body}`),
        ...(artifact.deliverables.length > 0
          ? ["交付物\n" + artifact.deliverables.map((item) => `- ${item}`).join("\n")]
          : []),
      ].join("\n\n");
    case "sandbox":
      return [
        artifact.equilibrium,
        "",
        `推荐动作：${artifact.recommendedMove}`,
        ...(artifact.pressurePoints.length > 0
          ? ["", "施压点：", ...artifact.pressurePoints.map((item) => `- ${item}`)]
          : []),
      ].join("\n");
  }
}

export async function generateSandboxBeat(params: {
  store: DataStore;
  viewer: Viewer;
  threadId: string;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  memoryContext: ActiveMemoryContext | null;
}): Promise<SandboxTurnEvent> {
  const ai = getAiProvider();
  const existingMessages = await params.store.listCommandMessages(params.threadId);

  const sandboxHistory = existingMessages
    .filter((message) => message.role === "user" || message.content.startsWith("[对手]"))
    .map((message) => ({
      role: message.role === "user" ? "user" as const : "counterpart" as const,
      content: message.content.replace(/^\[对手\]\s*/, ""),
    }));

  await params.store.appendCommandMessage({
    id: toId("msg"),
    threadId: params.threadId,
    mode: "sandbox",
    role: "user",
    content: params.userMessage,
    attachments: [],
    createdAt: new Date().toISOString(),
  });

  const event = await ai.generateSandboxTurn({
    threadId: params.threadId,
    history: sandboxHistory,
    userMessage: params.userMessage,
    counterpartRole: params.counterpartRole,
    counterpartIncentives: params.counterpartIncentives,
    userRedLine: params.userRedLine,
    memoryContext: params.memoryContext,
  });

  const assistantContent = [
    `[对手] ${event.counterpartMessage}`,
    "",
    `[战术分析] ${event.strategicCommentary}`,
    `策略意图：${event.counterpartTone}`,
    `施压等级：${event.pressureLevel}/10`,
  ].join("\n");

  await params.store.appendCommandMessage({
    id: toId("msg"),
    threadId: params.threadId,
    mode: "sandbox",
    role: "assistant",
    content: assistantContent,
    attachments: [],
    createdAt: new Date().toISOString(),
  });

  return event;
}
