import type { Viewer } from "@/lib/domain";

const SESSION_PREFIX = "mobius";

export function toOpenClawSessionId(viewerId: string): string {
  return `${SESSION_PREFIX}:${viewerId}`;
}

export function fromOpenClawSessionId(ocSessionId: string): string | null {
  if (!ocSessionId.startsWith(`${SESSION_PREFIX}:`)) {
    return null;
  }
  return ocSessionId.slice(SESSION_PREFIX.length + 1);
}

export function buildOpenClawSessionToken(viewer: Viewer): string {
  const payload = JSON.stringify({
    sessionId: toOpenClawSessionId(viewer.id),
    displayName: viewer.displayName,
    isDemo: viewer.isDemo,
  });
  return Buffer.from(payload).toString("base64url");
}
