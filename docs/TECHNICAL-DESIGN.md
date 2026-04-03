# 莫比乌斯计划 — 技术设计文档

> 版本：0.1.0
> 最后更新：2026-04-02
> 状态：原型阶段

---

## 1. 系统概述

### 1.1 产品定位

莫比乌斯计划（anion）是一个中文优先的 AI 面试模拟与职场指挥中心平台。系统将一次面试拆解为三个连续阶段：高压模拟 → 诊断沉淀 → 指挥中心，使单次面试的结果能够转化为长期可复用的能力画像和工作辅助上下文。

### 1.2 核心设计约束

- **中文优先**：所有 UI 文本、AI prompt、用户可见输出均为中文
- **双模式运行**：`demo`（零配置体验）和 `supabase`（完整后端），通过环境变量自动检测
- **结构化 AI 输出**：AI 不直接"自由聊天"，所有输出经过 Zod schema 边界校验

### 1.3 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | Next.js 16 App Router + React 19 |
| 样式 | Tailwind CSS v4 |
| API 服务器 | Fastify 5 |
| 后台任务 | Trigger.dev v4（可选） |
| AI 提供商 | Anthropic / OpenAI / MiniMax（优先级递减） |
| 数据库 | PostgreSQL（Supabase）+ pgvector |
| 类型校验 | Zod v4 |
| 包管理 | pnpm workspace monorepo |
| 语言 | TypeScript（strict mode） |

---

## 2. 系统架构

### 2.1 Monorepo 结构

```
anion/
├── apps/
│   ├── web/          @anion/web          Next.js 16 前端
│   ├── api/          @anion/api          Fastify 5 API 服务器
│   └── worker/       @anion/worker       Trigger.dev 后台任务
├── packages/
│   ├── contracts/    @anion/contracts    Zod schema 与类型定义
│   ├── shared/       @anion/shared       纯工具函数（零依赖）
│   ├── config/       @anion/config       运行时环境配置
│   ├── application/  @anion/application  业务逻辑与接口定义（ports）
│   └── infrastructure/ @anion/infrastructure  基础设施实现（adapters）
├── tests/                                 测试目录
├── supabase/migrations/                   数据库迁移
└── scripts/                               构建/运行辅助脚本
```

### 2.2 依赖关系

```
┌─────────────────────────────────────────────────────┐
│                     应用层                          │
│  @anion/web    @anion/api    @anion/worker          │
└───────┬────────────┬──────────────┬─────────────────┘
        │            │              │
        └────────────┼──────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│              @anion/infrastructure                  │
│  AI Adapter · Supabase Store · Auth · Trigger Jobs  │
└───────┬─────────────────────────────────────────────┘
        ▼
┌──────────────────────┐  ┌──────────────┐
│ @anion/application   │  │ @anion/config │
│ 业务逻辑 + Ports     │  │ 环境配置      │
└───────┬──────────────┘  └──────┬───────┘
        ▼                        ▼
┌──────────────────┐  ┌──────────────────┐
│ @anion/contracts │  │ @anion/shared    │
│ Schema + Types   │  │ 纯工具函数       │
└──────────────────┘  └──────────────────┘
```

**关键规则**：
- `contracts` 和 `shared` 是叶子包，不依赖任何内部包
- 依赖方向严格单向：上层 → 下层，禁止反向依赖
- `application` 只定义接口（`ports.ts`），不依赖任何基础设施 SDK

### 2.3 请求流转

```
浏览器
  │
  ▼ (HTTP/HTTPS)
Next.js (@anion/web) ──── rewrite /api/* ────► Fastify (@anion/api)
  │                                              │
  │                                              ├── @anion/application（业务逻辑）
  │                                              │       │
  │                                              │       ├── interview-director（信号分析）
  │                                              │       ├── interview（会话推进）
  │                                              │       ├── command-center（指挥中心）
  │                                              │       └── analysis（报告生成）
  │                                              │
  │                                              ├── @anion/infrastructure
  │                                              │       ├── ai/adapter（AI 适配）
  │                                              │       ├── server/store（数据存储）
  │                                              │       └── server/auth（认证）
  │                                              │
  │                                              └── Supabase / OpenAI / Anthropic
  │
  ▼
浏览器渲染
```

### 2.4 开发端口分配

