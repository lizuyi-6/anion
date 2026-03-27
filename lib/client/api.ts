import type {
  CommandArtifact,
  CommandMessage,
  CommandMode,
  LiveTurnEvent,
  SessionConfig,
  UploadReference,
} from "@/lib/domain";

export interface UploadError {
  error: string;
  message?: string;
}

export async function uploadFiles(files: FileList | File[]) {
  if (files.length === 0) {
    return [];
  }

  const formData = new FormData();

  for (const file of Array.from(files)) {
    formData.append("files", file);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = "上传失败";

    try {
      const errorData = (await response.json()) as UploadError;
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      errorMessage = `上传失败 (${response.status})`;
    }

    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as { uploads: UploadReference[]; message?: string };
  return payload.uploads;
}

export async function createSession(config: SessionConfig) {
  const response = await fetch("/api/interviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    let errorMessage = "创建会话失败";

    try {
      const errorData = (await response.json()) as { error?: string; message?: string };
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      errorMessage = `创建会话失败 (${response.status})`;
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as { sessionId: string };
}

export async function streamInterviewTurn(params: {
  sessionId: string;
  answer: string;
  elapsedSeconds: number;
  onEvent: (event: LiveTurnEvent) => void;
}) {
  const response = await fetch(`/api/interviews/${params.sessionId}/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      answer: params.answer,
      elapsedSeconds: params.elapsedSeconds,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("接收面试流失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const chunk of events) {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) {
        continue;
      }

      const event = JSON.parse(dataLine.slice(6)) as LiveTurnEvent;
      params.onEvent(event);
    }
  }
}

export async function completeSession(sessionId: string) {
  const response = await fetch(`/api/interviews/${sessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error("提交报告生成任务失败");
  }

  return response.json();
}

export async function fetchReportStatus(sessionId: string) {
  const response = await fetch(`/api/reports/${sessionId}/status`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("加载报告状态失败");
  }

  return (await response.json()) as {
    status: string;
    reportReady: boolean;
    memoryReady: boolean;
    lastError: string | null;
    retryable: boolean;
  };
}

export async function retryReport(sessionId: string) {
  const response = await fetch(`/api/reports/${sessionId}/retry`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("重试报告生成失败");
  }

  return response.json();
}

export async function acceptOffer(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/accept`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("切换指挥中心模式失败");
  }

  return response.json();
}

export async function activateHub(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/hub`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("激活指挥中心失败");
  }

  return response.json();
}

export async function runCommandModeApi(params: {
  mode: CommandMode;
  threadId?: string;
  input: string;
  attachments: UploadReference[];
}) {
  const response = await fetch(`/api/command/${params.mode}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("运行命令模式失败");
  }

  return (await response.json()) as {
    threadId: string;
    artifact: CommandArtifact;
    history: CommandMessage[];
  };
}
