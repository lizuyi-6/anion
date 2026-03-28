# 莫比乌斯计划 / anion

中文优先的 AI 面试模拟与职场指挥中心应用。它先把你放进高压、非线性的面试沙盒里做能力诊断，再把同一份记忆画像和证据图谱带入后续的工程 Copilot、策略研究与职场博弈工作台。

Anion is a Chinese-first interview simulation and command-center app built with Next.js 16, React 19, and TypeScript.
It starts as a high-pressure interview sandbox, then transitions into a personal command center powered by the same report and memory graph.
The project supports two runtime modes: `demo` with in-memory storage and mock AI, and `supabase` with real auth and persistence.
AI providers currently resolve in this order: Anthropic, OpenAI, then mock fallback.
The stack includes Zod-validated AI boundaries, Supabase, Trigger.dev, and Vitest.

## 项目简介

莫比乌斯计划不是普通的问答式面试练习器。

它把“面试”定义成一场高压对弈：系统会根据候选人的回答做信号分析、选择下一位发问者、触发冲突追问，并在会话结束后生成诊断报告、记忆画像和可复用的证据条目。用户确认报告后，可以把这份能力图谱带入三个后续工作台，让系统从“找漏洞”切换到“补短板并赢下下一场战役”。

项目面向三类读者：

- 想快速理解产品定位和体验路径的访问者
- 想在本地启动项目并接入真实后端的开发者
- 想查看核心模块划分和运行方式的协作者

## 功能地图

### A. 面试模拟

- 创建会话：配置目标公司、岗位级别、角色包、JD 和候选人材料
- 对话推进：根据回答信号动态决定追问、打断和冲突升级
- 终局分析：生成诊断报告、记忆画像和可向量化的证据条目
- 接受录用：把单次面试结果转入后续工作台，形成长期上下文

### B. 指挥中心

- `Copilot`：结合你的短板与历史证据，直接输出根因、最短修复路径和注意事项
- `Strategy`：围绕目标问题生成结构化可行性研究与交付物草案
- `Sandbox`：模拟谈判或职场对抗，输出对手回合、策略点评和施压等级

这三个工作台共享同一份 `ActiveMemoryContext`，因此系统能持续利用面试阶段沉淀下来的技能、弱点、行为倾向和高光片段。

## 运行模式

项目运行模式由环境变量自动决定，核心判断逻辑在 `lib/env.ts`。

### `demo`

- 默认模式
- 未配置 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 时启用
- 数据存储走内存实现
- 未配置模型密钥时回退到 mock AI
- 不依赖真实登录，系统会返回 demo viewer

### `supabase`

- 配置 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` 后启用
- 使用真实认证、持久化存储和文件上传
- 可选接入 Trigger.dev 进行后台分析
- 如果启用了 Supabase 但用户未登录，受保护页面会跳转到 `/auth/sign-in`

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备环境变量

把 `.env.example` 复制为 `.env.local`，再按你希望的运行方式填写配置。

如果你只是想跑通本地界面和流程，可以先不配后端，直接以 `demo` 模式启动。

### 3. 启动开发环境

```bash
pnpm dev
```

默认访问地址是 [http://localhost:3000](http://localhost:3000)。

- 在 `demo` 模式下，可以直接进入主应用流程
- 在 `supabase` 模式下，未登录访问受保护页面会跳转到 `/auth/sign-in`
- 品牌展示页位于 `/landing`

### 4. 常用命令

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

如需本地跑浏览器流测试，还可以使用：

```bash
pnpm playwright:install
pnpm playwright:flow
pnpm playwright:flow:headed
```

## 环境变量

以下变量来自 `.env.example`，README 只记录仓库中已经存在的配置项。

| 变量 | 用途 |
|------|------|
| `APP_URL` | 应用访问地址，默认是 `http://localhost:3000` |
| `OPENAI_API_KEY` | OpenAI API Key |
| `OPENAI_MODEL` | OpenAI 主模型，默认 `gpt-5.2` |
| `OPENAI_EMBEDDING_MODEL` | OpenAI embedding 模型，默认 `text-embedding-3-small` |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `ANTHROPIC_MODEL` | Anthropic 模型，默认 `claude-sonnet-4-20250514` |
| `ANTHROPIC_BASE_URL` | 仅在使用 Anthropic-compatible gateway 时填写，官方直连时保持为空 |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | Supabase 匿名客户端 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理员能力所需的服务端 Key，用于后台分析等需要绕过 RLS 的场景 |
| `SUPABASE_STORAGE_BUCKET` | 文件上传桶名，默认 `session-artifacts` |
| `TRIGGER_SECRET_KEY` | Trigger.dev Secret，仅后台任务模式需要 |
| `TRIGGER_PROJECT_ID` | Trigger.dev Project ID，仅后台任务模式需要 |

