# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This is Next.js 16 — APIs, conventions, and file structure differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Route params are resolved Promises. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project

"莫比乌斯计划" (Mobius Project) — an AI-powered interview simulation and career preparation platform. Chinese-first: all UI text, AI prompts, and user-facing copy are in Chinese. Code comments are mixed Chinese/English. **Next.js 16.2.1 / React 19.2.4** — APIs and conventions may differ from training data.

## Commands

```bash
pnpm dev                  # Start dev server
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm test                 # Run all tests once (Vitest)
pnpm test:watch           # Vitest in watch mode
pnpm test -- tests/director-engine.test.ts          # Run a single test file
pnpm test -- -t "test name"                         # Run tests matching a name
pnpm playwright:install   # Install Playwright browsers (required once)
pnpm playwright:flow      # Run end-to-end browser flow (headless)
pnpm playwright:flow:headed  # Run end-to-end browser flow (visible browser)
```

## Architecture

### Runtime Modes

The app has two modes controlled by `SUPABASE_URL` + `SUPABASE_ANON_KEY` env vars (resolved in `lib/env.ts`):

- **demo** (default): SQLite store (`SqliteDataStore`) or in-memory store (`MemoryDataStore`), no AI when no keys configured (throws error), no auth needed. Viewer is always `demo-user`.
- **supabase**: PostgreSQL via Supabase, real auth. Trigger.dev optional for background analysis (falls back to inline execution).

### AI Provider (`lib/ai/adapter.ts`)

`AiProviderAdapter` interface with methods for structured output generation. Two implementations selected by priority: **Anthropic → OpenAI** (throws error if neither configured).

- **Anthropic**: Uses `@anthropic-ai/sdk`. Two modes: **native** (direct API with `messages.parse()` + `zodOutputFormat()` for structured output) and **gateway** (when `ANTHROPIC_BASE_URL` is set, uses `messages.create()` with manual `extractStructuredJson()` from text responses — handles fenced JSON, balanced bracket parsing).
- **OpenAI**: Uses `client.chat.completions.create()` with manual JSON extraction (`extractJson()`) and Zod `safeParse()`. Includes intelligent field name mapping (`mapFieldsToSchema()`) as a fallback for unexpected AI output keys.

Priority resolved in `lib/env.ts` via `resolveAiProvider()`. If `ANTHROPIC_API_KEY` is set, Anthropic wins regardless of OpenAI config. Default models: `claude-sonnet-4-20250514` (Anthropic), `gpt-5.2` (OpenAI).

### Data Layer (`lib/server/store/repository.ts`)

`DataStore` interface with 25+ methods. Three implementations:
- **SqliteDataStore** (`lib/server/store/sqlite.ts`): Default demo store, backed by `better-sqlite3`. DB path via `SQLITE_PATH` (default `data/mobius.db`).
- **MemoryDataStore**: In-process Maps, used as fallback.
- **SupabaseDataStore**: PostgreSQL via Supabase, handles snake_case↔camelCase mapping.

Factory: `getDataStore(options?)`. Admin variant bypasses RLS (used by Trigger.dev tasks).

### Domain Model (`lib/domain.ts`)

Single source of truth — all Zod schemas and TypeScript types. Includes 4 role pack definitions (Engineering, Product, Operations, Management), each with 3 interviewers (founder appears in all). `Viewer` type includes `workspaceMode` (`"interview"` | `"command_center"`) controlling post-interview UI.

### Interview Engine (3 layers)

1. **Signal Analysis** (`lib/server/services/interview-director.ts`): Pure keyword/linguistic analysis of candidate answers. Builds director move plans (speaker selection, conflict triggering, open loops).
2. **Interview Service** (`lib/server/services/interview.ts`): Turn processing loop — interrupt assessment, signal analysis, director planning, AI generation. Manages pressure score (0-100) and conflict budget.
3. **AI Generation** (`lib/ai/adapter.ts`): Receives full director context, returns structured `LiveTurnEvent`.

Interview turns use SSE (`text/event-stream`) — the turn API streams 1-2 events (primary + optional conflict).

### Unified Chat API (`app/api/chat/route.ts`)

