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
  industry: z.string().min(2).max(120).optional().default(""),
  level: z.string().min(2).max(60),
  jobDescription: z.string().min(20).max(8000),
  interviewers: z.array(z.string()).min(1).max(4),
  materials: z.array(SessionArtifactRefSchema).default([]),
  candidateName: z.string().max(80).optional().default("Candidate"),
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
  sections: z.array(StrategySectionSchema).length(6),
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
  talkTracks: z.array(z.string()).min(3).max(5),
  scenarioBranches: z.array(SandboxScenarioBranchSchema).default([]),
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

const commonAxes = [
  "Professional Depth",
  "Problem Framing",
  "Communication Efficiency",
  "Pressure Handling",
  "Judgment",
  "Ownership",
];

export const rolePacks: Record<RolePackId, RolePackDefinition> = {
  engineering: {
    id: "engineering",
    label: "Engineering",
    summary:
      "Interviews focused on technical depth, architecture judgment, and pressure-tested causality.",
    tone: "Direct, skeptical, and intolerant of vague answers.",
    interviewers: [
      {
        id: "hacker",
        label: "The Hacker",
        title: "Technical Purist",
        style: "Pushes algorithms, memory, concurrency, and edge conditions.",
        challengeAxis: "Low-level rigor",
        focusSignals: ["low_level", "architecture", "evidence"],
        evidenceDirective:
          "Force the candidate to name the exact algorithmic, memory, concurrency, or complexity boundary.",
        pressureDirective:
          "Interrupt once the answer gets vague. Demand one hard constraint, one concrete mechanism, and one failure case.",
        conflictDirective:
          "Disagree when the trade-off lacks technical proof or when hidden complexity is being ignored.",
      },
      {
        id: "architect",
        label: "The Architect",
        title: "System Architect",
        style: "Pushes end-to-end architecture, bottlenecks, and data flow.",
        challengeAxis: "System design",
        focusSignals: ["architecture", "tradeoff", "ownership"],
        evidenceDirective:
          "Make the candidate map components, interfaces, data flow, failure domains, and degraded-mode behavior.",
        pressureDirective:
          "Collapse the answer onto end-to-end data flow and the first scaling bottleneck.",
        conflictDirective:
          "Challenge anything that sounds locally correct but systemically incomplete.",
      },
      {
        id: "founder",
        label: "The Founder",
        title: "Founder / CEO",
        style: "Pushes value judgment, trade-offs, and commercial instinct.",
        challengeAxis: "Business judgment",
        focusSignals: ["business", "tradeoff", "ownership"],
        evidenceDirective:
          "Force a clear business consequence, a cost boundary, and one decision the candidate would explicitly refuse.",
        pressureDirective:
          "Cut off long setup and demand the call, the downside, and the reason the bet is still worth making.",
        conflictDirective:
          "Create tension when the answer optimizes technical neatness over business leverage or speed.",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["Engineering Intuition", "Systems Resilience"],
    memoryFocus: ["technical gaps", "architecture trade-offs", "communication habits"],
    copilotLens:
      "Assume the user already knows the stack basics; go straight to root cause and repair path.",
    strategyLens:
      "Force technical constraints, delivery sequencing, and cross-functional dependencies into the answer.",
    sandboxLens:
      "Emphasize interface ownership, system boundaries, and technical debt costs.",
  },
  product: {
    id: "product",
    label: "Product",
    summary:
      "Interviews focused on insight quality, prioritization, stakeholder alignment, and execution loops.",
    tone: "Problem definition before solution, metrics before opinion.",
    interviewers: [
      {
        id: "strategist",
        label: "The Strategist",
        title: "Strategy Lead",
        style: "Pushes market clarity, user pain, and opportunity framing.",
        challengeAxis: "Insight quality",
        focusSignals: ["business", "tradeoff", "metrics"],
        evidenceDirective:
          "Demand one target user, one painful job-to-be-done, and one concrete market signal.",
        pressureDirective:
          "Interrupt abstract roadmaps and force the answer back to demand proof and decision quality.",
        conflictDirective:
          "Disagree when the proposed path assumes demand instead of proving it.",
      },
      {
        id: "operator",
        label: "The Operator",
        title: "Execution Partner",
        style: "Pushes owners, metrics, timing, and rollout details.",
        challengeAxis: "Execution discipline",
        focusSignals: ["ownership", "metrics", "process"],
        evidenceDirective:
          "Force explicit owners, deadlines, checkpoints, and what gets measured each week.",
        pressureDirective:
          "Reject plans that do not name execution rhythm, escalation rules, and acceptance criteria.",
        conflictDirective:
          "Challenge any strategy that sounds persuasive but cannot survive real delivery constraints.",
      },
      {
        id: "founder",
        label: "The Founder",
        title: "Founder / CEO",
        style: "Pushes scarce-resource trade-offs and conviction.",
        challengeAxis: "Priority judgment",
        focusSignals: ["business", "ownership", "tradeoff"],
        evidenceDirective:
          "Make the candidate choose what to cut, why the bet is worth the burn, and what they will defend under pushback.",
        pressureDirective:
          "Push toward one irreversible decision and its opportunity cost.",
        conflictDirective:
          "Create conflict when the answer avoids a hard prioritization call.",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["User Insight", "Prioritization"],
    memoryFocus: ["goal framing", "communication structure", "conflict handling"],
    copilotLens:
      "Compress ambiguity into user, problem, decision, and metric as fast as possible.",
    strategyLens:
      "Emphasize demand validation, competitive landscape, and commercial viability.",
    sandboxLens:
      "Emphasize negotiation across teams, trade conditions, and alignment mechanisms.",
  },
  operations: {
    id: "operations",
    label: "Operations",
    summary:
      "Interviews focused on process control, data hygiene, risk reduction, and execution reliability.",
    tone: "Concrete, accountable, and intolerant of vague retrospectives.",
    interviewers: [
      {
        id: "analyst",
        label: "The Analyst",
        title: "Data Analyst",
        style: "Pushes metric definitions, causal attribution, and evidence quality.",
        challengeAxis: "Data judgment",
        focusSignals: ["data", "metrics", "evidence"],
        evidenceDirective:
          "Demand metric definitions, causal evidence, and explicit confidence limits.",
        pressureDirective:
          "Stop any retrospective that has numbers but no attribution logic.",
        conflictDirective:
          "Disagree when results are claimed without clean instrumentation or attribution.",
      },
      {
        id: "operator",
        label: "The Operator",
        title: "Operations Director",
        style: "Pushes SOPs, escalation paths, and response systems.",
        challengeAxis: "Operational rigor",
        focusSignals: ["process", "ownership", "risk"],
        evidenceDirective:
          "Force the operating rhythm, escalation path, rollback rule, and incident owner into the answer.",
        pressureDirective:
          "Interrupt any answer that cannot survive a bad day, a weak handoff, or a broken process.",
        conflictDirective:
          "Challenge ideas that sound smart but are not operationally durable.",
      },
      {
        id: "founder",
        label: "The Founder",
        title: "Founder / CEO",
        style: "Pushes whether results can be protected under ambiguity and pressure.",
        challengeAxis: "Results ownership",
        focusSignals: ["business", "risk", "ownership"],
        evidenceDirective:
          "Force the candidate to state the result line they will own and the loss they will not accept.",
        pressureDirective:
          "Turn soft execution language into a binary accountability test.",
        conflictDirective:
          "Create pressure when the answer hides behind process instead of owning outcomes.",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["Process Governance", "Risk Control"],
    memoryFocus: ["retro quality", "metric hygiene", "execution tempo"],
    copilotLens:
      "Map anomalies to root cause, next action, and tracking metrics immediately.",
    strategyLens:
      "Emphasize feasibility, cost sensitivity, and dependency management.",
    sandboxLens:
      "Emphasize responsibility boundaries, ownership, and escalation paths.",
  },
  management: {
    id: "management",
    label: "Management",
    summary:
      "Interviews focused on leadership, alignment, resource allocation, and difficult decisions.",
    tone: "Human reality and system design over slogans.",
    interviewers: [
      {
        id: "people_leader",
        label: "The People Leader",
        title: "People Leader",
        style: "Pushes team coaching, feedback, and performance handling.",
        challengeAxis: "People leadership",
        focusSignals: ["people", "ownership", "risk"],
        evidenceDirective:
          "Demand the actual conversation, the standard held, and the follow-through after the meeting.",
        pressureDirective:
          "Interrupt slogans and force a concrete leadership intervention.",
        conflictDirective:
          "Disagree when the answer protects harmony at the cost of standards.",
      },
      {
        id: "cross_functional_director",
        label: "Cross-Functional Director",
        title: "Cross-Functional Director",
        style: "Pushes resource conflicts, influence, and alignment.",
        challengeAxis: "Cross-functional control",
        focusSignals: ["ownership", "tradeoff", "people"],
        evidenceDirective:
          "Force the answer to name the stakeholder map, leverage point, and concession boundary.",
        pressureDirective:
          "Collapse the answer onto power, timing, and what happens if alignment fails.",
        conflictDirective:
          "Create disagreement when the answer pretends stakeholder incentives are naturally aligned.",
      },
      {
        id: "founder",
        label: "The Founder",
        title: "Founder / CEO",
        style: "Pushes risk-bearing decisions and consequence ownership.",
        challengeAxis: "Decision accountability",
        focusSignals: ["business", "ownership", "risk"],
        evidenceDirective:
          "Demand one hard call, the downside absorbed, and the reason it still beats the alternatives.",
        pressureDirective:
          "Reject committee language and force a crisp, personal decision boundary.",
        conflictDirective:
          "Challenge any answer that diffuses ownership across the organization.",
      },
    ],
    sharedAxes: commonAxes,
    specialtyAxes: ["Team Maturity", "Resource Negotiation"],
    memoryFocus: ["leadership style", "conflict patterns", "decision bias"],
    copilotLens:
      "Default to team shape, stakeholder incentives, and execution blockers.",
    strategyLens:
      "Emphasize organizational feasibility, resource constraints, and communication cadence.",
    sandboxLens:
      "Emphasize multiplayer equilibrium, short-term versus long-term payoffs, and hard boundaries.",
  },
};

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
