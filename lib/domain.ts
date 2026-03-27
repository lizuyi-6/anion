import { z } from "zod";

export const runtimeModes = ["demo", "supabase"] as const;
export const rolePackIds = [
  "engineering",
  "product",
  "operations",
  "management",
] as const;
export const sessionStatuses = [
  "draft",
  "live",
  "analyzing",
  "report_ready",
  "accepted",
  "hub_active",
] as const;
export const commandModes = ["copilot", "strategy", "sandbox"] as const;
export const eventKinds = [
  "question",
  "follow_up",
  "interrupt",
  "conflict",
  "system",
] as const;
export const artifactProviders = ["memory", "supabase"] as const;
export const artifactKinds = [
  "resume",
  "portfolio",
  "job_description",
  "log",
  "document",
  "attachment",
] as const;
export const memoryEvidenceKinds = [
  "skill",
  "gap",
  "behavior",
  "win",
] as const;

export type RuntimeMode = (typeof runtimeModes)[number];
export type RolePackId = (typeof rolePackIds)[number];
export type SessionStatus = (typeof sessionStatuses)[number];
export type CommandMode = (typeof commandModes)[number];
export type LiveTurnKind = (typeof eventKinds)[number];

export const SessionArtifactRefSchema = z.object({
  id: z.string(),
  kind: z.enum(artifactKinds).default("attachment"),
  provider: z.enum(artifactProviders).default("memory"),
  path: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  originalName: z.string(),
  uploadedAt: z.string(),
  textContent: z.string().optional(),
  base64Data: z.string().optional(),
  openAiFileId: z.string().optional(),
});

export const UploadReferenceSchema = SessionArtifactRefSchema;
export type UploadReference = z.infer<typeof UploadReferenceSchema>;

export const SessionConfigSchema = z.object({
  rolePack: z.enum(rolePackIds),
  targetCompany: z.string().min(2).max(120),
  industry: z.string().min(0).max(120).default(""),
  level: z.string().min(2).max(60),
  jobDescription: z.string().min(20).max(8000),
  interviewers: z.array(z.string()).min(1).max(4),
  materials: z.array(SessionArtifactRefSchema).default([]),
  candidateName: z.string().max(80).optional().default("候选人"),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export const DirectorStateSchema = z.object({
  openLoops: z.array(z.string()).default([]),
  pressureScore: z.number().min(0).max(100).default(42),
  conflictBudget: z.number().int().min(0).max(8).default(2),
  nextSpeakerId: z.string(),
  needsInterrupt: z.boolean().default(false),
  needsConflict: z.boolean().default(false),
  round: z.number().int().min(0).default(0),
  latestAssessment: z.string().default(""),
});

export type DirectorState = z.infer<typeof DirectorStateSchema>;

export const InterviewSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.enum(sessionStatuses),
  config: SessionConfigSchema,
  directorState: DirectorStateSchema,
  currentPressure: z.number().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
  acceptedAt: z.string().optional(),
  reportId: z.string().optional(),
  memoryProfileId: z.string().optional(),
  analysisJobId: z.string().optional(),
  analysisError: z.string().optional(),
  analysisStartedAt: z.string().optional(),
  analysisCompletedAt: z.string().optional(),
});

export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export const InterviewTurnSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["candidate", "interviewer", "system"]),
  speakerId: z.string(),
  speakerLabel: z.string(),
  kind: z.enum(eventKinds),
  content: z.string(),
  meta: z.record(z.string(), z.unknown()).default({}),
  sequence: z.number().int().min(0),
  createdAt: z.string(),
});

export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

export const LiveTurnEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: z.enum(eventKinds),
  speakerId: z.string(),
  speakerLabel: z.string(),
  pressureDelta: z.number().min(-20).max(30),
  message: z.string(),
  rationale: z.string(),
  timestamp: z.string(),
});

export type LiveTurnEvent = z.infer<typeof LiveTurnEventSchema>;

