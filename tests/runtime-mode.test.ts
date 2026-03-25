import { describe, expect, it } from "vitest";

import { resolveRuntimeModeFromEnv } from "@/lib/env";

describe("runtime mode selection", () => {
  it("falls back to demo when supabase env is incomplete", () => {
    expect(resolveRuntimeModeFromEnv({})).toBe("demo");
    expect(resolveRuntimeModeFromEnv({ supabaseUrl: "https://db.example.com" })).toBe(
      "demo",
    );
  });

  it("enables supabase mode when the public env is complete", () => {
    expect(
      resolveRuntimeModeFromEnv({
        supabaseUrl: "https://db.example.com",
        supabaseAnonKey: "anon-key",
      }),
    ).toBe("supabase");
  });
});
