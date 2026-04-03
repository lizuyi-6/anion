import { pathToFileURL } from "node:url";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import {
  canAcceptOffer,
  canActivateCommandCenter,
  createInterviewSession,
  generateNextInterviewBeat,
  generateSandboxBeat,
  getReportStatus,
  getSessionDiagnostics,
  queueInterviewAnalysis,
  retryInterviewAnalysis,
  runCommandMode,
} from "@anion/application";
import { runtimeEnv, resolveAiProvider } from "@anion/config";
import {
  CommandRequestSchema,
  SandboxTurnRequestSchema,
  TurnRequestSchema,
  commandModes,
  CompleteSessionInputSchema,
  CreateSessionInputSchema,
} from "@anion/contracts";
import {
  AiProviderFailure,
  beginGoogleSignIn,
  beginMagicLinkSignIn,
  buildLocalViewer,
  createJobQueue,
  exchangeAuthCode,
  getAiErrorPayload,
  getAiProvider,
  getDataStore,
  resolveSupabaseViewer,
  revokeAuthSession,
} from "@anion/infrastructure";
import { encodeSseEvent } from "@anion/shared/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

function jsonError(message: string, error = "internal_server_error") {
  return {
    error,
    message,
  };
}

function isAllowedFile(file: File) {
  return (
    ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number]) ||
    /\.(txt|csv|md|json|log|pdf|doc|docx)$/i.test(file.name)
  );
}

async function toFile(part: AsyncIterable<Buffer> & { filename?: string; mimetype?: string }) {
  const chunks: Buffer[] = [];
  for await (const chunk of part) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  return new File([buffer], part.filename ?? "upload.bin", {
    type: part.mimetype ?? "application/octet-stream",
  });
}

function setAuthCookies(
  reply: FastifyReply,
  accessToken?: string | null,
  refreshToken?: string | null,
) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: runtimeEnv.publicOrigin.startsWith("https://"),
  };

  if (accessToken) {
    reply.setCookie(runtimeEnv.authAccessCookie, accessToken, cookieOptions);
  }

  if (refreshToken) {
    reply.setCookie(runtimeEnv.authRefreshCookie, refreshToken, cookieOptions);
  }
}

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(runtimeEnv.authAccessCookie, { path: "/" });
  reply.clearCookie(runtimeEnv.authRefreshCookie, { path: "/" });
}

async function resolveViewerContext(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const preferredRolePack = request.cookies["mobius-role-pack"] ?? null;

  if (runtimeEnv.authDriver === "local") {
    return {
      viewer: buildLocalViewer(),
      accessToken: null,
    };
  }

  const result = await resolveSupabaseViewer({
    accessToken: request.cookies[runtimeEnv.authAccessCookie],
    refreshToken: request.cookies[runtimeEnv.authRefreshCookie],
    preferredRolePack,
  });

  if (result.nextAccessToken || result.nextRefreshToken) {
    setAuthCookies(reply, result.nextAccessToken, result.nextRefreshToken);
  }

  return {
    viewer: result.viewer,
    accessToken: result.nextAccessToken,
  };
}

type ViewerContext = Awaited<ReturnType<typeof resolveViewerContext>>;
type AuthenticatedViewerContext = {
  viewer: NonNullable<ViewerContext["viewer"]>;
  accessToken: ViewerContext["accessToken"];
};

