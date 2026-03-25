import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
  CommandThread,
  UploadReference,
  Viewer,
} from "@/lib/domain";
import { getAiProvider } from "@/lib/ai/adapter";
import type { DataStore } from "@/lib/server/store/repository";
import { summarizeText, titleCase, toId } from "@/lib/utils";

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
    title: `${titleCase(params.mode)} | ${summarizeText(params.input, 42)}`,
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
        "Shortest fix:",
        ...artifact.shortestFix.map((item) => `- ${item}`),
        ...(artifact.watchouts.length > 0
          ? ["", "Watchouts:", ...artifact.watchouts.map((item) => `- ${item}`)]
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
        `Recommended move: ${artifact.recommendedMove}`,
        ...(artifact.pressurePoints.length > 0
          ? ["", "Pressure points:", ...artifact.pressurePoints.map((item) => `- ${item}`)]
          : []),
      ].join("\n");
  }
}