由 `PORT_BASE` 环境变量控制（默认 3000）：

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| web | `PORT_BASE` | `pnpm dev:web` |
| api | `PORT_BASE + 1` | `pnpm dev:api` |
| worker | `PORT_BASE + 2` | `pnpm dev:worker` |

`pnpm dev` 使用 `concurrently` 同时启动三个服务。

---

## 3. 运行时配置

### 3.1 四驱动模型

系统有四个独立的驱动维度，每个都有自动检测和手动覆盖：

| 驱动 | 自动检测条件 | 手动覆盖 | 可选值 |
|------|-------------|----------|--------|
| `AUTH_DRIVER` | 有 `SUPABASE_URL` + `SUPABASE_ANON_KEY` → `supabase` | `AUTH_DRIVER` env | `local`, `supabase` |
| `DATA_DRIVER` | 同 auth → `supabase` | `DATA_DRIVER` env | `memory`, `supabase` |
| `QUEUE_DRIVER` | 有 `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_ID` → `trigger` | `QUEUE_DRIVER` env | `inline`, `trigger` |
| `AI_DRIVER` | 按 `MINIMAX_API_KEY` → `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → `mock` 优先级 | `AI_DRIVER` env | `mock`, `openai`, `anthropic`, `minimax` |

配置解析集中在 `packages/config/src/index.ts`，通过 `runtimeEnv` 冻结对象对外暴露。

### 3.2 模式组合

| 场景 | AUTH | DATA | QUEUE | AI | 说明 |
|------|------|------|-------|----|------|
| 本地零配置体验 | `local` | `memory` | `inline` | `mock` | 不需要任何外部服务 |
| 本地 + 真实 AI | `local` | `memory` | `inline` | `anthropic`/`openai` | 只需配一个 API key |
| 完整后端 | `supabase` | `supabase` | `trigger` | `anthropic` | 生产级部署 |

---

## 4. 数据模型

### 4.1 核心实体关系

```
profiles
  │
  └── interview_sessions ──────────────────────┐
        │                                      │
        ├── interview_turns                    │
        │                                      │
        ├── session_artifacts (文件上传)        │
        │                                      │
        ├── diagnostic_reports                 │
        │                                      │
        └── memory_profiles ──────────┐        │
              │                       │        │
              └── memory_evidence     │        │
                    (embedding)       │        │
                                      │        │
              command_threads ◄───────┘────────┘
                │
                ├── command_messages
                │
                └── generated_artifacts
```

### 4.2 数据库 Schema（PostgreSQL）

**10 张业务表** + **1 个 Storage Bucket**：

| 表名 | 主键 | 核心用途 |
|------|------|----------|
| `profiles` | `user_id` (uuid) | 用户偏好（角色包、工作区模式） |
| `role_pack_preferences` | `id` (uuid) | 角色包配置历史 |
| `interview_sessions` | `id` (text) | 面试会话主表 |
| `interview_turns` | `id` (text) | 面试轮次（候选人 + 面试官） |
| `session_artifacts` | `id` (uuid) | 上传文件元数据 |
| `diagnostic_reports` | `id` (text) | 诊断报告（JSON payload） |
| `memory_profiles` | `id` (text) | 记忆画像（skills/gaps/traits/wins） |
| `memory_evidence` | `id` (uuid) | 证据条目 + vector embedding |
| `command_threads` | `id` (text) | 指挥中心对话线程 |
| `command_messages` | `id` (text) | 对话消息 + artifact |
| `generated_artifacts` | `id` (uuid) | AI 生成的结构化产物 |

**向量索引**：`memory_evidence.embedding` 列使用 HNSW（`vector_cosine_ops`，1536 维）。

**安全**：所有表启用 RLS（Row Level Security），策略统一为 `auth.uid() = user_id`。

**文件存储**：Supabase Storage bucket `session-artifacts`（私有），按 `{user_id}/{filename}` 路径隔离，RLS 策略按 `storage.foldername(name)[1]` 匹配。

### 4.3 域模型类型体系（Zod Schema）

所有类型定义在 `packages/contracts/src/index.ts`，为唯一真相来源：

```
SessionConfig         面试配置（角色包、公司、级别、JD、面试官列表）
DirectorState         导演状态（openLoops、pressureScore、conflictBudget、nextSpeakerId）
InterviewSession      面试会话 = SessionConfig + DirectorState + 状态字段
InterviewTurn         一次对话轮次（candidate/interviewer/system × question/follow_up/interrupt/conflict）
LiveTurnEvent         AI 生成的流式事件（SSE 输出单元）
DiagnosticReport      诊断报告（scores + findings + starStories + trainingPlan）
MemoryProfile         记忆画像（skills + gaps + behaviorTraits + wins + evidenceSpans + replayMoments）
MemoryEvidence        可向量化的证据条目
ActiveMemoryContext   活跃上下文 = profile + evidence + relatedProfiles + timeline
CommandArtifact       指挥中心产物 = CopilotResponse | StrategyReport | SandboxOutcome
CommandThread         对话线程
CommandMessage        对话消息
Viewer                当前用户视图
```

**类型流转**：

```
SessionConfig → InterviewSession → InterviewTurn[]
                                      │
                              analyzeAnswerSignals()
                                      │
                              DirectorMovePlan → LiveTurnEvent(s)
                                      │
                              完成面试后
                                      │
                    DiagnosticReport + MemoryProfile + MemoryEvidence[]
                                      │
                              接受报告后
                                      │
                    ActiveMemoryContext → CommandArtifact