export const ReportScoreSchema = z.object({
  key: z.string(),
  label: z.string(),
  score: z.number().min(0).max(100),
  signal: z.string(),
});

export const DiagnosticFindingSchema = z.object({
  title: z.string(),
  severity: z.enum(["critical", "major", "medium", "minor"]),
  category: z.string(),
  detail: z.string(),
  recommendation: z.string(),
  evidenceTurnIds: z.array(z.string()).default([]),
  impact: z.string(),
});

export const DiagnosticEvidenceAnchorSchema = z.object({
  id: z.string(),
  label: z.string(),
  excerpt: z.string(),
  sourceTurnId: z.string(),
  speakerLabel: z.string(),
  note: z.string(),
});

export const StarStorySchema = z.object({
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
});

export const DiagnosticReportSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  scores: z.array(ReportScoreSchema).min(8),
  evidence: z.array(z.string()).min(3),
  evidenceAnchors: z.array(DiagnosticEvidenceAnchorSchema).default([]),
  findings: z.array(DiagnosticFindingSchema).min(1),
  starStories: z.array(StarStorySchema).min(1),
  trainingPlan: z.array(z.string()).min(3),
  generatedAt: z.string(),
});

export type DiagnosticReport = z.infer<typeof DiagnosticReportSchema>;

export const MemoryNodeSchema = z.object({
  label: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  sourceTurnIds: z.array(z.string()).default([]),
});

export const EvidenceSpanSchema = z.object({
  label: z.string(),
  excerpt: z.string(),
  sourceTurnId: z.string(),
});

export const MemoryReplayMomentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  title: z.string(),
  summary: z.string(),
  sourceTurnIds: z.array(z.string()).default([]),
  createdAt: z.string(),
});

export const MemoryProfileSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  skills: z.array(MemoryNodeSchema).min(1),
  gaps: z.array(MemoryNodeSchema).min(1),
  behaviorTraits: z.array(MemoryNodeSchema).min(1),
  wins: z.array(MemoryNodeSchema).min(1),
  evidenceSpans: z.array(EvidenceSpanSchema).min(1),
  replayMoments: z.array(MemoryReplayMomentSchema).default([]),
  generatedAt: z.string(),
});

export type MemoryProfile = z.infer<typeof MemoryProfileSchema>;

export const MemoryEvidenceSchema = z.object({
  id: z.string(),
  memoryProfileId: z.string(),
  userId: z.string(),
  label: z.string(),
  summary: z.string(),
  kind: z.enum(memoryEvidenceKinds),
  confidence: z.number().min(0).max(1),
  sourceTurnIds: z.array(z.string()).default([]),
  embedding: z.array(z.number()).optional(),
  createdAt: z.string(),
});

export type MemoryEvidence = z.infer<typeof MemoryEvidenceSchema>;

export const ActiveMemoryContextSchema = z.object({
  profile: MemoryProfileSchema,
  evidence: z.array(MemoryEvidenceSchema),
  relatedProfiles: z.array(MemoryProfileSchema).default([]),
  timeline: z.array(MemoryReplayMomentSchema).default([]),
});

export type ActiveMemoryContext = z.infer<typeof ActiveMemoryContextSchema>;

export const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  lane: z.number().int().min(0).max(5),
});

export const DiagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string(),
});

export const DiagramSpecSchema = z.object({
  nodes: z.array(DiagramNodeSchema).min(2),
  edges: z.array(DiagramEdgeSchema).min(1),
});

export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;

export const TimelineItemSchema = z.object({
  phase: z.string(),
  startWeek: z.number().int().min(1),
  durationWeeks: z.number().int().min(1),
  owner: z.string(),
});

export const TimelineSpecSchema = z.object({
  items: z.array(TimelineItemSchema).min(1),
});

export type TimelineSpec = z.infer<typeof TimelineSpecSchema>;

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
});

