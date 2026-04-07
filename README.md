# 莫比乌斯计划 / Mobius Project

<div align="center">

**AI 驱动的面试模拟与职场陪跑平台**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT%20%7C%20Apache--2.0-green)](LICENSE)

</div>

---

## 项目定位

莫比乌斯计划覆盖从面试到入职的完整职业旅程：

1. **实战演练** — 多面试官高压对弈，信号分析驱动动态追问与冲突升级
2. **分析洞察** — 结构化诊断报告、记忆画像与证据图谱
3. **工作台** — 聊天式工作助理，三大模式一键切换（Copilot / Strategy / Sandbox）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           莫比乌斯计划 — 旅程全览                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────────┐   │
│  │ 目标设定  │ ─► │ 实战演练  │ ─► │ 分析洞察  │ ─► │      工作台          │   │
│  │          │    │          │    │          │    │                      │   │
│  │ 角色选择  │    │ 动态追问  │    │ 能力评分  │    │  /copilot  工程排错   │   │
│  │ 压力配置  │    │ 信号分析  │    │ 记忆画像  │    │  /strategy 可行性研究 │   │
│  │          │    │ 冲突升级  │    │ 证据图谱  │    │  /sandbox  职场博弈   │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────────────┘   │
│                                                                              │
│              ActiveMemoryContext — 同一份能力图谱贯穿始终                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心功能

### 实战演练

| 特性 | 说明 |
|------|------|
| 动态导演 | 根据回答信号选择下一位面试官、触发追问或冲突升级 |
| 压力量化 | 实时压力分数 (0-100)，三阶段推进 (calibrate → surround → crossfire) |
| 信号分析 | 关键词提取、证据识别、薄弱点定位 |
| SSE 流式 | 面试回合实时推送，支持打断与冲突事件 |
| 角色包 | 4 套角色配置 (Engineering / Product / Operations / Management) |

### 分析洞察

| 模块 | 内容 |
|------|------|
| 能力评分 | 8 个维度量化评估 |
| 关键发现 | 高/中/低严重度问题定位 |
| STAR 案例 | 自动提取结构化故事 |
| 压力时刻 | 高压场景切片与复练建议 |

### 工作台

Hub 页面采用聊天优先界面，输入 `/` 切换模式，支持自然语言自动识别：

```
┌─────────────────────────────────────────────────────────────────┐
│                        ActiveMemoryContext                       │
├─────────────────────────────────────────────────────────────────┤
│  skills[]  — 已验证的技能亮点    gaps[]     — 待补强的能力短板   │
│  behavior[] — 行为倾向与模式     wins[]     — 高光时刻           │
│  evidence[] — 可向量化的证据条目                                 │
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ /copilot │     │ /strategy│     │ /sandbox │
    │ 工程排错  │     │ 可行性    │     │ 职场博弈  │
    │ 修复路径  │     │ 战略研究   │     │ 谈判模拟  │
    └──────────┘     └──────────┘     └──────────┘
```

| 命令 | 快捷键 | 用途 |
|------|--------|------|
| `/copilot` | `/c` | 结合短板与历史证据，输出根因、修复路径、技术前瞻 |
| `/strategy` | `/s` | 围绕目标问题生成可行性研究、架构图 DSL、排期与资源表 |
| `/sandbox` | `/b` | 模拟谈判或职场对抗，输出对手回合、策略点评、施压等级 |

### OpenClaw 集成（可选）

