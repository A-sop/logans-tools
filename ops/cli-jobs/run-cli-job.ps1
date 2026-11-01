<#
.SYNOPSIS
  Run one unattended Cursor CLI job from a prompt file (HZR52).
.DESCRIPTION
  Lock per job name. Writes <jobs-root>/<job>/<ts>/{report.md,status.json,run.log}.
  Never echoes the agent command line (may carry keys). RR-010 item 4.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string] $JobName = '',
  [Parameter(Position = 1)]
  [string] $PromptFile = '',
  [Alias('workdir')]
  [string] $WorkDir = '',
  [string] $JobsRoot = '',
  [string] $AgentPs1 = '',
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Rest = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$i = 0
while ($i -lt @($Rest).Count) {
  if ($Rest[$i] -eq '--workdir' -or $Rest[$i] -eq '-workdir') {
    if ($i + 1 -ge $Rest.Count) { throw '--workdir needs a path' }
    $WorkDir = $Rest[$i + 1]
    $i += 2
    continue
  }
  if (-not $JobName) { $JobName = $Rest[$i]; $i++; continue }
  if (-not $PromptFile) { $PromptFile = $Rest[$i]; $i++; continue }
  throw "unknown argument: $($Rest[$i])"
}

if (-not $JobName -or -not $PromptFile) {
  Write-Host 'usage: run-cli-job <job-name> <prompt-file> [--workdir <path>]'
  exit 64
}
if ($JobName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$') {
  throw "invalid job name: $JobName"
}
if (-not (Test-Path -LiteralPath $PromptFile)) {
  throw "prompt file not found: $PromptFile"
}
$PromptFile = (Resolve-Path -LiteralPath $PromptFile).Path

if (-not $JobsRoot) {
  $JobsRoot = Join-Path $env:LOCALAPPDATA 'dabos\cli-jobs'
}
if (-not $AgentPs1) {
  $candidate = Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.ps1'
  if (Test-Path -LiteralPath $candidate) {
    $AgentPs1 = $candidate
  } else {
    $AgentPs1 = 'C:\Users\LDW_HZR52\AppData\Local\cursor-agent\agent.ps1'
  }
}
if (-not (Test-Path -LiteralPath $AgentPs1)) {
  throw 'Cursor agent CLI not found (expected Local\cursor-agent\agent.ps1)'
}
if (-not $WorkDir) { $WorkDir = (Get-Location).Path }
if (-not (Test-Path -LiteralPath $WorkDir)) { throw "workdir not found: $WorkDir" }
$WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path

$ts = Get-Date -Format 'yyyyMMddTHHmmss'
$runDir = Join-Path $JobsRoot (Join-Path $JobName $ts)
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$reportPath = Join-Path $runDir 'report.md'
$statusPath = Join-Path $runDir 'status.json'
$logPath = Join-Path $runDir 'run.log'
$lockDir = Join-Path $JobsRoot '_locks'
New-Item -ItemType Directory -Force -Path $lockDir | Out-Null
$lockPath = Join-Path $lockDir ($JobName + '.lock')

function Write-Status([hashtable] $obj) {
  ($obj | ConvertTo-Json -Compress) | Set-Content -LiteralPath $statusPath -Encoding utf8
}

$lockStream = $null
try {
  $lockStream = [System.IO.File]::Open(
    $lockPath,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
} catch {
  Write-Status @{
    job = $JobName
    exit_code = 75
    error = 'lock-busy'
    host = $env:COMPUTERNAME
    started_at = (Get-Date).ToUniversalTime().ToString('o')
    ended_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  Add-Content -LiteralPath $logPath -Value 'lock-busy' -Encoding utf8
  exit 75
}

$started = (Get-Date).ToUniversalTime().ToString('o')
Write-Status @{
  job = $JobName
  exit_code = $null
  host = $env:COMPUTERNAME
  workdir = $WorkDir
  prompt_path = $PromptFile
  started_at = $started
  ended_at = $null
  report = $reportPath
}
Add-Content -LiteralPath $logPath -Value ("started job=" + $JobName) -Encoding utf8

$exitCode = 1
try {
  # Prompt path is passed as the agent prompt: "Execute the prompt file at <path> exactly."
  # Avoid putting prompt body or API keys on an argv we might accidentally log.
  $agentPrompt = "Read the prompt file at $PromptFile and carry it out completely. Work in $WorkDir. Write nothing that contains secrets."
  $outFile = Join-Path $runDir 'stdout.txt'
  $errFile = Join-Path $runDir 'stderr.txt'
  # Start-Process: do not Write-Host the argument list.
  $p = Start-Process -FilePath 'powershell.exe' `
    -WorkingDirectory $WorkDir `
    -PassThru -Wait -NoNewWindow `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile `
    -ArgumentList @(
      '-NoProfile',
      '-File', $AgentPs1,
      '-p',
      '--force',
      '--output-format', 'text',
      '--',
      $agentPrompt
    )
  $exitCode = $p.ExitCode
  if (Test-Path -LiteralPath $outFile) {
    Copy-Item -LiteralPath $outFile -Destination $reportPath -Force
  } else {
    Set-Content -LiteralPath $reportPath -Value '# no stdout' -Encoding utf8
  }
  if (Test-Path -LiteralPath $errFile) {
    $errLen = (Get-Item -LiteralPath $errFile).Length
    Add-Content -LiteralPath $logPath -Value ("stderr_bytes=" + $errLen) -Encoding utf8
  }
  Add-Content -LiteralPath $logPath -Value ("ended exit=" + $exitCode) -Encoding utf8
} catch {
  Add-Content -LiteralPath $logPath -Value 'run-failed' -Encoding utf8
  $exitCode = 1
  if (-not (Test-Path -LiteralPath $reportPath)) {
    Set-Content -LiteralPath $reportPath -Value '# run failed before report' -Encoding utf8
  }
} finally {
  $ended = (Get-Date).ToUniversalTime().ToString('o')
  Write-Status @{
    job = $JobName
    exit_code = $exitCode
    host = $env:COMPUTERNAME
    workdir = $WorkDir
    prompt_path = $PromptFile
    started_at = $started
    ended_at = $ended
    report = $reportPath
  }
  if ($null -ne $lockStream) { $lockStream.Dispose() }
}

exit $exitCode
