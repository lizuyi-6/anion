# 莫比乌斯计划

这是一个单仓库的 Next.js Web 应用，包含以下能力：

- 面试模拟器
- 终局报告、记忆重构和“接受录用”转场能力
- 指挥中心模式：工程副驾、战略工作台和职场博弈沙盒

## 技术栈

- Next.js 16 App Router + TypeScript
- React 19
- Zod Schema，用于定义所有 AI 相关接口契约
- OpenAI Responses API（未配置 `OPENAI_API_KEY` 时使用模拟数据）
- Supabase Auth / Postgres / Storage（提供演示模式备用）
- Trigger.dev 任务框架，用于异步面试分析
- Vitest 单元测试

## 运行模式

- `demo`：当 Supabase 环境未配置时的默认模式，使用内存存储和模拟 AI 输出。
- `supabase`：当 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 存在时启用，使用真实认证、持久化存储和私有文件存储。

Trigger.dev 为可选配置。当配置了 `TRIGGER_SECRET_KEY` 和 `TRIGGER_PROJECT_ID` 时，面试分析会作为后台任务排队执行。否则会回退到内联执行模式，确保本地开发仍然可用。

## 本地运行

```bash
pnpm install
pnpm dev
```

如果需要真实模型调用或启用 Supabase 模式，请将 `.env.example` 复制为 `.env.local` 并补齐配置。

## 核心路由

- `/simulator/new`
- `/simulator/[sessionId]`
- `/report/[sessionId]`
- `/hub/copilot`
- `/hub/strategy`
- `/hub/sandbox`
- `/auth/sign-in`

## 常用命令

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

## 备注

- `supabase/migrations/0001_mobius.sql` 包含基础数据库结构和 RLS 配置。
- `supabase/migrations/0002_phase2_runtime.sql` 新增分析状态字段和私有 `session-artifacts` 存储桶策略。
- `trigger/interview-analysis.ts` 是在启用 Trigger.dev 的 Supabase 模式下使用的后台分析任务。