Single entry point for all command modes. Accepts a `ChatRequest` with optional `mode: "auto"`, which triggers `inferModeFromContent()` to auto-detect copilot/strategy/sandbox from the message text. Returns the command artifact, thread history, and detected mode.

### Session Lifecycle

```
draft → live → analyzing → report_ready → accepted → hub_active
                        ↘ analysis_failed ↗
```

State guards in `lib/server/services/session-state.ts` (`canAcceptOffer`, `canActivateCommandCenter`, `isAnalysisRetryable`).

### Middleware (`middleware.ts`)

Active only in supabase mode. Implements in-memory sliding-window rate limiting (IP-based) for sensitive endpoints via `lib/server/rate-limit.ts`. Rate limits: login 10/min, register 5/min, chat 30/min, interview turns 20/min. Returns 429 with `Retry-After` header when exceeded. Demo mode bypasses middleware entirely.

Auth is per-route via `getViewer()`/`requireViewer()` in `lib/server/auth.ts`.

### Auth (`lib/server/auth.ts`)

In demo mode, always returns `demo-user`. In supabase mode, reads the `sb-host-auth-token` cookie, base64-decodes the session JSON to extract the access token, then validates the JWT signature server-side via `admin.auth.getUser(accessToken)` to prevent forgery (uses service role key). Upserts the user profile via admin client. Sign-in page supports email/password, Magic Link, Google, and GitHub OAuth. Password login uses a dedicated API route (`app/api/auth/login/route.ts`) that bypasses `@supabase/ssr` entirely — it calls `signInWithPassword` via raw `supabase-js`, manually builds the session cookie (with `httpOnly` + `secure` flags), and returns a 303 redirect. Role pack read from `mobius-role-pack` cookie, defaults to `"engineering"`.

**Important**: `createSupabaseServerClient()` (`lib/server/supabase.ts`) has `setAll` as a no-op to prevent server components from clearing the session cookie during failed token refreshes.

### Command Center (`lib/server/services/command-center.ts`)

Three post-interview modes sharing `ActiveMemoryContext` (memory profile + evidence + embeddings):
- **Copilot**: Engineering debugging assistant
- **Strategy**: Feasibility study generator (uses web search when available)
- **Sandbox**: Workplace negotiation simulator with turn-by-turn interaction

If OpenClaw is enabled, command modes route through OpenClaw first, falling back to the built-in AI adapter.

### Report Generation (`lib/server/services/analysis.ts`)

`queueInterviewAnalysis()` → either Trigger.dev background task or inline `executeInterviewAnalysis()`. Generates diagnostic report + memory profile + vector embeddings per evidence entry.

### OpenClaw Integration (`lib/openclaw/`)