```

---

## 5. API 设计

### 5.1 路由总表

API 服务器为 Fastify（`apps/api/src/server.ts`），所有路由前缀为 `/api/v1/`。

**认证**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/auth/session` | 获取当前 viewer |
| POST | `/api/v1/auth/magic-link` | 魔法链接登录 |
| POST | `/api/v1/auth/google` | Google OAuth 登录 |
| GET | `/api/v1/auth/callback` | OAuth 回调 |
| GET | `/api/v1/auth/sign-out` | 登出（清除 cookie） |

**会话管理**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/sessions` | 列出用户所有会话 |
| GET | `/api/v1/sessions/:sessionId` | 获取单个会话 |
| GET | `/api/v1/sessions/:sessionId/detail` | 会话 + 所有轮次 |
| POST | `/api/v1/sessions/:sessionId/accept` | 接受录用 |
| POST | `/api/v1/sessions/:sessionId/hub` | 激活指挥中心 |

**面试**：

| 方法 | 路径 | 说明 | 响应格式 |
|------|------|------|----------|
| POST | `/api/v1/interviews` | 创建面试会话 | JSON |
| POST | `/api/v1/interviews/:sessionId/turn` | 提交回答、获取下一轮 | **SSE** |
| POST | `/api/v1/interviews/:sessionId/complete` | 结束面试、触发分析 | JSON |

**报告**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/reports/:sessionId` | 获取诊断报告 + 记忆画像 |
| GET | `/api/v1/reports/:sessionId/status` | 报告生成状态 |
| POST | `/api/v1/reports/:sessionId/retry` | 重试分析 |

**指挥中心**：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/command/:mode` | copilot / strategy / sandbox 请求 |
| POST | `/api/v1/command/sandbox/turn` | sandbox 多轮对话 |

**其他**：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/uploads` | 文件上传（multipart） |
| GET | `/api/v1/memory/active` | 获取活跃记忆上下文 |

### 5.2 认证机制

- **`local` 模式**：返回固定的 demo viewer，无需认证
- **`supabase` 模式**：支持魔法链接 + Google OAuth
  - Access token / Refresh token 存储在 httpOnly cookie 中
  - 每次 API 请求通过 cookie 解析 viewer
  - Token 刷新时自动更新 cookie
  - RLS 依赖 Supabase 的 `auth.uid()`

认证逻辑位于 `requireViewer()` 函数，未认证返回 401。

### 5.3 SSE 流式协议

面试轮次 API（`/api/v1/interviews/:sessionId/turn`）使用 Server-Sent Events：

```
event: thinking
data: {"sessionId":"...","status":"director_analyzing","timestamp":"..."}

event: turn
data: {"id":"...","kind":"follow_up","speakerId":"hacker","message":"...","pressureDelta":4,...}

event: turn                                        ← 可选的冲突事件
data: {"id":"...","kind":"conflict","speakerId":"founder","message":"...","pressureDelta":8,...}
```

每个 SSE 事件通过 `encodeSseEvent()` 函数编码。

### 5.4 错误响应

统一 JSON 错误格式：

```typescript
{ error: string; message: string }
```

AI 相关错误额外包含：

