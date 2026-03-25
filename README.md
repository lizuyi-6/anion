# Project Mobius

Single-repo Next.js web app for:

- The Interview Simulator
- Diagnostic report, memory refactoring, and `Accept Offer` transition
- Command Center modes: Engineering Copilot, Strategy Hub, and Game Theory Sandbox

## Stack

- Next.js 16 App Router + TypeScript
- React 19
- Zod schemas for every AI-facing contract
- OpenAI Responses API with mock fallback when `OPENAI_API_KEY` is absent
- Supabase Auth/Postgres/Storage with demo fallback
- Trigger.dev task scaffold for async interview analysis
- Vitest for unit coverage

## Runtime Modes

- `demo`: default when Supabase env is absent. Uses the in-memory store and mock AI output.
- `supabase`: enabled when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present. Uses real auth, persistence, and private storage.

Trigger.dev is optional. When `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_ID` are configured, interview analysis is queued as a background job. Otherwise it falls back to inline execution so local development still works.

## Local Run

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` if you want real model calls or Supabase mode.

## Core Routes

- `/simulator/new`
- `/simulator/[sessionId]`
- `/report/[sessionId]`
- `/hub/copilot`
- `/hub/strategy`
- `/hub/sandbox`
- `/auth/sign-in`

## Commands

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

## Notes

- `supabase/migrations/0001_mobius.sql` contains the base schema and RLS setup.
- `supabase/migrations/0002_phase2_runtime.sql` adds analysis state fields and the private `session-artifacts` storage bucket policies.
- `trigger/interview-analysis.ts` is the background analysis task used in Supabase mode when Trigger.dev is configured.