Optional AI companion backend, deployed as Docker sidecar. Controlled by `OPENCLAW_ENABLED=true` + `OPENCLAW_GATEWAY_URL`.
- **client.ts**: WebSocket client to OpenClaw gateway
- **bridge.ts**: Converts `ActiveMemoryContext` to OpenClaw memory state (one-way sync)
- **skills/**: Skill definitions registered with OpenClaw
- **cron.ts**: Scheduled tasks (daily reminders, skill reviews, gap alerts)
- Gracefully degrades: if OpenClaw is unreachable, falls back to built-in AI adapter

### Ark Proxy (`services/ark-proxy/`)

Standalone HTTP proxy (port 18792) that converts OpenAI-format `/v1/chat/completions` requests to Volcengine/ByteDance ARK API format. Injects JSON schema examples into system prompts for structured output. Env vars: `ARK_API_KEY`, `ARK_BASE_URL`, `ARK_MODEL`.

### Docker Deployment

Four compose files using overlay pattern (`-f base -f overlay`):
- **`docker-compose.yml`**: Full stack — mobius + ark-proxy + openclaw
- **`docker-compose.standalone.yml`**: Standalone/offline variant with local OpenClaw image
- **`docker-compose.dev.yml`**: Dev overlay — mounts source, runs `pnpm dev`, disables OpenClaw
- **`docker-compose.test.yml`**: E2e test overlay — remaps port 3001, disables OpenClaw

### Error Handling (`lib/server/route-errors.ts`)

Unified `handleError()` for API routes. Maps `AiProviderFailure` → 502/503, `ZodError` → 400, unknown → 500. All error messages are in Chinese.

### Startup & Shutdown (`app/instrumentation.ts`)

Runs on Node.js runtime only. At startup: calls `validateEnv()` (warns about missing keys, non-HTTPS Supabase URLs, insecure OpenClaw config), registers OpenClaw skills if enabled, and sets up SIGTERM/SIGINT handlers for graceful shutdown (closes SQLite connections).

### Notifications

`DataStore` includes notification CRUD methods (`createNotification`, `listNotifications`, `markNotificationRead`). Types defined in `lib/server/services/notifications`. `NotificationBell` component in the UI shows unread count.

## Test Conventions

- **Framework**: Vitest with jsdom. Setup file `vitest.setup.ts` imports `@testing-library/jest-dom/vitest`.
- **Glob patterns**: `tests/**/*.test.ts` (logic), `tests/**/*.test.tsx` (components).
- **Mocking pattern**: Always use `vi.hoisted()` to create mock references, then `vi.mock()` for module stubs. Clean up with `vi.resetModules()` + dynamic `await import(...)` when testing module instantiation with different env configs.
- **Env mocking**: `vi.stubEnv()` for env vars, `vi.unstubAllEnvs()` in `beforeEach` cleanup.
- **Route handler testing**: Import route handlers directly, construct `new Request(...)`, call `POST(request, { params: Promise.resolve({ ... }) })`. Route params must be a **resolved Promise** (Next.js 15+ convention).
- **Component testing**: `@testing-library/react` `render()`. Mock `next/link` and local components with `vi.mock()`.
- **Fixtures**: Constructed inline — no shared test utilities file.
- **Test data**: Input strings in Chinese, matching the app's Chinese-first stance.

## Key Conventions

- All AI responses are validated through Zod schemas at the boundary — never use raw AI output directly. Relaxed schemas (without `.min()` constraints) are used for AI parsing, then filled with fallbacks before final validation.
- Path alias: `@/*` maps to project root.
- Tailwind CSS v4 — styling uses `@tailwindcss/postcss` with utility classes.
- Supabase column naming is snake_case; TypeScript is camelCase. `SupabaseDataStore` handles the mapping.
- `pnpm` is the package manager.
- Build uses `output: "standalone"` for Docker compatibility. Security headers (X-Frame-Options, HSTS, etc.) set globally in `next.config.ts`. Server-external packages: `openai`, `@anthropic-ai/sdk`, `ws`.
- Notable versions: Zod v4, React 19.2.4, Vitest v4, Next.js 16.2.1.

## Key Files

| File | Purpose |
|------|---------|
| `lib/domain.ts` | All Zod schemas, types, role pack definitions, label formatters |
| `lib/env.ts` | Environment config + runtime mode + AI provider detection |
| `lib/ai/adapter.ts` | AI provider interface + Anthropic/OpenAI implementations |
| `lib/ai/errors.ts` | AI error types + provider failure classification |
| `lib/server/auth.ts` | Auth — server-side JWT validation + demo-user fallback |
| `app/api/auth/login/route.ts` | Password login endpoint (bypasses @supabase/ssr) |
| `app/api/auth/register/route.ts` | Registration endpoint |
| `lib/server/store/repository.ts` | DataStore interface + factory |
| `lib/server/store/sqlite.ts` | SQLite implementation (default demo store) |
| `lib/server/services/interview-director.ts` | Signal analysis + director move planning (pure logic) |
| `lib/server/services/interview.ts` | Interview lifecycle (create, generate beat, interrupt) |
| `lib/server/services/analysis.ts` | Report generation + memory profiling + embedding |
| `lib/server/services/command-center.ts` | Command mode orchestration + OpenClaw routing |
| `lib/server/route-errors.ts` | Unified API error handling |
| `lib/openclaw/client.ts` | OpenClaw WebSocket client |
| `lib/openclaw/bridge.ts` | Memory context → OpenClaw state conversion |
| `lib/command-artifacts.ts` | Command input builder + Markdown artifact exporter |
| `services/ark-proxy/index.ts` | OpenAI→ARK API proxy for Volcengine deployments |