```typescript
{ error: string; message: string; provider?: AiDriver; retryable?: boolean }
```

- `retryable: true` → 503（AI 暂时不可用）
- `retryable: false` → 502（AI 输出无法解析）

---

## 6. 核心业务流程

### 6.1 面试引擎（三层架构）

面试引擎是系统核心，分为三层：

#### 第一层：信号分析（`interview-director.ts` — 纯函数）

**输入**：候选人回答文本 + 上下文（上一个问题、当前压力值）

**处理**：

1. **关键词匹配**：对回答做 9 个信号维度的关键词命中统计
   - `low_level`（算法/并发/内存）、`architecture`（系统/网关/分布式）、`business`（收入/市场/成本）
   - `tradeoff`（取舍/优先级）、`metrics`（指标/转化）、`ownership`（负责/拍板）
   - `people`（团队/冲突）、`process`（流程/回滚）、`data`（实验/埋点）、`risk`（风险/故障）

2. **模式检测**：
   - 因果标记（`because`/`因为...所以`）
   - 项目经验模式（`在我负责的`/`上线后`/`提升了`）
   - 边界条件模式（`除非`/`最大`/`瓶颈`）
   - 证据标记（`for example`/`具体数据`/`测试结果`）
   - 矛盾风险标记（`一定`/`绝不`/`always`）

3. **弱点识别**：
   - 回答过长（>620字符 或 >6句子）
   - 答非所问（keyword overlap < 0.16）
   - 缺少因果链
   - 缺少具体证据
   - 矛盾风险

**输出**：`AnswerSignalProfile`

```typescript
{
  tags: string[];              // 命中的信号维度
  weaknesses: string[];        // 识别出的弱点
  strengths: string[];         // 识别出的优势
  relevance: number;           // 与上一个问题的相关度
  causalHits: number;          // 因果标记命中数
  evidenceHits: number;        // 证据标记命中数
  contradictionRisk: boolean;  // 是否存在矛盾风险
  mentionsTradeoff: boolean;   // 是否提到取舍
  summary: string;             // 回答摘要（88字符）
}
```

#### 第二层：导演规划（`interview-director.ts` — 纯函数）

**输入**：`AnswerSignalProfile` + 会话状态

**处理**：

1. **选择主面试官**：对每位可用面试官计算匹配分数（focusSignals 命中 + weaknessBonus + tieBreaker），选择最高分
2. **判断是否触发冲突**：条件包括
   - 多面试官可用 + 还有冲突预算
   - 且满足：提到取舍 / 矛盾风险 / 架构话题缺证据 / 商业或所有权话题缺证据
3. **选择冲突面试官**：排除主面试官，同样按分数排序；若主面试官非 founder 且满足条件，优先选 founder
4. **构建待补闭环**：根据信号维度和弱点生成最多 4 条追问线索

**输出**：`DirectorMovePlan`

```typescript
{
  primarySpeakerId: string;
  primaryKind: "question" | "follow_up" | "interrupt";
  primaryDirective: string;
  shouldCreateConflict: boolean;
  conflictSpeakerId?: string;
  conflictDirective?: string;
  openLoops: string[];         // 待补闭环列表
  brief: string;               // 导演简报
}
```

#### 第三层：AI 结构化生成（`infrastructure/ai/adapter.ts`）

**输入**：`DirectorMovePlan` + 完整上下文

**处理**：调用 AI provider 生成符合 `LiveTurnEventSchema` 的结构化输出

**输出**：1-2 个 `LiveTurnEvent`（主事件 + 可选冲突事件），通过 SSE 推送

### 6.2 打断评估

每次候选人回答先经过 `assessInterruptNeed()`，独立于导演规划：

| 条件 | 结果 | 压力增量 |
|------|------|----------|
| 回答 > 620字符 或 > 6句子 | 打断 | +10 |
| 答非所问（overlap < 0.15）且无因果 | 打断 | +8 |
| 废话词 ≥ 3 且无因果 | 打断 | +9 |
| 回答 < 40字符 且压力 ≥ 55 且无因果 | 追问 | +6 |
| 其他 | 继续追问 | +4 |

### 6.3 压力模型

- 初始压力：42
- 范围：0-100（通过 `clamp()` 约束）
- 每轮变化：所有发出事件的 `pressureDelta` 之和
- 打断：+6~+10
- 冲突：+8
- 普通追问：+4