export const StrategySectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const StrategyReportSchema = z.object({
  id: z.string(),
  mode: z.literal("strategy"),
  sections: z.array(StrategySectionSchema).min(4).max(8),
  citations: z.array(CitationSchema).default([]),
  diagramSpec: DiagramSpecSchema,
  timelineSpec: TimelineSpecSchema,
  risks: z.array(z.string()).min(2),
  deliverables: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export type StrategyReport = z.infer<typeof StrategyReportSchema>;

export const SandboxScenarioBranchSchema = z.object({
  name: z.string(),
  ifYouPush: z.string(),
  ifYouConcede: z.string(),
  signalToWatch: z.string(),
});

export const SandboxOutcomeSchema = z.object({
  id: z.string(),
  mode: z.literal("sandbox"),
  counterpartModel: z.object({
    style: z.string(),
    incentives: z.array(z.string()).min(2),
    redLines: z.array(z.string()).min(2),
  }),
  equilibrium: z.string(),
  recommendedMove: z.string(),
  longTermCost: z.string(),
  pressurePoints: z.array(z.string()).default([]),
  talkTracks: z.array(z.string()).min(2).max(8),
  scenarioBranches: z.array(SandboxScenarioBranchSchema).default([]),
  payoffMatrix: z.object({
    rowHeader: z.string(),
    colHeader: z.string(),
    rows: z.array(z.object({
      label: z.string(),
      payoffs: z.array(z.string()),
    })).min(2),
    nashEquilibrium: z.string(),
  }).optional(),
});

export type SandboxOutcome = z.infer<typeof SandboxOutcomeSchema>;

export const CopilotResponseSchema = z.object({
  id: z.string(),
  mode: z.literal("copilot"),
  rootCause: z.string(),
  shortestFix: z.array(z.string()).min(2),
  optionalRefactors: z.array(z.string()).min(1),
  memoryAnchor: z.string(),
  watchouts: z.array(z.string()).default([]),
  techForesight: z.array(z.object({
    technology: z.string(),
    risk: z.enum(["high", "medium", "low"]),
    timeline: z.string(),
    recommendation: z.string(),
  })).default([]),
});

export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;

export const CommandArtifactSchema = z.union([
  CopilotResponseSchema,
  StrategyReportSchema,
  SandboxOutcomeSchema,
]);

export type CommandArtifact = z.infer<typeof CommandArtifactSchema>;

export const CommandMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  mode: z.enum(commandModes),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  attachments: z.array(SessionArtifactRefSchema).default([]),
  artifact: CommandArtifactSchema.optional(),
  createdAt: z.string(),
});

export type CommandMessage = z.infer<typeof CommandMessageSchema>;

export const CommandThreadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mode: z.enum(commandModes),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionId: z.string().optional(),
});

export type CommandThread = z.infer<typeof CommandThreadSchema>;

export const ViewerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  isDemo: z.boolean(),
  workspaceMode: z.enum(["interview", "command_center"]),
  preferredRolePack: z.enum(rolePackIds),
  email: z.string().email().optional(),
});

export type Viewer = z.infer<typeof ViewerSchema>;

export const CreateSessionInputSchema = SessionConfigSchema;

export const TurnRequestSchema = z.object({
  answer: z.string().min(1).max(8000),
  elapsedSeconds: z.number().int().min(0).max(3600).optional().default(0),
});

export const CompleteSessionInputSchema = z.object({
  finalNote: z.string().max(1000).optional().default(""),
});

export const CommandRequestSchema = z.object({
  threadId: z.string().optional(),
  input: z.string().min(4).max(12000),
  attachments: z.array(SessionArtifactRefSchema).default([]),
});

export const SandboxTurnRequestSchema = z.object({
  threadId: z.string(),
  userMessage: z.string().min(1).max(4000),
  counterpartRole: z.string().min(1).max(200),
  counterpartIncentives: z.string().min(1).max(500),
  userRedLine: z.string().min(1).max(500),
});