async function requireViewer(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthenticatedViewerContext | null> {
  const context = await resolveViewerContext(request, reply);
  if (!context.viewer) {
    reply.status(401).send(jsonError("Unauthorized", "unauthorized"));
    return null;
  }

  return {
    viewer: context.viewer,
    accessToken: context.accessToken,
  };
}

function sendAiError(
  reply: FastifyReply,
  error: unknown,
) {
  const payload = getAiErrorPayload(error, resolveAiProvider());
  reply.status(payload.retryable ? 503 : 502).send(payload);
}

function sendUnexpectedError(
  reply: FastifyReply,
  error: unknown,
) {
  console.error("Unexpected API error:", error);
  reply.status(500).send(jsonError("Internal server error"));
}

export function buildApiServer() {
  const app = Fastify({
    logger: true,
  });

  app.register(cookie);
  app.register(multipart);

  // Global rate limit: 100 requests per minute per IP
  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) => ({
      error: "rate_limit_exceeded",
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  app.get("/api/v1/auth/session", async (request, reply) => {
    const context = await resolveViewerContext(request, reply);
    return { viewer: context.viewer };
  });

  app.post("/api/v1/auth/magic-link", async (request, reply) => {
    try {
      if (runtimeEnv.authDriver === "local") {
        return { ok: true, demo: true };
      }

      const payload = z
        .object({
          email: z.string().email(),
          next: z.string().optional().default("/"),
        })
        .parse(request.body);

      await beginMagicLinkSignIn(payload.email, payload.next);
      return { ok: true };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/auth/google", async (request, reply) => {
    try {
      if (runtimeEnv.authDriver === "local") {
        return { url: "/" };
      }

      const payload = z.object({ next: z.string().optional().default("/") }).parse(request.body);
      const url = await beginGoogleSignIn(payload.next);
      return { url };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/auth/callback", async (request, reply) => {
    const query = z
      .object({
        code: z.string().optional(),
        next: z.string().optional().default("/"),
      })
      .parse(request.query);

    if (runtimeEnv.authDriver === "local" || !query.code) {
      return reply.redirect(query.next);
    }

    try {
      const result = await exchangeAuthCode(query.code);
      setAuthCookies(reply, result.accessToken, result.refreshToken);
      return reply.redirect(query.next);
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/auth/sign-out", async (request, reply) => {
    const next = z.object({ next: z.string().optional().default("/auth/sign-in") }).parse(request.query);
    try {
      await revokeAuthSession(request.cookies[runtimeEnv.authAccessCookie]);
    } catch (error) {
      request.log.warn({ error }, "Failed to revoke auth session");
    }

    clearAuthCookies(reply);
    return reply.redirect(next.next);
  });

  app.get("/api/v1/sessions", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      return await store.listSessions(context.viewer.id);
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/sessions/:sessionId", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await store.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }

      return session;
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/sessions/:sessionId/detail", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await store.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }

      return {
        session,
        turns: await store.listTurns(sessionId),
      };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/sessions/:sessionId/accept", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await store.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }
      if (!canAcceptOffer(session)) {
        return reply.status(409).send(jsonError("Invalid session state", "invalid_state"));
      }

      await store.updateSession(sessionId, {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });

      return { ok: true, nextStatus: "accepted" };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/sessions/:sessionId/hub", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await store.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }
      if (!canActivateCommandCenter(session)) {
        return reply.status(409).send(jsonError("Accept the report before opening the hub", "invalid_state"));
      }

      await store.updateSession(sessionId, {
        status: "hub_active",
      });
      await store.setWorkspaceMode(context.viewer.id, "command_center");
      await store.activateMemoryProfile(sessionId, context.viewer.id);
      return { ok: true, nextStatus: "hub_active" };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/memory/active", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      return {
        memoryContext: await store.getActiveMemoryContext(context.viewer.id),
      };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/reports/:sessionId", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const diagnostics = await getSessionDiagnostics(sessionId, store);
      if (!diagnostics.session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }

      return diagnostics;
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.get("/api/v1/reports/:sessionId/status", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const status = await getReportStatus(sessionId, store);
      if (!status) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }

      return status;
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/reports/:sessionId/retry", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      return await retryInterviewAnalysis({
        sessionId,
        store,
        ai: getAiProvider(),
        jobs: createJobQueue(),
      });
    } catch (error) {
      if (error instanceof AiProviderFailure) {
        return sendAiError(reply, error);
      }
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/interviews", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const config = CreateSessionInputSchema.parse(request.body);
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await createInterviewSession({
        store,
        viewer: context.viewer,
        config,
      });
      return { sessionId: session.id };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  // Stricter rate limit for AI-intensive interview turn route: 20 req/min
  app.post("/api/v1/interviews/:sessionId/turn", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await store.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }

      const payload = TurnRequestSchema.parse(request.body);
      const turns = await store.listTurns(sessionId);
      const result = await generateNextInterviewBeat({
        store,
        ai: getAiProvider(),
        session,
        turns,
        answer: payload.answer,
      });

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      reply.raw.write(
        encodeSseEvent("thinking", {
          sessionId,
          status: "director_analyzing",
          timestamp: new Date().toISOString(),
        }),
      );
      for (const event of result.events) {
        reply.raw.write(encodeSseEvent("turn", event));
      }
      reply.raw.end();
    } catch (error) {
      if (error instanceof AiProviderFailure) {
        return sendAiError(reply, error);
      }
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/interviews/:sessionId/complete", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const { sessionId } = request.params as { sessionId: string };
      CompleteSessionInputSchema.parse(request.body);
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const session = await store.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(jsonError("Session not found", "not_found"));
      }

      return await queueInterviewAnalysis({
        sessionId,
        store,
        ai: getAiProvider(),
        jobs: createJobQueue(),
      });
    } catch (error) {
      if (error instanceof AiProviderFailure) {
        return sendAiError(reply, error);
      }
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/uploads", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const uploads = [];
      const invalidFiles: string[] = [];
      const oversizedFiles: string[] = [];

      for await (const part of request.parts()) {
        if (part.type !== "file") continue;
        const file = await toFile(part.file);
        if (file.size > MAX_FILE_SIZE) {
          oversizedFiles.push(file.name);
          continue;
        }
        if (!isAllowedFile(file)) {
          invalidFiles.push(file.name);
          continue;
        }
        uploads.push(await store.uploadFile(file));
      }

      if (oversizedFiles.length > 0) {
        return reply.status(400).send(jsonError(`Files exceed 10MB: ${oversizedFiles.join(", ")}`, "file_too_large"));
      }
      if (invalidFiles.length > 0) {
        return reply.status(400).send(jsonError(`Unsupported file types: ${invalidFiles.join(", ")}`, "unsupported_file_type"));
      }

      return {
        uploads,
        message: `Uploaded ${uploads.length} file(s)`,
      };
    } catch (error) {
      sendUnexpectedError(reply, error);
    }
  });

  // Stricter rate limit for AI command routes: 20 req/min
  app.post("/api/v1/command/:mode", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
    const { mode } = request.params as { mode: string };
    if (!commandModes.includes(mode as (typeof commandModes)[number])) {
      return reply.status(400).send(jsonError("Unsupported mode", "invalid_mode"));
    }

    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const payload = CommandRequestSchema.parse(request.body);
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const memoryContext = await store.getActiveMemoryContext(context.viewer.id);
      const result = await runCommandMode({
        store,
        ai: getAiProvider(),
        viewer: context.viewer,
        mode: mode as (typeof commandModes)[number],
        threadId: payload.threadId,
        input: payload.input,
        attachments: payload.attachments,
        memoryContext,
      });

      return {
        threadId: result.thread.id,
        artifact: result.artifact,
        history: result.history,
      };
    } catch (error) {
      if (error instanceof AiProviderFailure) {
        return sendAiError(reply, error);
      }
      sendUnexpectedError(reply, error);
    }
  });

  app.post("/api/v1/command/sandbox/turn", async (request, reply) => {
    const context = await requireViewer(request, reply);
    if (!context) return;

    try {
      const payload = SandboxTurnRequestSchema.parse(request.body);
      const store = await getDataStore({
        viewer: context.viewer,
        accessToken: context.accessToken,
      });
      const thread = await store.getThread(payload.threadId);
      if (!thread) {
        return reply.status(404).send(jsonError("Thread not found", "not_found"));
      }

      const memoryContext = await store.getActiveMemoryContext(context.viewer.id);
      const event = await generateSandboxBeat({
        store,
        ai: getAiProvider(),
        viewer: context.viewer,
        threadId: payload.threadId,
        userMessage: payload.userMessage,
        counterpartRole: payload.counterpartRole,
        counterpartIncentives: payload.counterpartIncentives,
        userRedLine: payload.userRedLine,
        memoryContext,
      });

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      reply.raw.write(encodeSseEvent("sandbox-turn", event));
      reply.raw.end();
    } catch (error) {
      if (error instanceof AiProviderFailure) {
        return sendAiError(reply, error);
      }
      sendUnexpectedError(reply, error);
    }
  });

  return app;
}

export async function startApiServer() {
  const app = buildApiServer();
  await app.listen({
    host: "127.0.0.1",
    port: runtimeEnv.apiPort,
  });
  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startApiServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}