### 6.4 会话状态机

```
draft → live → analyzing → report_ready → accepted → hub_active
                  │
                  └── (失败) → analyzing（带 analysisError）
                                   │
                                   └── retry → analyzing → ...
```

状态守卫（`session-state.ts`）：

- `canAcceptOffer`：status 为 `report_ready` 或 `accepted`
- `canActivateCommandCenter`：status 为 `accepted` 或 `hub_active`
- `isAnalysisRetryable`：仅当 status 为 `analyzing`（且非其他状态）时可重试

### 6.5 报告生成流程

```
queueInterviewAnalysis()
  │
  ├── 有 JobQueue → enqueueInterviewAnalysis() → Trigger.dev 后台任务
  │
  └── 无 JobQueue → executeInterviewAnalysis()（进程内）
                      │
                      ├── status → "analyzing"
                      ├── generateDiagnosticReport() → DiagnosticReport
                      ├── generateMemoryProfile() → MemoryProfile
                      ├── buildMemoryEvidence() → MemoryEvidence[]
                      ├── generateEmbeddings() → number[][] | null（失败不阻断）
                      ├── saveReport() + saveMemoryProfile() + saveMemoryEvidence()
                      └── status → "report_ready"
```

### 6.6 指挥中心

三个模式共享 `ActiveMemoryContext`，但产出不同的 `CommandArtifact`：

| 模式 | 输入 | 输出 | 特殊能力 |
|------|------|------|----------|
| `copilot` | 工程问题描述 | `CopilotResponse`（根因 + 修复路径 + 重构建议 + 技术前瞻） | — |
| `strategy` | 可行性研究需求 | `StrategyReport`（sections + diagram + timeline + risks + citations） | web_search |
| `sandbox` | 谈判场景配置 | `SandboxOutcome`（博弈分析 + payoff matrix + scenario branches） | 多轮对话 |

Sandbox 模式支持多轮对话，通过 `/api/v1/command/sandbox/turn` 接口实现回合制交互：

```
用户消息 → AI 生成对手回复 + 战术分析 → 保存双方消息 → 返回对手回复
```

---

## 7. AI 集成

### 7.1 Provider 架构

```
AiProviderAdapter (interface)
  │
  ├── MockAiProvider       demo 模式 / 无 API key 时使用
  ├── OpenAiProvider       使用 responses.parse() + zodTextFormat()
  ├── AnthropicProvider    使用 messages.parse() + zodOutputFormat()
  └── (MiniMaxProvider)    未实现，当前降级为 Mock
```

选择逻辑（`getAiProvider()`）：

```
hasAnthropic() → AnthropicProvider
else hasOpenAi() → OpenAiProvider
else hasMiniMax() → MockAiProvider  ← 注意：尚未实现真正的 MiniMax adapter
else → MockAiProvider
```

Provider 实例全局缓存（模块级 `_provider` 变量），可通过 `resetAiProvider()` 重置（用于测试）。

### 7.2 结构化输出

所有 AI 输出经过 Zod schema 双重校验：

1. **AI SDK 层**：OpenAI 使用 `zodTextFormat()` / Anthropic 使用 `zodOutputFormat()` 在请求时约束输出格式
2. **边界层**：返回值再次通过 `Schema.parse()` 校验

Schema 通常在传入 AI 时 `.omit()` 掉服务端生成的字段（`id`, `sessionId`, `timestamp`），这些字段在 parse 后手动补充。

### 7.3 Anthropic 兼容网关

当配置了 `ANTHROPIC_BASE_URL` 时，Anthropic provider 切换为"网关模式"：

- 使用 `messages.create()`（非 `messages.parse()`）
- 在 system prompt 中注入 JSON schema 描述
- 通过手写 JSON 解析器（`extractStructuredJson()`）从文本响应中提取结构化输出
- 支持从 markdown fenced code block 和裸 JSON 中提取

### 7.4 Embedding

- 仅在 OpenAI provider 下可用
- 模型：`text-embedding-3-small`（可配置）
- 输入：`MemoryEvidence` 条目的 `${kind}: ${label}. ${summary}` 拼接
- 存储：`memory_evidence.embedding` 列（vector(1536)）
- Embedding 生成失败不阻断分析流程

### 7.5 AI 方法清单