export const SandboxTurnEventSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  counterpartMessage: z.string(),
  counterpartTone: z.string(),
  strategicCommentary: z.string(),
  pressureLevel: z.number().min(0).max(10),
  timestamp: z.string(),
});

export type SandboxTurnEvent = z.infer<typeof SandboxTurnEventSchema>;

export type RolePackDefinition = {
  id: RolePackId;
  label: string;
  summary: string;
  tone: string;
  interviewers: Array<{
    id: string;
    label: string;
    title: string;
    style: string;
    challengeAxis: string;
    focusSignals: string[];
    evidenceDirective: string;
    pressureDirective: string;
    conflictDirective: string;
  }>;
  sharedAxes: string[];
  specialtyAxes: string[];
  memoryFocus: string[];
  copilotLens: string;
  strategyLens: string;
  sandboxLens: string;
};

const commonAxes = ["专业深度", "问题框定", "沟通效率", "压力应对", "判断力", "主人翁意识"];

export const rolePacks: Record<RolePackId, RolePackDefinition> = {
  engineering: {
    id: "engineering",
    label: "工程",
    summary: "聚焦技术深度、架构判断与高压下因果解释能力的面试。",
    tone: "直接、怀疑、不能容忍含糊回答。",
    interviewers: [
      {
        id: "hacker",
        label: "黑客",
        title: "技术洁癖者",
        style: "追问算法、内存、并发与边界条件。",
        challengeAxis: "底层严谨性",
        focusSignals: ["low_level", "architecture", "evidence"],
        evidenceDirective: "逼候选人说清楚具体的算法、内存、并发或复杂度边界。",
        pressureDirective: "一旦答案开始发虚就打断，要求一个硬约束、一个具体机制和一个失败案例。",
        conflictDirective: "当取舍缺少技术证据，或隐藏复杂度被忽略时，直接提出异议。",
      },
      {
        id: "architect",
        label: "架构师",
        title: "系统架构师",
        style: "追问端到端架构、瓶颈和数据流。",
        challengeAxis: "系统设计",
        focusSignals: ["architecture", "tradeoff", "ownership"],
        evidenceDirective: "要求候选人画清组件、接口、数据流、故障域和降级路径。",
        pressureDirective: "把答案压回到端到端数据流和第一个扩展性瓶颈上。",
        conflictDirective: "凡是局部正确但系统上不完整的说法，都要当场挑战。",
      },
      {
        id: "founder",
        label: "创始人",
        title: "创始人 / 首席执行官",
        style: "追问价值判断、取舍和商业直觉。",
        challengeAxis: "商业判断",
        focusSignals: ["business", "tradeoff", "ownership"],
        evidenceDirective: "要求给出清晰的业务后果、成本边界，以及一个明确拒绝做的决定。",
        pressureDirective: "砍掉冗长铺垫，直接要判断、代价，以及为什么这笔赌注仍值得下。",
        conflictDirective: "当答案过度追求技术整洁而忽视业务杠杆和速度时，制造张力。",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["工程直觉", "系统韧性"],
    memoryFocus: ["技术短板", "架构取舍", "沟通习惯"],
    copilotLens: "默认用户已经懂栈内基础，直接切到根因和修复路径。",
    strategyLens: "强制把技术约束、交付节奏和跨团队依赖写进答案。",
    sandboxLens: "强调接口所有权、系统边界与技术债成本。",
  },
  product: {
    id: "product",
    label: "产品",
    summary: "聚焦洞察质量、优先级、协同对齐和执行闭环的面试。",
    tone: "先定义问题，再谈方案；先看指标，再谈观点。",
    interviewers: [
      {
        id: "strategist",
        label: "战略家",
        title: "战略负责人",
        style: "追问市场清晰度、用户痛点和机会框定。",
        challengeAxis: "洞察质量",
        focusSignals: ["business", "tradeoff", "metrics"],
        evidenceDirective: "要求一个目标用户、一个痛点任务，以及一个明确的市场信号。",
        pressureDirective: "打断抽象路线图，把答案拉回需求证据和决策质量。",
        conflictDirective: "当方案建立在假设需求而不是证明需求上时，直接反对。",
      },
      {
        id: "operator",
        label: "操盘手",
        title: "执行伙伴",
        style: "追问责任人、指标、节奏和发布细节。",
        challengeAxis: "执行纪律",
        focusSignals: ["ownership", "metrics", "process"],
        evidenceDirective: "要求明确 owner、截止时间、检查点，以及每周看什么指标。",
        pressureDirective: "凡是不写执行节奏、升级规则和验收标准的计划，一律打回。",
        conflictDirective: "任何听起来有说服力但扛不住真实交付约束的策略，都要质疑。",
      },
      {
        id: "founder",
        label: "创始人",
        title: "创始人 / 首席执行官",
        style: "追问资源稀缺下的取舍和下注决心。",
        challengeAxis: "优先级判断",
        focusSignals: ["business", "ownership", "tradeoff"],
        evidenceDirective: "要求候选人明确砍什么、为什么值得烧这笔钱，以及在强压下会守住什么。",
        pressureDirective: "把讨论推向一个不可逆决策及其机会成本。",
        conflictDirective: "当答案回避艰难优先级判断时，主动制造冲突。",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["用户洞察", "优先级判断"],
    memoryFocus: ["目标框定", "沟通结构", "冲突处理"],
    copilotLens: "尽快把模糊问题压缩成用户、问题、决策和指标。",
    strategyLens: "强调需求验证、竞争格局和商业可行性。",
    sandboxLens: "强调跨团队博弈、交换条件和对齐机制。",
  },
  operations: {
    id: "operations",
    label: "运营",
    summary: "聚焦流程控制、数据卫生、风险收敛和执行可靠性的面试。",
    tone: "具体、可追责，无法容忍空泛复盘。",
    interviewers: [
      {
        id: "analyst",
        label: "分析师",
        title: "数据分析师",
        style: "追问指标定义、因果归因和证据质量。",
        challengeAxis: "数据判断",
        focusSignals: ["data", "metrics", "evidence"],
        evidenceDirective: "要求候选人讲清指标定义、因果证据和置信边界。",
        pressureDirective: "任何只有数字没有归因逻辑的复盘，立刻打断。",
        conflictDirective: "当结果宣称缺少干净埋点或归因时，直接反对。",
      },
      {
        id: "operator",
        label: "操盘手",
        title: "运营负责人",
        style: "追问 SOP、升级路径和响应体系。",
        challengeAxis: "运营严谨性",
        focusSignals: ["process", "ownership", "risk"],
        evidenceDirective: "把运转节奏、升级路径、回滚规则和事故 owner 都逼出来。",
        pressureDirective: "凡是扛不住坏天、弱交接或流程断裂的答案，一律打断。",
        conflictDirective: "任何听起来聪明但不具备运营耐久性的想法，都要挑战。",
      },
      {
        id: "founder",
        label: "创始人",
        title: "创始人 / 首席执行官",
        style: "追问在模糊和高压下是否还能守住结果。",
        challengeAxis: "结果归属",
        focusSignals: ["business", "risk", "ownership"],
        evidenceDirective: "要求候选人明确自己守哪条结果线，以及什么损失绝不接受。",
        pressureDirective: "把软性的执行表述压成二选一的问责测试。",
        conflictDirective: "当答案躲在流程后面而不真正承担结果时，主动施压。",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["流程治理", "风险控制"],
    memoryFocus: ["复盘质量", "指标卫生", "执行节奏"],
    copilotLens: "第一时间把异常映射到根因、下一步动作和跟踪指标。",
    strategyLens: "强调可行性、成本敏感性和依赖管理。",
    sandboxLens: "强调责任边界、owner 和升级路径。",
  },
  management: {
    id: "management",
    label: "管理",
    summary: "聚焦领导力、对齐能力、资源分配和艰难决策的面试。",
    tone: "重视人的现实和系统设计，轻视口号。",
    interviewers: [
      {
        id: "people_leader",
        label: "带人者",
        title: "团队管理者",
        style: "追问带教、反馈和绩效处理。",
        challengeAxis: "带人能力",
        focusSignals: ["people", "ownership", "risk"],
        evidenceDirective: "要求讲清真实对话、坚持的标准，以及会后如何跟进。",
        pressureDirective: "打断口号式表述，逼出一个具体的管理干预动作。",
        conflictDirective: "当答案为了和气牺牲标准时，明确反对。",
      },
      {
        id: "cross_functional_director",
        label: "跨部门负责人",
        title: "跨部门负责人",
        style: "追问资源冲突、影响力和协同对齐。",
        challengeAxis: "跨部门控制力",
        focusSignals: ["ownership", "tradeoff", "people"],
        evidenceDirective: "要求点名利益相关方地图、杠杆点和让步边界。",
        pressureDirective: "把答案压回到权力、时机，以及对齐失败会怎样。",
        conflictDirective: "当答案假设各方激励天然一致时，主动制造分歧。",
      },
      {
        id: "founder",
        label: "创始人",
        title: "创始人 / 首席执行官",
        style: "追问承担风险的决策和后果归属。",
        challengeAxis: "决策问责",
        focusSignals: ["business", "ownership", "risk"],
        evidenceDirective: "要求给出一个硬决策、承受的代价，以及为什么它仍优于其他方案。",
        pressureDirective: "拒绝委员会式语言，逼出清晰的个人决策边界。",
        conflictDirective: "任何把责任稀释到组织里的答案，都要挑战。",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["团队成熟度", "资源谈判"],
    memoryFocus: ["领导风格", "冲突模式", "决策偏差"],
    copilotLens: "默认从团队形态、利益激励和执行阻塞切入。",
    strategyLens: "强调组织可行性、资源约束和沟通节奏。",
    sandboxLens: "强调多人博弈、短中长期收益和硬边界。",
  },
};

const sessionStatusLabels: Record<SessionStatus, string> = {
  draft: "草稿",
  live: "进行中",
  analyzing: "分析中",
  report_ready: "报告就绪",
  accepted: "已接受录用",
  hub_active: "指挥中心已激活",
};

const findingSeverityLabels = {
  critical: "致命",
  major: "重大",
  medium: "中等",
  minor: "次要",
} as const;

const findingCategoryLabels: Record<string, string> = {
  communication: "沟通",
  engineering: "工程",
  product: "产品",
  behavior: "行为",
  business: "业务",
  data: "数据",
  leadership: "领导力",
  operations: "运营",
  risk: "风险",
};

const commandModeLabels: Record<CommandMode, string> = {
  copilot: "副驾",
  strategy: "战略",
  sandbox: "沙盒",
};

export function formatRolePackLabel(rolePackId: RolePackId) {
  return rolePacks[rolePackId].label;
}

export function formatSessionStatus(status: SessionStatus) {
  return sessionStatusLabels[status];
}

export function formatFindingSeverity(
  severity: z.infer<typeof DiagnosticFindingSchema>["severity"],
) {
  return findingSeverityLabels[severity];
}

export function formatFindingCategory(category: string) {
  return findingCategoryLabels[category] ?? category;
}

export function formatCommandModeLabel(mode: CommandMode) {
  return commandModeLabels[mode];
}

export function getRolePack(rolePackId: RolePackId) {
  return rolePacks[rolePackId];
}

export function getInterviewerDefinition(
  rolePackId: RolePackId,
  interviewerId: string,
) {
  return getRolePack(rolePackId).interviewers.find(
    (interviewer) => interviewer.id === interviewerId,
  );
}