内置 [OpenClaw](https://github.com/openclaw/openclaw) 深度集成，通过 Docker Sidecar 部署：

- WebSocket 网关通信，技能系统扩展
- 定时任务引擎（每日提醒、技能复盘、短板预警）
- 记忆桥接：单向同步 ActiveMemoryContext 到 OpenClaw
- 优雅降级：OpenClaw 不可用时自动回退到内置 AI Adapter

---

## 技术架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              架构分层                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                       Presentation Layer                             │    │
│  │  app/  components/  —  Next.js 16 App Router + React 19              │    │
│  │  CompanionChat / ArtifactRenderer / ChatInput / NotificationBell     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                        Service Layer                                 │    │
│  │  lib/server/services/                                                │    │
│  │  ├─ interview.ts          — 会话创建、回合推进、打断处理               │    │
│  │  ├─ interview-director.ts — 信号分析、导演策略（纯函数）              │    │
│  │  ├─ analysis.ts           — 报告生成、记忆画像、向量嵌入               │    │
│  │  ├─ command-center.ts     — 三模式工作台编排                          │    │
│  │  ├─ notifications.ts      — 用户通知服务                              │    │
│  │  └─ career-summary.ts     — 职业概览聚合                              │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                        Domain Layer                                  │    │
│  │  lib/domain.ts — Zod schemas + TypeScript types                      │    │
│  │  • 所有领域模型单一来源                                               │    │
│  │  • 角色包定义 (Engineering / Product / Operations / Management)       │    │
│  │  • 标签格式化、状态枚举                                               │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐    │
│  │   AI Adapter       │  │    Data Store        │  │   OpenClaw (可选)  │    │
│  │  lib/ai/adapter.ts │  │  lib/server/store/   │  │  lib/openclaw/     │    │
│  │  ├─ OpenAI         │  │  ├─ MemoryDataStore  │  │  ├─ client.ts  WS  │    │
│  │  ├─ Anthropic      │  │  ├─ SqliteDataStore  │  │  ├─ bridge.ts      │    │
│  │  └─ MockAiProvider │  │  └─ SupabaseDataStore│  │  ├─ skills/        │    │
│  └────────────────────┘  └─────────────────────┘  └────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 运行模式

| 模式 | 存储 | AI | 认证 | 适用场景 |
|------|------|-----|------|---------|
| **demo** | SQLite / Memory | Mock / 真实 | 无 | 本地体验、快速验证 |
| **supabase** | PostgreSQL | 真实 | Supabase Auth | 生产部署 |

模式由环境变量自动判定：

```typescript
// lib/env.ts
function resolveRuntimeMode(): "demo" | "supabase" {
  return hasSupabase() ? "supabase" : "demo";
}
```

---

## 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/lizuyi-6/anion.git
cd anion

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器 (demo 模式)
pnpm dev
```

访问 http://localhost:3000 即可体验完整流程。

### Docker 部署

```bash
# 仅 Mobius
docker build -t anion .
docker run -d -p 3000:3000 \
  -v anion-data:/app/data \
  -e ANTHROPIC_API_KEY=your-key \
  -e ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic \
  -e ANTHROPIC_MODEL=MiniMax-M2.7 \
  anion
```

### Docker Compose（含 OpenClaw）

```bash
docker compose up -d
```

Mobius 运行在 3000 端口，OpenClaw Sidecar 在 18789 端口。开发模式下 OpenClaw 默认关闭（`docker-compose.dev.yml`）。

---

## 环境变量

### 核心配置

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `APP_URL` | 应用访问地址 | `http://localhost:3000` |
| `OPENAI_API_KEY` | OpenAI API Key | — |
| `OPENAI_MODEL` | OpenAI 模型 | `gpt-5.2` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | — |
| `ANTHROPIC_MODEL` | Anthropic 模型 | `claude-sonnet-4-20250514` |
| `ANTHROPIC_BASE_URL` | Anthropic 兼容网关 | — |
| `SUPABASE_URL` | Supabase 项目 URL | — |
| `SUPABASE_ANON_KEY` | Supabase 匿名 Key | — |
| `SQLITE_PATH` | SQLite 数据库路径 | `data/mobius.db` |

### OpenClaw 配置（可选）

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `OPENCLAW_ENABLED` | 启用 OpenClaw 集成 | `false` |
| `OPENCLAW_GATEWAY_URL` | WebSocket 网关地址 | `ws://localhost:18789` |
| `OPENCLAW_WEBHOOK_URL` | Webhook 回调地址 | — |
| `OPENCLAW_SHARED_SECRET` | 认证密钥 | — |

**AI Provider 优先级**: Anthropic → OpenAI → Mock

---

## 项目结构

```
anion/
├── app/                     # Next.js App Router
│   ├── api/
│   │   ├── chat/            # 统一聊天 API
│   │   └── openclaw/        # OpenClaw webhook
│   ├── simulator/           # 实战演练页面
│   ├── report/              # 分析洞察页面
│   └── hub/                 # 工作台页面 (聊天优先)
├── components/              # React 组件
│   ├── companion-chat.tsx   # 聊天主界面
│   ├── artifact-renderer.tsx # 工件渲染 (三种模式)
│   ├── chat-input.tsx       # 输入框 + 斜杠命令
│   └── notification-bell.tsx # 通知铃铛
├── lib/
│   ├── domain.ts            # 领域模型 (Zod + TypeScript)
│   ├── env.ts               # 环境配置
│   ├── ai/
│   │   ├── adapter.ts       # AI Provider 适配层
│   │   └── errors.ts        # AI 错误处理
│   ├── client/
│   │   └── api.ts           # 客户端 API 封装
│   ├── openclaw/            # OpenClaw 集成层
│   │   ├── client.ts        # WebSocket 客户端
│   │   ├── bridge.ts        # 记忆桥接
│   │   ├── skills/          # 技能定义
│   │   └── cron.ts          # 定时任务注册
│   └── server/
│       ├── auth.ts          # 认证逻辑
│       ├── services/        # 业务服务
│       └── store/           # 数据存储
│           ├── repository.ts # DataStore 接口 + 工厂
│           └── sqlite.ts    # SQLite 实现
├── tests/                   # Vitest 测试
├── docker-compose.yml       # 生产编排
├── docker-compose.dev.yml   # 开发覆盖
├── Dockerfile
└── package.json
```

---

## 开发命令

```bash
pnpm dev                    # 启动开发服务器
pnpm build                  # 生产构建
pnpm lint                   # ESLint 检查
pnpm test                   # 运行测试
pnpm test:watch             # 测试监听模式
pnpm test -- tests/xxx.test.ts   # 运行单个测试
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 |
| Validation | Zod |
| AI | OpenAI Responses API / Anthropic Messages API |
| Database | SQLite (demo) / Supabase PostgreSQL (prod) |
| Background Jobs | Trigger.dev (可选) |
| AI Companion | OpenClaw (可选 Sidecar) |
| Testing | Vitest |
| Package Manager | pnpm |

---

## License

本仓库核心代码按 `MIT OR Apache-2.0` 双许可证发布，可任选其一使用。

详见 [LICENSE](LICENSE)、[LICENSE-MIT](LICENSE-MIT)、[LICENSE-APACHE](LICENSE-APACHE)。
