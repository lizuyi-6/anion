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
```

## Architecture

### Runtime Modes

The app has two modes controlled by `SUPABASE_URL` + `SUPABASE_ANON_KEY` env vars (resolved in `lib/env.ts`):

- **demo** (default): In-memory store (`MemoryDataStore`), mock AI (`MockAiProvider`), no auth needed. Viewer is always `demo-user`.
- **supabase**: PostgreSQL via Supabase, OpenAI for AI, real auth. Trigger.dev optional for background analysis (falls back to inline execution).

### Data Layer (`lib/server/store/repository.ts`)

`DataStore` interface with 25+ methods. Two implementations: `MemoryDataStore` (in-process Maps) and `SupabaseDataStore` (PostgreSQL). Factory: `getDataStore(options?)`. Admin variant bypasses RLS (used by Trigger.dev tasks).

### AI Adapter (`lib/ai/adapter.ts`)

`AiProviderAdapter` interface with 5 methods (generateInterviewEvent, generateDiagnosticReport, generateMemoryProfile, generateCommandArtifact, generateEmbeddings). Factory: `getAiProvider()`. OpenAI implementation uses `client.responses.parse()` with `zodTextFormat()` for structured output against Zod schemas.

### Domain Model (`lib/domain.ts`)

Single source of truth — all Zod schemas and TypeScript types. Includes 4 role pack definitions (Engineering, Product, Operations, Management), each with 3 interviewers (founder appears in all).

### Interview Engine (3 layers)

1. **Signal Analysis** (`lib/server/services/interview-director.ts`): Pure keyword/linguistic analysis of candidate answers. Builds director move plans (speaker selection, conflict triggering, open loops).
2. **Interview Service** (`lib/server/services/interview.ts`): Turn processing loop — interrupt assessment, signal analysis, director planning, AI generation. Manages pressure score (0-100) and conflict budget.
3. **AI Generation** (`lib/ai/adapter.ts`): Receives full director context, returns structured `LiveTurnEvent`.

Interview turns use SSE (`text/event-stream`) — the turn API streams 1-2 events (primary + optional conflict).

### Session Lifecycle

```
draft → live → analyzing → report_ready → accepted → hub_active
```

State guards in `lib/server/services/session-state.ts`. No middleware — auth is per-route via `getViewer()`/`requireViewer()` in `lib/server/auth.ts`.

### Command Center (`lib/server/services/command-center.ts`)

Three post-interview modes sharing `ActiveMemoryContext` (memory profile + evidence + embeddings):
- **Copilot** (`/hub/copilot`): Engineering debugging assistant
- **Strategy** (`/hub/strategy`): Feasibility study generator (uses OpenAI web_search)
- **Sandbox** (`/hub/sandbox`): Workplace negotiation simulator

### Report Generation (`lib/server/services/analysis.ts`)

`queueInterviewAnalysis()` → either Trigger.dev background task or inline `executeInterviewAnalysis()`. Generates diagnostic report + memory profile + vector embeddings per evidence entry.

## Key Conventions

- All AI responses are validated through Zod schemas at the boundary — never use raw AI output directly.
- Path alias: `@/*` maps to project root.
- Tests use `tests/**/*.test.ts` and `tests/**/*.test.tsx` pattern. Use `vi.hoisted()` for mock references and `vi.mock()` for module mocking.
- No global CSS framework — all styling in `app/globals.css` with CSS custom properties.
- Supabase column naming is snake_case; TypeScript is camelCase. `SupabaseDataStore` handles the mapping.
- `pnpm` is the package manager.

## Key Files

| File | Purpose |
|------|---------|
| `lib/domain.ts` | All Zod schemas, types, role pack definitions, label formatters |
| `lib/env.ts` | Environment config + runtime mode detection |
| `lib/ai/adapter.ts` | AI provider interface + Mock/OpenAI implementations |
| `lib/server/store/repository.ts` | DataStore interface + Memory + Supabase implementations |
| `lib/server/services/interview-director.ts` | Signal analysis + director move planning (pure logic) |
| `lib/server/services/interview.ts` | Interview lifecycle (create, generate beat, interrupt) |
| `lib/server/services/analysis.ts` | Report generation + memory profiling + embedding |
| `lib/server/services/command-center.ts` | Command mode orchestration |
| `lib/command-artifacts.ts` | Command input builder + Markdown artifact exporter |