### AI provider 选择规则

- 优先级固定为 `ANTHROPIC_API_KEY` -> `OPENAI_API_KEY` -> `mock`
- 同时配置 Anthropic 和 OpenAI 时，优先走 Anthropic
- `ANTHROPIC_BASE_URL` 只服务于兼容网关，不用于 Anthropic 官方直连
- embeddings 由 `OPENAI_EMBEDDING_MODEL` 控制

## 关键路由与典型流程

### 页面路由

- `/landing`
  - 品牌化落地页，展示项目主叙事和模块结构
- `/`
  - 主工作区首页，展示最近会话和各模块入口
- `/simulator/new`
  - 创建新面试会话
- `/simulator/[sessionId]`
  - 进行流式面试对话
- `/report/[sessionId]`
  - 查看诊断报告、记忆画像和分析状态
- `/hub/copilot`
  - 工程与架构副驾
- `/hub/strategy`
  - 可行性与战略生成工作台
- `/hub/sandbox`
  - 职场博弈沙盘
- `/auth/sign-in`
  - Supabase 模式下的登录入口

### 典型用户流程

1. 在 `/simulator/new` 创建一场新会话
2. 进入 `/simulator/[sessionId]` 完成多轮面试与追问
3. 系统生成分析任务，并在 `/report/[sessionId]` 聚合结果
4. 报告确认后，把记忆上下文带入 `/hub/*` 的三个工作台继续使用

## 架构摘要

### 双运行模式与数据存储

项目通过 `DataStore` 抽象隔离存储层，当前有两种实现：

- `MemoryDataStore`：用于 `demo` 模式，适合本地体验和无后端启动
- `SupabaseDataStore`：用于 `supabase` 模式，对接 PostgreSQL、认证和持久化资源

这让 UI 和业务流程可以在不更换页面结构的前提下，切换本地体验与真实后端。

### AI provider 适配层

AI 能力统一经过适配层封装，当前包含：

- 面试回合生成
- 诊断报告生成
- 记忆画像生成
- Command Center 产物生成
- embeddings 生成

所有 AI 返回值都在边界层经过 Zod 校验，不直接把原始模型输出暴露给业务逻辑。

### 领域模型与 Zod 校验

`lib/domain.ts` 是单一领域模型来源，维护核心 schema、TypeScript 类型、角色包定义与格式化逻辑。这样可以把页面、服务层、AI 适配层和存储层绑定在同一套结构化类型之上，减少“提示词输出”和“业务消费”之间的松散耦合。

### 面试引擎与报告生成

面试流程大致分三层：

- 信号分析与导演策略：判断回答特征、选发问者、规划冲突
- 会话推进：处理回合状态、压力分数、打断和 SSE 输出
- AI 生成：根据导演上下文生成结构化回合事件

会话结束后，系统进入分析阶段，生成：

- 诊断报告
- 记忆画像
- 证据条目与可选 embeddings

如果配置了 Trigger.dev 且具备管理员能力，分析可在后台任务中完成；否则回退为进程内执行。

### Command Center 三模式

Command Center 由三个模式组成：

- `copilot`：偏工程排错与修复路径
- `strategy`：偏可行性研究与结构化交付
- `sandbox`：偏谈判模拟与策略博弈

它们共享历史消息、线程和活动记忆上下文，因此更像是在同一张长期画像上切换不同工作模式，而不是三个相互独立的小工具。

## 测试与开发校验

项目当前使用 Vitest，测试覆盖点包括：

- director engine 与打断规则
- runtime mode 与数据存储
- AI adapter 与 API 路由
- 会话状态机
- 视觉组件与表单行为
- 端到端主流程

常用测试命令：

```bash
pnpm test
pnpm test:watch
```

单测文件命名遵循 `tests/**/*.test.ts` 和 `tests/**/*.test.tsx`。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Zod
- OpenAI Responses API
- Anthropic Messages API
- Supabase
- Trigger.dev
- Vitest

## License

本仓库核心代码按 `MIT OR Apache-2.0` 双许可证发布，你可以任选其一使用。

详细条款见根目录的 `LICENSE`、`LICENSE-MIT` 和 `LICENSE-APACHE`。
