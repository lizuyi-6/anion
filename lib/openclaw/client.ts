import { v4 as uuid } from "uuid";
import type {
  OpenClawRequest,
  OpenClawResponse,
  OpenClawEvent,
  OpenClawMethod,
} from "./types";
import { hasOpenClaw, getGatewayUrl } from "./env";

type EventHandler = (event: OpenClawEvent) => void;

interface PendingRequest {
  resolve: (response: OpenClawResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * OpenClaw WebSocket client. Connects to the gateway (port 18789)
 * and provides a request/response + event subscription API.
 *
 * In demo mode or when OpenClaw is disabled, getOpenClawClient()
 * returns a no-op mock that immediately resolves requests with empty responses.
 */
export interface OpenClawClient {
  readonly connected: boolean;
  send(method: OpenClawMethod, params?: Record<string, unknown>): Promise<OpenClawResponse>;
  subscribe(eventType: string, handler: EventHandler): () => void;
  close(): void;
}

// --- Real Implementation ---

class GatewayClient implements OpenClawClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private handlers = new Map<string, Set<EventHandler>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  get connected() {
    return this._connected;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);

      ws.addEventListener("open", () => {
        this._connected = true;
        this.ws = ws;
        this.startHeartbeat();
        resolve();
      });

      ws.addEventListener("message", (event) => {
        const frame = JSON.parse(String(event.data)) as
          | OpenClawResponse
          | OpenClawEvent;

        if (frame.type === "res") {
          const pending = this.pending.get(frame.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(frame.id);
            pending.resolve(frame);
          }
        } else if (frame.type === "event") {
          const handlers = this.handlers.get(frame.event);
          if (handlers) {
            for (const handler of handlers) {
              handler(frame);
            }
          }
        }
      });

      ws.addEventListener("close", () => {
        this._connected = false;
        this.stopHeartbeat();
        this.rejectAllPending(new Error("WebSocket closed"));
        this.scheduleReconnect();
      });

      ws.addEventListener("error", () => {
        this._connected = false;
        reject(new Error("WebSocket connection failed"));
      });
    });
  }

  async send(
    method: OpenClawMethod,
    params?: Record<string, unknown>,
  ): Promise<OpenClawResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const id = uuid();
    const request: OpenClawRequest = {
      type: "req",
      id,
      method,
      params: params ?? {},
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OpenClaw request timeout: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(request));
    });
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    let handlers = this.handlers.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.rejectAllPending(new Error("Client closed"));
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "req", id: "heartbeat", method: "health" }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect failed; schedule another attempt
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

// --- No-Op Mock ---

class NoOpClient implements OpenClawClient {
  readonly connected = false;

  async send(): Promise<OpenClawResponse> {
    return {
      type: "res",
      id: "noop",
      ok: true,
      payload: null,
    };
  }

  subscribe(): () => void {
    return () => {};
  }

  close(): void {}
}

// --- Singleton Factory ---

let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient {
  if (!clientInstance) {
    if (hasOpenClaw()) {
      clientInstance = new GatewayClient(getGatewayUrl());
    } else {
      clientInstance = new NoOpClient();
    }
  }

  return clientInstance;
}

export function resetOpenClawClient(): void {
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
  }
}
