export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate environment and log warnings
    const { validateEnv } = await import("@/lib/env");
    const warnings = validateEnv();
    if (warnings.length > 0) {
      console.warn("[MOBIUS] 环境配置警告:");
      for (const w of warnings) {
        console.warn(`  - ${w}`);
      }
    }

    // Register OpenClaw skills if enabled
    const { hasOpenClaw } = await import("@/lib/env");
    if (hasOpenClaw()) {
      const { getOpenClawClient } = await import("@/lib/openclaw/client");
      const { registerMobiusSkills } = await import("@/lib/openclaw/skills/register");
      try {
        const client = getOpenClawClient();
        await registerMobiusSkills(client);
      } catch (error) {
        console.warn("Failed to register OpenClaw skills:", error);
      }
    }

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`[MOBIUS] 收到 ${signal}，正在优雅关闭...`);
      try {
        const { closeSqliteStore } = await import("@/lib/server/store/sqlite");
        closeSqliteStore();
      } catch {
        // Not in SQLite mode, ignore
      }
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}
