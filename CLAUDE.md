# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project

"莫比乌斯计划" (Mobius Project) — an AI-powered interview simulation and career preparation platform. Chinese-first: all UI text, AI prompts, and user-facing copy are in Chinese. Code comments are mixed Chinese/English.

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
pnpm playwright:flow      # Run end-to-end browser flow
```

## Architecture

### Runtime Modes

The app has two modes controlled by `SUPABASE_URL` + `SUPABASE_ANON_KEY` env vars (resolved in `lib/env.ts`):

- **demo** (default): SQLite store (`SqliteDataStore`) or in-memory store (`MemoryDataStore`), mock AI when no keys configured, no auth needed. Viewer is always `demo-user`.
- **supabase**: PostgreSQL via Supabase, real auth. Trigger.dev optional for background analysis (falls back to inline execution).

### AI Provider (`lib/ai/adapter.ts`)

`AiProviderAdapter` interface with methods for structured output generation. Three implementations selected by priority: **Anthropic → OpenAI → Mock**.

- **Anthropic**: Uses `@anthropic-ai/sdk` with `zodOutputFormat()` for structured output against Zod schemas.
- **OpenAI**: Uses `client.responses.parse()` with `zodTextFormat()` for structured output.
- **Mock**: Returns canned responses for demo mode.

Priority resolved in `lib/env.ts` via `resolveAiProvider()`. If `ANTHROPIC_API_KEY` is set, Anthropic wins regardless of OpenAI config.

### Data Layer (`lib/server/store/repository.ts`)

`DataStore` interface with 25+ methods. Three implementations:
- **SqliteDataStore** (`lib/server/store/sqlite.ts`): Default demo store, backed by `better-sqlite3`. DB path via `SQLITE_PATH` (default `data/mobius.db`).
- **MemoryDataStore**: In-process Maps, used as fallback.
- **SupabaseDataStore**: PostgreSQL via Supabase, handles snake_case↔camelCase mapping.

Factory: `getDataStore(options?)`. Admin variant bypasses RLS (used by Trigger.dev tasks).

### Domain Model (`lib/domain.ts`)

Single source of truth — all Zod schemas and TypeScript types. Includes 4 role pack definitions (Engineering, Product, Operations, Management), each with 3 interviewers (founder appears in all).

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

State guards in `lib/server/services/session-state.ts` (`canAcceptOffer`, `canActivateCommandCenter`, `isAnalysisRetryable`). No middleware — auth is per-route via `getViewer()`/`requireViewer()` in `lib/server/auth.ts`.

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

### Error Handling (`lib/server/route-errors.ts`)

Unified `handleError()` for API routes. Maps `AiProviderFailure` → 502/503, `ZodError` → 400, unknown → 500. All error messages are in Chinese.

## Key Conventions

- All AI responses are validated through Zod schemas at the boundary — never use raw AI output directly. Relaxed schemas (without `.min()` constraints) are used for AI parsing, then filled with fallbacks before final validation.
- Path alias: `@/*` maps to project root.
- Tests use `tests/**/*.test.ts` and `tests/**/*.test.tsx` pattern. Use `vi.hoisted()` for mock references and `vi.mock()` for module mocking.
- Tailwind CSS v4 — styling uses `@tailwindcss/postcss` with utility classes.
- Supabase column naming is snake_case; TypeScript is camelCase. `SupabaseDataStore` handles the mapping.
- `pnpm` is the package manager.

## Key Files

| File | Purpose |
|------|---------|
| `lib/domain.ts` | All Zod schemas, types, role pack definitions, label formatters |
| `lib/env.ts` | Environment config + runtime mode + AI provider detection |
| `lib/ai/adapter.ts` | AI provider interface + Anthropic/OpenAI/Mock implementations |
| `lib/ai/errors.ts` | AI error types + provider failure classification |
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
