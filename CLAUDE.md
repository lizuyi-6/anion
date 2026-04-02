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
pnpm dev                  # Start all 3 services (web + api + worker) concurrently
pnpm dev:web              # Start Next.js frontend only
pnpm dev:api              # Start Fastify API server only
pnpm dev:worker           # Start Trigger.dev worker only
pnpm build                # Type-check + Next.js production build
pnpm lint                 # ESLint
pnpm test                 # Run all tests once (Vitest)
pnpm test:watch           # Vitest in watch mode
pnpm test -- tests/director-engine.test.ts          # Run a single test file
pnpm test -- -t "test name"                         # Run tests matching a name
pnpm test:e2e            # Playwright end-to-end flow test
```

## Monorepo Structure

pnpm workspace with 3 apps and 5 packages:

```
apps/web        @anion/web          Next.js 16 frontend (React 19, Tailwind CSS v4)
apps/api        @anion/api          Fastify 5 API server (all /api/v1/* routes)
apps/worker     @anion/worker       Trigger.dev background jobs
packages/contracts  @anion/contracts    Zod schemas, TypeScript types, role packs (leaf — depends only on zod)
packages/shared      @anion/shared       Utilities, command-artifact builder, visual renderers (leaf — zero deps)
packages/config      @anion/config       Environment config, runtime mode detection, service origins
packages/application @anion/application  Business logic: interview engine, command center, session state, ports
packages/infrastructure @anion/infrastructure  Adapters: AI providers, Supabase store, auth, Trigger.dev jobs
```

**Dependency graph** (bottom-up):

```
contracts + shared (leaf packages)
    ↑
config (→ contracts)
application (→ contracts, shared)
    ↑
infrastructure (→ application, config, contracts, shared)
    ↑
apps/web, apps/api, apps/worker (→ infrastructure layer)
```

### Web-to-API routing

The Next.js app does **not** use Next.js API routes. All `/api/*` requests are proxied via `next.config.ts` rewrites to the Fastify server (`apps/api`). The web app is a pure frontend with `apps/web/lib/` files being thin re-exports from `@anion/*` packages (e.g., `export * from "@anion/contracts"`).

### Dev server ports

Derived from `PORT_BASE` env var (default: 3000): web=`PORT_BASE`, api=`PORT_BASE+1`, worker=`PORT_BASE+2`.

## Architecture

### Runtime Modes

Three independently configurable drivers in `packages/config`:

| Driver | Env auto-detection | Options |
|--------|-------------------|---------|
| **auth** | `SUPABASE_URL` + `SUPABASE_ANON_KEY` → `supabase`; else `local` | `local`, `supabase` |
| **data** | same as auth → `supabase`; else `memory` | `memory`, `supabase` |
| **queue** | `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_ID` → `trigger`; else `inline` | `inline`, `trigger` |
| **ai** | `MINIMAX_API_KEY` → minimax; `ANTHROPIC_API_KEY` → anthropic; `OPENAI_API_KEY` → openai; else `mock` | `mock`, `openai`, `anthropic`, `minimax` |

Any driver can be forced via `AUTH_DRIVER`, `DATA_DRIVER`, `QUEUE_DRIVER`, `AI_DRIVER` env vars.

### Ports & Adapters (packages/application/src/ports.ts)

`application` defines interfaces; `infrastructure` provides implementations:

- `ApplicationStore` = `UploadStore & SessionRepository & TurnRepository & ReportRepository & MemoryRepository & ThreadRepository & IdentityGateway`
- `InterviewAiProvider`, `AnalysisAiProvider`, `CommandAiProvider` — AI provider interfaces
- `JobQueue` — background job enqueue

Two `ApplicationStore` implementations: `MemoryDataStore` (in-process Maps) and `SupabaseDataStore` (PostgreSQL with snake_case↔camelCase mapping). Factory: `getDataStore(options?)`.

### Domain Model (packages/contracts)

Single source of truth — all Zod schemas and TypeScript types. Includes 4 role pack definitions (Engineering, Product, Operations, Management), each with 3 interviewers (founder appears in all).

### Interview Engine (3 layers in packages/application)

1. **Signal Analysis** (`interview-director.ts`): Pure keyword/linguistic analysis of candidate answers. Builds director move plans (speaker selection, conflict triggering, open loops).
2. **Interview Service** (`interview.ts`): Turn processing loop — interrupt assessment, signal analysis, director planning, AI generation. Manages pressure score (0-100) and conflict budget.
3. **AI Generation** (`infrastructure/ai/adapter.ts`): Receives full director context, returns structured `LiveTurnEvent`.

Interview turns use SSE (`text/event-stream`) — the turn API streams 1-2 events (primary + optional conflict).

### Session Lifecycle

```
draft → live → analyzing → report_ready → accepted → hub_active
```

State guards in `packages/application/session-state.ts`.

### Command Center (packages/application/command-center.ts)

Three post-interview modes sharing `ActiveMemoryContext` (memory profile + evidence + embeddings):
- **Copilot** (`/hub/copilot`): Engineering debugging assistant
- **Strategy** (`/hub/strategy`): Feasibility study generator
- **Sandbox** (`/hub/sandbox`): Workplace negotiation simulator

### Report Generation (packages/application/analysis.ts)

`queueInterviewAnalysis()` → Trigger.dev background task or inline `executeInterviewAnalysis()`. Generates diagnostic report + memory profile + vector embeddings per evidence entry.

## Key Conventions

- All AI responses are validated through Zod schemas at the boundary — never use raw AI output directly.
- Path aliases: `@/*` maps to `apps/web/*`; `@anion/*` maps to respective package entry points. Both are configured in `tsconfig.json` and `vitest.config.ts`.
- Tests live in `tests/` at repo root, using `tests/**/*.test.ts` and `tests/**/*.test.tsx` patterns. Use `vi.hoisted()` for mock references and `vi.mock()` for module mocking.
- Tailwind CSS v4 — configuration via `postcss.config.mjs` and `app/globals.css` with CSS custom properties.
- Supabase column naming is snake_case; TypeScript is camelCase. `SupabaseDataStore` handles the mapping.
- `pnpm` is the package manager. All internal package references use `workspace:*` protocol.

## Key Files

| File | Purpose |
|------|---------|
| `packages/contracts/src/index.ts` | All Zod schemas, types, role pack definitions |
| `packages/config/src/index.ts` | Environment config + runtime mode detection + service origins |
| `packages/application/src/ports.ts` | Interface definitions (repositories, AI providers, job queue) |
| `packages/application/src/interview-director.ts` | Signal analysis + director move planning (pure logic) |
| `packages/application/src/interview.ts` | Interview lifecycle (create, generate beat, interrupt) |
| `packages/application/src/analysis.ts` | Report generation + memory profiling + embedding |
| `packages/application/src/command-center.ts` | Command mode orchestration |
| `packages/infrastructure/src/ai/adapter.ts` | AI provider implementations (Anthropic, OpenAI, MiniMax, Mock) |
| `packages/infrastructure/src/server/store/repository.ts` | DataStore implementations (Memory + Supabase) |
| `apps/api/src/server.ts` | Fastify API server — all `/api/v1/*` routes |
| `apps/web/next.config.ts` | API proxy rewrites + transpile config |
| `apps/web/lib/*` | Re-exports from `@anion/*` packages |
