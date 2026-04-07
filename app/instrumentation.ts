export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
  }
}
