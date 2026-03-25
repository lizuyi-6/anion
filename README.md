# Project Mobius

单仓库 Next.js Web 应用，包含以下功能：

- 面试模拟器（The Interview Simulator）
- 诊断报告、记忆重构和"接受Offer"转换功能
- 命令中心模式：Engineering Copilot、Strategy Hub 和 Game Theory Sandbox

## 技术栈

- Next.js 16 App Router + TypeScript
- React 19
- Zod schema 用于定义所有 AI 相关的接口契约
- OpenAI Responses API（当未设置 `OPENAI_API_KEY` 时使用模拟数据）
- Supabase Auth/Postgres/Storage（提供演示模式备用）
- Trigger.dev 任务框架，用于异步面试分析
- Vitest 单元测试覆盖

## 运行时模式

- `demo`：当 Supabase 环境未配置时的默认模式。使用内存存储和模拟 AI 输出。
- `supabase`：当 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 存在时启用。使用真实的认证、持久化存储和私有存储。

Trigger.dev 为可选配置。当配置了 `TRIGGER_SECRET_KEY` 和 `TRIGGER_PROJECT_ID` 时，面试分析会被作为后台任务排队执行。否则会回退到内联执行模式，确保本地开发仍能正常工作。

## 本地运行

```bash
pnpm install
pnpm dev
```

如果需要进行真实的模型调用或使用 Supabase 模式，请将 `.env.example` 复制为 `.env.local`。

## 核心路由

- `/simulator/new`
- `/simulator/[sessionId]`
- `/report/[sessionId]`
- `/hub/copilot`
- `/hub/strategy`
- `/hub/sandbox`
- `/auth/sign-in`

## 命令

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

## 备注

- `supabase/migrations/0001_mobius.sql` 包含基础数据库结构和 RLS（行级安全策略）配置。
- `supabase/migrations/0002_phase2_runtime.sql` 添加了分析状态字段和私有 `session-artifacts` 存储桶策略。
- `trigger/interview-analysis.ts` 是在配置了 Trigger.dev 的 Supabase 模式下使用的后台分析任务。