| 方法 | 用途 | Mock 实现 |
|------|------|-----------|
| `generateInterviewEvent()` | 面试轮次生成 | 基于角色 persona 模板随机选择 |
| `generateDiagnosticReport()` | 诊断报告 | 固定模板（8维度评分 + 2 findings） |
| `generateMemoryProfile()` | 记忆画像 | 固定模板（1 skill + 1 gap + 1 trait + 1 win） |
| `generateCommandArtifact()` | 指挥中心产物 | 按 mode 返回固定模板 |
| `generateSandboxTurn()` | Sandbox 对手回合 | 固定对手回复 |
| `generateEmbeddings()` | 向量嵌入 | 返回 null |

---

## 8. 前端路由

### 8.1 页面路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `app/page.tsx` | 主工作区（最近会话 + 模块入口） |
| `/landing` | `app/landing/page.tsx` | 品牌落地页 |
| `/simulator/new` | `app/simulator/new/page.tsx` | 面试配置 |
| `/simulator/[sessionId]` | `app/simulator/[sessionId]/page.tsx` | 面试对话（SSE） |
| `/report/[sessionId]` | `app/report/[sessionId]/page.tsx` | 诊断报告 |
| `/hub/copilot` | `app/hub/copilot/page.tsx` | 工程副驾 |
| `/hub/strategy` | `app/hub/strategy/page.tsx` | 可行性研究 |
| `/hub/sandbox` | `app/hub/sandbox/page.tsx` | 博弈沙盒 |
| `/hub` | `app/hub/page.tsx` | 指挥中心入口 |
| `/workshop` | `app/workshop/page.tsx` | 工作坊 |
| `/auth/sign-in` | `app/auth/sign-in/page.tsx` | 登录页 |

### 8.2 前端组件

14 个组件位于 `apps/web/components/`，覆盖：

- 面试控制台（`interview-console.tsx`）
- 指挥中心 Shell + Console（`hub-shell.tsx`, `hub-console.tsx`）
- 报告状态面板 + 操作按钮（`report-status-panel.tsx`, `report-actions.tsx`）
- 可视化组件（`radar-chart.tsx`, `diagram-view.tsx`, `timeline-view.tsx`, `payoff-matrix.tsx`）
- 通用组件（`app-frame.tsx`, `auth-panel.tsx`, `theme-toggle.tsx`）

### 8.3 客户端 API

客户端通过 `apps/web/lib/client/api.ts` 和 `apps/web/lib/client/router.ts` 与 Fastify 通信。所有 API 调用最终走 `/api/v1/*`，由 Next.js rewrite 代理到 Fastify。

---

## 9. Ports & Adapters 接口

### 9.1 端口定义（`packages/application/src/ports.ts`）

```
ApplicationStore = UploadStore
                 & SessionRepository
                 & TurnRepository
                 & ReportRepository
                 & MemoryRepository
                 & ThreadRepository
                 & IdentityGateway
```

| 接口 | 方法数 | 说明 |
|------|--------|------|
| `UploadStore` | 1 | 文件上传 |
| `SessionRepository` | 5 | 会话 CRUD + 偏好设置 |
| `TurnRepository` | 2 | 轮次追加 + 列表 |
| `ReportRepository` | 2 | 报告保存 + 查询 |
| `MemoryRepository` | 7 | 画像 CRUD + 证据 + 激活 |
| `ThreadRepository` | 5 | 线程 CRUD + 消息 + artifact |
| `IdentityGateway` | 1 | demo viewer |
| **合计** | **23** | |

### 9.2 AI Provider 接口

| 接口 | 方法 |
|------|------|
| `InterviewAiProvider` | `generateInterviewEvent`, `reviewEvent?` |
| `AnalysisAiProvider` | `generateDiagnosticReport`, `generateMemoryProfile`, `generateEmbeddings?` |
| `CommandAiProvider` | `generateCommandArtifact`, `generateSandboxTurn` |

### 9.3 适配器实现

| 端口 | Memory 实现 | Supabase 实现 |
|------|------------|--------------|
| `ApplicationStore` | `MemoryDataStore`（in-process Map） | `SupabaseDataStore`（PostgreSQL） |
| `InterviewAiProvider` | `MockAiProvider` | `OpenAiProvider` / `AnthropicProvider` |
| `JobQueue` | `createJobQueue()`（inline fallback） | Trigger.dev task |

