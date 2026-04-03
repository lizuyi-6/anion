function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-GitContent([string]$RepoPath) {
  return (git show "HEAD:$RepoPath" | Out-String)
}

$root = 'X:\github-repos\anion'
Set-Location $root

$interviewDirector = Get-GitContent 'lib/server/services/interview-director.ts'
$interviewDirector = $interviewDirector.Replace('@/lib/domain', '@anion/contracts')
$interviewDirector = $interviewDirector.Replace('@/lib/utils', '@anion/shared/utils')
Write-Utf8NoBom "$root\packages\application\src\interview-director.ts" $interviewDirector

$interview = Get-GitContent 'lib/server/services/interview.ts'
$interviewImportsOld = @"
import type { DataStore } from "@/lib/server/store/repository";
import { getDataStore } from "@/lib/server/store/repository";
import { getAiProvider } from "@/lib/ai/adapter";
"@
$interviewImportsNew = 'import type { ApplicationStore, InterviewAiProvider } from "./ports";' + "`r`n"
$interview = $interview.Replace($interviewImportsOld, $interviewImportsNew)
$interview = $interview.Replace('@/lib/domain', '@anion/contracts')
$interview = $interview.Replace('@/lib/server/services/interview-director', './interview-director')
$interview = $interview.Replace('@/lib/utils', '@anion/shared/utils')
$interview = $interview.Replace('export async function createInterviewSession(viewer: Viewer, config: SessionConfig) {', @"
export async function createInterviewSession(params: {
  store: Pick<ApplicationStore, "createSession" | "setPreferredRolePack" | "appendTurn">;
  viewer: Viewer;
  config: SessionConfig;
}) {
"@)
$interview = $interview.Replace('  const store = await getDataStore({ viewer });', '  const { store, viewer, config } = params;')
$interview = $interview.Replace(@"
export async function generateNextInterviewBeat(params: {
  store: DataStore;
  session: InterviewSession;
  turns: InterviewTurn[];
  answer: string;
}) {
"@, @"
export async function generateNextInterviewBeat(params: {
  store: Pick<ApplicationStore, "appendTurn" | "updateSession">;
  ai: Pick<InterviewAiProvider, "generateInterviewEvent">;
  session: InterviewSession;
  turns: InterviewTurn[];
  answer: string;
}) {
"@)
$interview = $interview.Replace('  const { store, session, turns, answer } = params;', '  const { store, session, turns, answer, ai } = params;')
$interview = $interview.Replace('  const ai = getAiProvider();' + "`r`n", '')
Write-Utf8NoBom "$root\packages\application\src\interview.ts" $interview

$commandCenter = Get-GitContent 'lib/server/services/command-center.ts'
$commandCenterImportsOld = @"
import { getAiProvider } from "@/lib/ai/adapter";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
  CommandThread,
  SandboxTurnEvent,
  UploadReference,
  Viewer,
} from "@/lib/domain";
import { formatCommandModeLabel } from "@/lib/domain";
import type { DataStore } from "@/lib/server/store/repository";
import { summarizeText, toId } from "@/lib/utils";
"@
$commandCenterImportsNew = @"
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
  CommandThread,
  SandboxTurnEvent,
  UploadReference,
  Viewer,
} from "@anion/contracts";
import { formatCommandModeLabel } from "@anion/contracts";
import { summarizeText, toId } from "@anion/shared/utils";

import type { ApplicationStore, CommandAiProvider } from "./ports";
"@
$commandCenter = $commandCenter.Replace($commandCenterImportsOld, $commandCenterImportsNew)
$commandCenter = $commandCenter.Replace('  store: DataStore;', '  store: Pick<ApplicationStore, "getThread" | "createThread">;')
$commandCenter = $commandCenter.Replace(@"
export async function runCommandMode(params: {
  store: DataStore;
  viewer: Viewer;
  mode: CommandMode;
  threadId?: string;
  sessionId?: string;
  input: string;
  attachments: UploadReference[];
  memoryContext: ActiveMemoryContext | null;
}) {
  const ai = getAiProvider();
"@, @"
export async function runCommandMode(params: {
  store: Pick<
    ApplicationStore,
    "getThread" | "createThread" | "listCommandMessages" | "appendCommandMessage" | "saveArtifact"
  >;
  ai: Pick<CommandAiProvider, "generateCommandArtifact">;
  viewer: Viewer;
  mode: CommandMode;
  threadId?: string;
  sessionId?: string;
  input: string;
  attachments: UploadReference[];
  memoryContext: ActiveMemoryContext | null;
}) {
"@)
$commandCenter = $commandCenter.Replace('  const artifact = await ai.generateCommandArtifact({', '  const artifact = await params.ai.generateCommandArtifact({')
$commandCenter = $commandCenter.Replace(@"
export async function generateSandboxBeat(params: {
  store: DataStore;
  viewer: Viewer;
  threadId: string;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  memoryContext: ActiveMemoryContext | null;
}): Promise<SandboxTurnEvent> {
  const ai = getAiProvider();
"@, @"
export async function generateSandboxBeat(params: {
  store: Pick<ApplicationStore, "listCommandMessages" | "appendCommandMessage">;
  ai: Pick<CommandAiProvider, "generateSandboxTurn">;
  viewer: Viewer;
  threadId: string;
  userMessage: string;
  counterpartRole: string;
  counterpartIncentives: string;
  userRedLine: string;
  memoryContext: ActiveMemoryContext | null;
}): Promise<SandboxTurnEvent> {
"@)
$commandCenter = $commandCenter.Replace('  const event = await ai.generateSandboxTurn({', '  const event = await params.ai.generateSandboxTurn({')
Write-Utf8NoBom "$root\packages\application\src\command-center.ts" $commandCenter

$adapter = Get-GitContent 'lib/ai/adapter.ts'
$adapter = $adapter.Replace('@/lib/ai/errors', './errors')
$adapter = $adapter.Replace('import { hasOpenAi, hasAnthropic, runtimeEnv } from "@/lib/env";', 'import { hasMiniMax, hasOpenAi, hasAnthropic, runtimeEnv } from "@anion/config";')
$adapter = $adapter.Replace('@/lib/domain', '@anion/contracts')
$adapter = $adapter.Replace('@/lib/utils', '@anion/shared/utils')
$adapter = $adapter.Replace('  provider: "mock" | "openai" | "anthropic";', '  provider: "mock" | "openai" | "anthropic" | "minimax";')
$providerBlockOld = @"
let _provider: AiProviderAdapter | undefined;

export function getAiProvider(): AiProviderAdapter {
  if (!_provider) {
    if (hasAnthropic()) {
      _provider = new AnthropicProvider();
    } else if (hasOpenAi()) {
      _provider = new OpenAiProvider();
    } else {
      _provider = new MockAiProvider();
    }
  }
  return _provider;
}
"@
$providerBlockNew = @"
let _provider: AiProviderAdapter | undefined;

export function getAiProvider(): AiProviderAdapter {
  if (!_provider) {
    if (hasAnthropic()) {
      _provider = new AnthropicProvider();
    } else if (hasOpenAi()) {
      _provider = new OpenAiProvider();
    } else if (hasMiniMax()) {
      _provider = new MockAiProvider();
    } else {
      _provider = new MockAiProvider();
    }
  }
  return _provider;
}
"@
$adapter = $adapter.Replace($providerBlockOld, $providerBlockNew)
Write-Utf8NoBom "$root\packages\infrastructure\src\ai\adapter.ts" $adapter
