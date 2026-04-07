# 莫比乌斯计划 / Mobius Project

<div align="center">

**AI 驱动的面试模拟与职场指挥中心**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT%20%7C%20Apache--2.0-green)](LICENSE)

</div>

---

## 项目定位

莫比乌斯计划不是普通的问答式面试练习器。它把"面试"定义成一场高压对弈：

1. **面试沙盒** — 根据候选人回答做信号分析，动态选择发问者、触发冲突追问
2. **诊断报告** — 生成结构化的能力诊断、记忆画像和证据图谱
3. **指挥中心** — 把面试沉淀的能力图谱带入三个工作台，从"找漏洞"切换到"补短板"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              莫比乌斯计划                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐   │
│   │   面试沙盒    │ ──► │   诊断报告    │ ──► │       指挥中心           │   │
│   │              │     │              │     │                          │   │
│   │ • 动态追问    │     │ • 能力评分    │     │  ┌────────┐ ┌────────┐  │   │
│   │ • 信号分析    │     │ • 记忆画像    │     │  │ Copilot│ │Strategy│  │   │
│   │ • 压力测试    │     │ • 证据图谱    │     │  └────────┘ └────────┘  │   │
│   │ • 冲突升级    │     │ • 训练计划    │     │  ┌─────────────────────┐│   │
│   └──────────────┘     └──────────────┘     │  │      Sandbox        ││   │
│                                              │  └─────────────────────┘│   │
│                                              └──────────────────────────┘   │
│                                                                             │
│              共享 ActiveMemoryContext — 同一份能力图谱贯穿始终                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心功能

### 面试模拟

| 特性 | 说明 |
|------|------|
| 动态导演 | 根据回答信号选择下一位面试官、触发追问或冲突升级 |
| 压力量化 | 实时压力分数 (0-100)，三阶段推进 (calibrate → surround → crossfire) |
| 信号分析 | 关键词提取、证据识别、薄弱点定位 |
| SSE 流式 | 面试回合实时推送，支持打断与冲突事件 |

### 诊断报告

| 模块 | 内容 |
|------|------|
| 能力评分 | 8 个维度量化评估 |
| 关键发现 | 高/中/低严重度问题定位 |
| STAR 案例 | 自动提取结构化故事 |
| 压力时刻 | 高压场景切片与复练建议 |

### 指挥中心

三个工作台共享同一份 `ActiveMemoryContext`：

```
┌─────────────────────────────────────────────────────────────────┐
│                        ActiveMemoryContext                       │
├─────────────────────────────────────────────────────────────────┤
│  • skills[]      — 已验证的技能亮点                               │
│  • gaps[]        — 待补强的能力短板                               │
│  • behavior[]    — 行为倾向与模式                                 │
│  • wins[]        — 高光时刻                                       │
│  • evidence[]    — 可向量化的证据条目                             │
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  Copilot │     │ Strategy │     │ Sandbox  │
    │          │     │          │     │          │
    │ 工程排错  │     │ 可行性    │     │ 职场博弈  │
    │ 修复路径  │     │ 战略研究   │     │ 谈判模拟  │
    └──────────┘     └──────────┘     └──────────┘
```

| 模式 | 用途 |
|------|------|
| **Copilot** | 结合短板与历史证据，输出根因、最短修复路径、技术前瞻 |
| **Strategy** | 围绕目标问题生成可行性研究、架构图 DSL、排期与资源表 |
| **Sandbox** | 模拟谈判或职场对抗，输出对手回合、策略点评、施压等级 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              架构分层                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Presentation Layer                            │   │
│  │  app/  components/  —  Next.js 16 App Router + React 19              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Service Layer                                │   │
│  │  lib/server/services/                                                │   │
│  │  ├─ interview.ts        — 会话创建、回合推进、打断处理                 │   │
│  │  ├─ interview-director.ts — 信号分析、导演策略（纯函数）              │   │
│  │  ├─ analysis.ts         — 报告生成、记忆画像、向量嵌入                 │   │
│  │  └─ command-center.ts   — 三模式工作台编排                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Domain Layer                                 │   │
│  │  lib/domain.ts — Zod schemas + TypeScript types                      │   │
│  │  • 所有领域模型单一来源                                              │   │
│  │  • 角色包定义 (Engineering / Product / Operations / Management)       │   │
│  │  • 标签格式化、状态枚举                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────┐   ┌───────────────────────────────────┐     │
│  │      AI Adapter Layer     │   │         Data Store Layer          │     │
│  │  lib/ai/adapter.ts        │   │  lib/server/store/repository.ts   │     │
│  │  ├─ AnthropicProvider     │   │  ├─ SqliteDataStore (demo)        │     │
│  │  ├─ OpenAiProvider        │   │  └─ SupabaseDataStore (prod)      │     │
│  │  └─ MockAiProvider        │   │                                   │     │
│  │                           │   │  • 25+ 统一接口                    │     │
│  │  • Zod 校验边界           │   │  • 自动 snake_case ↔ camelCase    │     │
│  │  • 结构化输出保证          │   │  • RLS 感知                       │     │
│  └───────────────────────────┘   └───────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 运行模式

| 模式 | 存储 | AI | 认证 | 适用场景 |
|------|------|-----|------|---------|
| **demo** | SQLite | Mock / 真实 | 无 | 本地体验、快速验证 |
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
# 构建镜像
docker build -t anion .

# 运行 (demo 模式 + MiniMax API)
docker run -d -p 3000:3000 \
  -v anion-data:/app/data \
  -e ANTHROPIC_API_KEY=your-key \
  -e ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic \
  -e ANTHROPIC_MODEL=MiniMax-M2.7 \
  anion
```

数据持久化到 Docker volume `anion-data`，重启不丢失。

---

## 环境变量

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

**AI Provider 优先级**: Anthropic → OpenAI → Mock

---

## 项目结构

```
anion/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── simulator/         # 面试模拟页面
│   ├── report/            # 诊断报告页面
│   └── hub/               # 指挥中心页面
├── components/             # React 组件
├── lib/
│   ├── domain.ts          # 领域模型 (Zod + TypeScript)
│   ├── env.ts             # 环境配置
│   ├── ai/
│   │   ├── adapter.ts     # AI Provider 适配层
│   │   └── errors.ts      # AI 错误处理
│   ├── client/
│   │   └── api.ts         # 客户端 API 封装
│   └── server/
│       ├── auth.ts        # 认证逻辑
│       ├── services/      # 业务服务
│       └── store/         # 数据存储
│           ├── repository.ts
│           └── sqlite.ts
├── tests/                  # Vitest 测试
├── Dockerfile
└── package.json
```

---

## 开发命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 生产构建
pnpm lint         # ESLint 检查
pnpm test         # 运行测试
pnpm test:watch   # 测试监听模式
```

---

## 技术栈

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript 5
- **Validation**: Zod
- **AI**: OpenAI Responses API / Anthropic Messages API
- **Database**: SQLite (demo) / Supabase PostgreSQL (prod)
- **Background Jobs**: Trigger.dev (可选)
- **Testing**: Vitest

---

## License

本仓库核心代码按 `MIT OR Apache-2.0` 双许可证发布，可任选其一使用。

详见 [LICENSE](LICENSE)、[LICENSE-MIT](LICENSE-MIT)、[LICENSE-APACHE](LICENSE-APACHE)。
