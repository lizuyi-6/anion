import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...originalEnv };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  vi.resetModules();
  return import("@/lib/env");
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("runtime environment selection", () => {
  it("derives ports from PORT_BASE", async () => {
    const { runtimeEnv } = await loadEnv({
      PORT_BASE: "3100",
      WEB_PORT: undefined,
      API_PORT: undefined,
      WORKER_PORT: undefined,
    });

    expect(runtimeEnv.portBase).toBe(3100);
    expect(runtimeEnv.webPort).toBe(3100);
    expect(runtimeEnv.apiPort).toBe(3101);
    expect(runtimeEnv.workerPort).toBe(3102);
    expect(runtimeEnv.serviceOrigins.web).toBe("http://127.0.0.1:3100");
    expect(runtimeEnv.serviceOrigins.api).toBe("http://127.0.0.1:3101");
    expect(runtimeEnv.serviceOrigins.worker).toBe("http://127.0.0.1:3102");
  });

  it("falls back to local drivers when infra env is missing", async () => {
    const { runtimeEnv } = await loadEnv({
      AUTH_DRIVER: undefined,
      DATA_DRIVER: undefined,
      QUEUE_DRIVER: undefined,
      AI_DRIVER: undefined,
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      TRIGGER_SECRET_KEY: undefined,
      TRIGGER_PROJECT_ID: undefined,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      MINIMAX_API_KEY: undefined,
    });

    expect(runtimeEnv.authDriver).toBe("local");
    expect(runtimeEnv.dataDriver).toBe("memory");
    expect(runtimeEnv.queueDriver).toBe("inline");
    expect(runtimeEnv.aiDriver).toBe("mock");
  });

  it("selects infrastructure-backed drivers when env is present", async () => {
    const { runtimeEnv } = await loadEnv({
      SUPABASE_URL: "https://db.example.com",
      SUPABASE_ANON_KEY: "anon-key",
      TRIGGER_SECRET_KEY: "trigger-secret",
      TRIGGER_PROJECT_ID: "trigger-project",
      OPENAI_API_KEY: "openai-key",
    });

    expect(runtimeEnv.authDriver).toBe("supabase");
    expect(runtimeEnv.dataDriver).toBe("supabase");
    expect(runtimeEnv.queueDriver).toBe("trigger");
    expect(runtimeEnv.aiDriver).toBe("openai");
  });
});
