# Mobius

这是一个基于 Next.js 16 App Router 的面试模拟与指挥中心应用，包含：

- 面试模拟器
- 终局报告与记忆画像
- 指挥中心模式：工程 Copilot、策略研究、职场博弈沙盘

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Zod
- OpenAI Responses API
- Anthropic Messages API
- Supabase
- Trigger.dev
- Vitest

## 运行模式

- `demo`
  - 未配置 Supabase 时启用
  - 使用内存存储
  - 未配置模型密钥时使用 mock AI
- `supabase`
  - 配置 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 后启用
  - 使用真实认证、持久化存储和文件上传

## 本地运行

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

## AI provider 配置

- provider 优先级为 `ANTHROPIC_API_KEY` -> `OPENAI_API_KEY` -> mock。
- 直连 Anthropic 时，只设置 `ANTHROPIC_API_KEY`，并保持 `ANTHROPIC_BASE_URL` 为空。
- `ANTHROPIC_BASE_URL` 仅用于 Anthropic-compatible gateway，不用于官方直连。
- OpenAI embeddings 使用 `OPENAI_EMBEDDING_MODEL`。

把 `.env.example` 复制为 `.env.local` 后填写需要的配置。

## 核心路由

- `/simulator/new`
- `/simulator/[sessionId]`
- `/report/[sessionId]`
- `/hub/copilot`
- `/hub/strategy`
- `/hub/sandbox`
- `/auth/sign-in`

## 备注

- `supabase/migrations/0001_mobius.sql` 包含基础表结构和 RLS。
- `supabase/migrations/0002_phase2_runtime.sql` 增加分析状态和 `session-artifacts` 存储策略。
- `trigger/interview-analysis.ts` 是启用 Trigger.dev 时的后台分析任务。
