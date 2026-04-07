/**
 * OpenClaw WebSocket gateway protocol types.
 * Based on the JSON-over-WS protocol (port 18789).
 *
 * Wire format: 3 frame types — req, res, event
 */

// --- Wire Protocol ---

export type OpenClawFrameType = "req" | "res" | "event";

export interface OpenClawRequest {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface OpenClawResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

export interface OpenClawEvent {
  type: "event";
  event: string;
  payload: unknown;
}

// --- Gateway Methods ---

export type OpenClawMethod =
  | "health"
  | "status"
  | "send"
  | "agent"
  | "memory.set"
  | "memory.get"
  | "memory.clear"
  | "skill.invoke"
  | "skill.list"
  | "cron.create"
  | "cron.delete"
  | "cron.list";

// --- Skill System ---

export interface OpenClawSkillManifest {
  name: string;
  description: string;
  version?: string;
  instructions: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  requires?: {
    bins?: string[];
    env?: string[];
    config?: string[];
  };
}

// --- Cron System ---

export type OpenClawCronSchedule =
  | { type: "one-shot"; at: string }
  | { type: "interval"; every: string }
  | { type: "cron"; expression: string; timezone?: string };

export type OpenClawCronStyle =
  | "main"
  | "isolated"
  | "current"
  | `session:${string}`;

export type OpenClawCronDelivery = "announce" | "webhook" | "none";

export interface OpenClawCronJob {
  id: string;
  name: string;
  schedule: OpenClawCronSchedule;
  style: OpenClawCronStyle;
  delivery: OpenClawCronDelivery;
  payload?: Record<string, unknown>;
  enabled: boolean;
}

// --- Memory Bridge Types ---

export interface OpenClawMemoryState {
  sessionId: string;
  nodes: OpenClawMemoryNode[];
  anchors: OpenClawMemoryAnchor[];
  updatedAt: string;
}

export interface OpenClawMemoryNode {
  key: string;
  value: string;
  confidence: number;
  kind: "skill" | "gap" | "behavior" | "win";
  sourceTurnIds: string[];
}

export interface OpenClawMemoryAnchor {
  label: string;
  excerpt: string;
  sourceTurnId: string;
}

export interface OpenClawContextualData {
  totalSessions: number;
  skillTrends: Array<{
    label: string;
    trend: string;
    latestConfidence: number;
  }>;
  recurringGaps: Array<{
    label: string;
    summary: string;
  }>;
  milestones: Array<{
    kind: string;
    title: string;
  }>;
  daysSinceLastSession: number | null;
  streakDays: number;
}

// --- Notification Types (for webhook delivery) ---

export interface OpenClawWebhookPayload {
  event: string;
  cronJobId: string;
  cronJobName: string;
  sessionId?: string;
  result?: unknown;
  timestamp: string;
}
