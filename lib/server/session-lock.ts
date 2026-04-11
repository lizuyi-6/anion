/**
 * In-memory session lock to prevent concurrent interview turn processing.
 * Prevents TOCTOU race conditions where two requests read the same session
 * state and both write turns with conflicting sequence numbers.
 *
 * For single-container Docker deployment. Multi-replica deployments would
 * need a distributed lock (Redis, etc.).
 */

const locks = new Map<string, { promise: Promise<void>; resolve: () => void }>();

const TIMEOUT_MS = 30_000;

/**
 * Acquire a lock for a session. Returns a release function.
 * If the session is already locked, waits up to TIMEOUT_MS then throws.
 */
export async function acquireSessionLock(sessionId: string): Promise<() => void> {
  const existing = locks.get(sessionId);
  if (existing) {
    // Wait for the existing lock to be released, with timeout
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("会话正在处理中，请稍后重试")),
        TIMEOUT_MS,
      ),
    );
    await Promise.race([existing.promise, timeout]);
  }

  // Create new lock
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  locks.set(sessionId, { promise, resolve });

  return () => {
    locks.delete(sessionId);
    resolve();
  };
}
