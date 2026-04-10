const openclawEnv = {
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL ?? "",
  webhookUrl: process.env.OPENCLAW_WEBHOOK_URL ?? "",
  sharedSecret: process.env.OPENCLAW_SHARED_SECRET ?? "",
  enabled: process.env.OPENCLAW_ENABLED === "true",
};

export const openclawRuntimeEnv = Object.freeze(openclawEnv);

export function hasOpenClaw(): boolean {
  if (!openclawRuntimeEnv.enabled) {
    return false;
  }

  return Boolean(openclawRuntimeEnv.gatewayUrl);
}

export function resolveOpenClawMode(): "gateway" | "disabled" {
  return hasOpenClaw() ? "gateway" : "disabled";
}

export function getGatewayUrl(): string {
  return openclawRuntimeEnv.gatewayUrl;
}

export function getWebhookUrl(): string {
  return openclawRuntimeEnv.webhookUrl;
}