---

## 10. 已知限制与风险

### 10.1 已知技术限制

| 编号 | 限制 | 影响 | 严重程度 |
|------|------|------|----------|
| L1 | MiniMax provider 未实现 | 配置 MiniMax key 时静默降级为 Mock | 高 |
| L2 | 信号分析为纯关键词匹配 | 无法理解语义相似性（如"降级" vs "兜底"） | 中 |
| L3 | Embedding 基础设施已建但未被信号分析利用 | HNSW 索引和 embedding 存储已就绪，但面试过程中不使用 | 低 |
| L4 | Anthropic 网关模式 JSON 解析器手写 | 边界情况（Unicode 转义、字符串内嵌花括号）可能解析失败 | 中 |
| L5 | `dangerouslyAllowBrowser: true` | 如果 Anthropic adapter 被前端代码引用，API key 会泄漏到客户端 | 高 |
| L6 | AI prompt 无集中管理 | 所有 prompt 为字符串拼接，难以版本管理和 A/B 测试 | 低 |
| L7 | 分析错误信息存在乱码 | `analysis.ts` 中错误消息为 UTF-8 编码损坏的中文 | 低 |

### 10.2 架构风险

| 编号 | 风险 | 缓解措施 |
|------|------|----------|
| R1 | `generateNextInterviewBeat` 函数职责过重（~170 行） | 拆分为"评估 + 规划"与"执行"两步 |
| R2 | Provider 实例全局缓存无 TTL | 测试中已有 `resetAiProvider()`，但生产环境切换 provider 需要重启 |
| R3 | 信号分析弱点/优势文本为英文，与中文系统不一致 | 统一为中文 |
| R4 | 无速率限制 | Fastify 服务器未配置 rate limiting |

---

## 附录 A. 角色包定义

四个角色包，每个 3 位面试官，founder 在所有角色包中出现：

| 角色包 | 面试官 1 | 面试官 2 | 面试官 3 | 专长轴 |
|--------|----------|----------|----------|--------|
| 工程 | 黑客（技术洁癖者） | 架构师（系统架构师） | 创始人 | 工程直觉 / 系统韧性 |
| 产品 | 战略家（战略负责人） | 操盘手（执行伙伴） | 创始人 | 用户洞察 / 优先级判断 |
| 运营 | 分析师（数据分析师） | 操盘手（运营负责人） | 创始人 | 流程治理 / 风险控制 |
| 管理 | 带人者（团队管理者） | 跨部门负责人 | 创始人 | 团队成熟度 / 资源谈判 |

共享评分轴（6 个）：专业深度、问题框定、沟通效率、压力应对、判断力、主人翁意识。

## 附录 B. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT_BASE` | `3000` | 服务端口基数 |
| `PUBLIC_ORIGIN` | `http://127.0.0.1:{PORT_BASE}` | 应用公网地址 |
| `AI_DRIVER` | 自动检测 | `mock` / `openai` / `anthropic` / `minimax` |
| `AUTH_DRIVER` | 自动检测 | `local` / `supabase` |
| `DATA_DRIVER` | 自动检测 | `memory` / `supabase` |
| `QUEUE_DRIVER` | 自动检测 | `inline` / `trigger` |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-5.2` | OpenAI 主模型 |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding 模型 |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic 模型 |
| `ANTHROPIC_BASE_URL` | — | 兼容网关地址（官方直连留空） |
| `MINIMAX_API_KEY` | — | MiniMax API key |
| `MINIMAX_MODEL` | `MiniMax-M2.7` | MiniMax 模型 |
| `MINIMAX_BASE_URL` | `https://api.minimax.chat/v1` | MiniMax API 地址 |
| `SUPABASE_URL` | — | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | — | Supabase 匿名 key |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase 管理 key（绕过 RLS） |
| `SUPABASE_STORAGE_BUCKET` | `session-artifacts` | 文件存储桶名 |
| `TRIGGER_SECRET_KEY` | — | Trigger.dev 密钥 |
| `TRIGGER_PROJECT_ID` | — | Trigger.dev 项目 ID |
| `AUTH_ACCESS_COOKIE` | `anion-access-token` | Access token cookie 名 |
| `AUTH_REFRESH_COOKIE` | `anion-refresh-token` | Refresh token cookie 名 |
