import type {
  CommandArtifact,
  CommandMessage,
  CommandMode,
  LiveTurnEvent,
  SandboxTurnEvent,
  SessionConfig,
  UploadReference,
} from "@/lib/domain";

export interface UploadError {
  error: string;
  message?: string;
}

interface ApiErrorResponse extends UploadError {
  provider?: string;
  retryable?: boolean;
}

async function readErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const errorData = (await response.json()) as ApiErrorResponse;
    return errorData.message || errorData.error || fallbackMessage;
  } catch {
    return `${fallbackMessage} (${response.status})`;
  }
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  throw new Error(await readErrorMessage(response, fallbackMessage));
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
    await throwApiError(response, "Upload failed");
  }

  const payload = (await response.json()) as {
    uploads: UploadReference[];
    message?: string;
  };

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
    await throwApiError(response, "Failed to create session");
  }

  return (await response.json()) as { sessionId: string };
}

export async function streamInterviewTurn(params: {
  sessionId: string;
  answer: string;
  elapsedSeconds: number;
  timerExpired: boolean;
  onEvent: (event: LiveTurnEvent) => void;
  onThinking?: (status: string) => void;
}) {
  const response = await fetch(`/api/interviews/${params.sessionId}/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      answer: params.answer,
      elapsedSeconds: params.elapsedSeconds,
      timerExpired: params.timerExpired,
    }),
  });

  if (!response.ok) {
    await throwApiError(response, "Interview stream failed");
  }

  if (!response.body) {
    throw new Error("Interview stream failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
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

      const eventLine = chunk.split("\n").find((line) => line.startsWith("event: "));
      const eventType = eventLine ? eventLine.slice(7) : "turn";

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(dataLine.slice(6));
      } catch {
        console.error("Failed to parse SSE data:", dataLine);
        continue;
      }

      if (eventType === "thinking") {
        params.onThinking?.(data.status as string);
        continue;
      }

      params.onEvent(data as LiveTurnEvent);
    }
  }
  } finally {
    reader.cancel().catch(() => {});
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
    await throwApiError(response, "Failed to start report generation");
  }

  return response.json();
}

export async function fetchReportStatus(sessionId: string) {
  const response = await fetch(`/api/reports/${sessionId}/status`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to load report status");
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
    await throwApiError(response, "Failed to retry report generation");
  }

  return response.json();
}

export async function acceptOffer(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/accept`, {
    method: "POST",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to switch command center mode");
  }

  return response.json();
}

export async function activateHub(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/hub`, {
    method: "POST",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to activate command center");
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
    await throwApiError(response, "Command mode run failed");
  }

  return (await response.json()) as {
    threadId: string;
    artifact: CommandArtifact;
    history: CommandMessage[];
  };
}

export async function streamSandboxTurn(params: {
  threadId: string;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  onEvent: (event: SandboxTurnEvent) => void;
}) {
  const response = await fetch("/api/command/sandbox/turn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      threadId: params.threadId,
      userMessage: params.userMessage,
      counterpartRole: params.counterpartRole,
      counterpartIncentives: params.counterpartIncentives,
      userRedLine: params.userRedLine,
    }),
  });

  if (!response.ok) {
    await throwApiError(response, "Sandbox turn failed");
  }

  if (!response.body) {
    throw new Error("Sandbox turn failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
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

      try {
        const event = JSON.parse(dataLine.slice(6)) as SandboxTurnEvent;
        params.onEvent(event);
      } catch {
        console.error("Failed to parse sandbox SSE data:", dataLine);
      }
    }
  }
  } finally {
    reader.cancel().catch(() => {});
  }
}
