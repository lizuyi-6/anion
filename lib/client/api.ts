import type {
  CommandArtifact,
  CommandMessage,
  CommandMode,
  LiveTurnEvent,
  SessionConfig,
  UploadReference,
} from "@/lib/domain";

export async function uploadFiles(files: FileList | File[]) {
  const formData = new FormData();

  for (const file of Array.from(files)) {
    formData.append("files", file);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  const payload = (await response.json()) as { uploads: UploadReference[] };
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
    throw new Error("Failed to create session");
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
    throw new Error("Failed to receive interview stream");
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
    throw new Error("Failed to queue report generation");
  }

  return response.json();
}

export async function fetchReportStatus(sessionId: string) {
  const response = await fetch(`/api/reports/${sessionId}/status`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load report status");
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
    throw new Error("Failed to retry report generation");
  }

  return response.json();
}

export async function acceptOffer(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/accept`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to switch into command center mode");
  }

  return response.json();
}

export async function activateHub(sessionId: string) {
  const response = await fetch(`/api/sessions/${sessionId}/hub`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to activate command center");
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
    throw new Error("Failed to run command mode");
  }

  return (await response.json()) as {
    threadId: string;
    artifact: CommandArtifact;
    history: CommandMessage[];
  };
}
