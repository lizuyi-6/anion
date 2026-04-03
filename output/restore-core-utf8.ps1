function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$root = 'X:\github-repos\anion'
Set-Location $root

$interviewDirector = git -c i18n.logOutputEncoding=utf8 show HEAD:lib/server/services/interview-director.ts | Out-String
$interviewDirector = $interviewDirector.Replace('@/lib/domain', '@anion/contracts')
$interviewDirector = $interviewDirector.Replace('@/lib/utils', '@anion/shared/utils')
Write-Utf8NoBom "$root\packages\application\src\interview-director.ts" $interviewDirector

$interview = git -c i18n.logOutputEncoding=utf8 show HEAD:lib/server/services/interview.ts | Out-String
$interview = $interview.Replace('@/lib/domain', '@anion/contracts')
$interview = $interview.Replace('@/lib/server/services/interview-director', './interview-director')
$interview = $interview.Replace('@/lib/utils', '@anion/shared/utils')
Write-Utf8NoBom "$root\packages\application\src\interview.ts" $interview

$commandCenter = git -c i18n.logOutputEncoding=utf8 show HEAD:lib/server/services/command-center.ts | Out-String
$commandCenter = $commandCenter.Replace('@/lib/domain', '@anion/contracts')
$commandCenter = $commandCenter.Replace('@/lib/utils', '@anion/shared/utils')
Write-Utf8NoBom "$root\packages\application\src\command-center.ts" $commandCenter

$adapter = git -c i18n.logOutputEncoding=utf8 show HEAD:lib/ai/adapter.ts | Out-String
$adapter = $adapter.Replace('@/lib/ai/errors', './errors')
$adapter = $adapter.Replace('@/lib/domain', '@anion/contracts')
$adapter = $adapter.Replace('@/lib/utils', '@anion/shared/utils')
$adapter = $adapter.Replace('import { hasOpenAi, hasAnthropic, runtimeEnv } from "@/lib/env";', 'import { hasMiniMax, hasOpenAi, hasAnthropic, runtimeEnv } from "@anion/config";')
Write-Utf8NoBom "$root\packages\infrastructure\src\ai\adapter.ts" $adapter
