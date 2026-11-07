<#
.SYNOPSIS
  Run one unattended Cursor CLI job from a prompt file (HZR52).
.DESCRIPTION
  Lock per job name. Writes <jobs-root>/<job>/<run-id>/{report.md,status.json,run.log}.
  Never echoes the agent command line (may carry keys). RR-010 item 4.
  Configurable timeout (default 1800s) kills the process tree and records timeout status.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string] $JobName = '',
  [Parameter(Position = 1)]
  [string] $PromptFile = '',
  [string] $WorkDir = '',
  [string] $JobsRoot = '',
  [string] $AgentPs1 = '',
  [int] $TimeoutSec = 0,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Rest = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Escape-ProcessArg([string] $Value) {
  # Quote for CreateProcess / CommandLineToArgvW. Do NOT double path backslashes.
  if ($null -eq $Value) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + ($Value -replace '"', '""') + '"'
}

$i = 0
while ($i -lt @($Rest).Count) {
  if ($Rest[$i] -eq '--workdir' -or $Rest[$i] -eq '-workdir') {
    if ($i + 1 -ge $Rest.Count) { throw '--workdir needs a path' }
    $WorkDir = $Rest[$i + 1]
    $i += 2
    continue
  }
  if ($Rest[$i] -eq '--timeout' -or $Rest[$i] -eq '-timeout') {
    if ($i + 1 -ge $Rest.Count) { throw '--timeout needs seconds' }
    $TimeoutSec = [int]$Rest[$i + 1]
    $i += 2
    continue
  }
  if (-not $JobName) { $JobName = $Rest[$i]; $i++; continue }
  if (-not $PromptFile) { $PromptFile = $Rest[$i]; $i++; continue }
  throw "unknown argument: $($Rest[$i])"
}

if (-not $JobName -or -not $PromptFile) {
  Write-Host 'usage: run-cli-job <job-name> <prompt-file> [--workdir <path>] [--timeout <sec>]'
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

if ($TimeoutSec -le 0) {
  if ($env:CLI_JOB_TIMEOUT_SEC -and $env:CLI_JOB_TIMEOUT_SEC -match '^[0-9]+$') {
    $TimeoutSec = [int]$env:CLI_JOB_TIMEOUT_SEC
  } else {
    $TimeoutSec = 1800
  }
}
if ($TimeoutSec -le 0) { throw 'invalid timeout' }

$lockDir = Join-Path $JobsRoot '_locks'
New-Item -ItemType Directory -Force -Path $lockDir | Out-Null
$lockPath = Join-Path $lockDir ($JobName + '.lock')

# Unique run id so same-second collisions never share a directory.
$ts = Get-Date -Format 'yyyyMMddTHHmmss'
$runId = '{0}_{1}_{2}' -f $ts, $PID, (Get-Random -Maximum 999999)
$runDir = $null
$reportPath = $null
$statusPath = $null
$logPath = $null

function Init-RunDir {
  $script:runDir = Join-Path $JobsRoot (Join-Path $JobName $runId)
  New-Item -ItemType Directory -Force -Path $script:runDir | Out-Null
  $script:reportPath = Join-Path $script:runDir 'report.md'
  $script:statusPath = Join-Path $script:runDir 'status.json'
  $script:logPath = Join-Path $script:runDir 'run.log'
}

function Write-Status([hashtable] $obj) {
  $json = $obj | ConvertTo-Json -Compress
  # Windows PowerShell 5.1 Set-Content -Encoding utf8 writes a BOM that breaks JSON.parse.
  [System.IO.File]::WriteAllText($statusPath, $json, [System.Text.UTF8Encoding]::new($false))
}

# Lock BEFORE any write to a run directory.
$lockStream = $null
try {
  $lockStream = [System.IO.File]::Open(
    $lockPath,
    [System.IO.FileMode]::OpenOrCreate,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
  )
} catch {
  Init-RunDir
  Write-Status @{
    job = $JobName
    run_id = $runId
    exit_code = 75
    error = 'lock-busy'
    host = $env:COMPUTERNAME
    workdir = $WorkDir
    prompt_path = $PromptFile
    started_at = (Get-Date).ToUniversalTime().ToString('o')
    ended_at = (Get-Date).ToUniversalTime().ToString('o')
    timeout_sec = $TimeoutSec
  }
  Add-Content -LiteralPath $logPath -Value 'lock-busy' -Encoding utf8
  exit 75
}

Init-RunDir
$started = (Get-Date).ToUniversalTime().ToString('o')
Write-Status @{
  job = $JobName
  run_id = $runId
  exit_code = $null
  host = $env:COMPUTERNAME
  workdir = $WorkDir
  prompt_path = $PromptFile
  started_at = $started
  ended_at = $null
  report = $reportPath
  timeout_sec = $TimeoutSec
}
Add-Content -LiteralPath $logPath -Value ("started job=" + $JobName + " run_id=" + $runId + " timeout_sec=" + $TimeoutSec) -Encoding utf8

$exitCode = 1
$timedOut = $false
try {
  # Prompt-via-file: never put the long prompt (paths may contain spaces) on Start-Process argv.
  $agentPrompt = "Read the prompt file at $PromptFile and carry it out completely. Work in $WorkDir. Write nothing that contains secrets."
  $invokePromptPath = Join-Path $runDir 'invoke-prompt.txt'
  Set-Content -LiteralPath $invokePromptPath -Value $agentPrompt -Encoding utf8

  # Wrapper: prompt-via-file + self-redirect so Start-Process need not RedirectStandard*
  # (RedirectStandard* leaves ExitCode unset on Windows PowerShell 5.1).
  $outFile = Join-Path $runDir 'stdout.txt'
  $errFile = Join-Path $runDir 'stderr.txt'
  $wrapperPath = Join-Path $runDir 'run-agent.ps1'
  $agentPs1Literal = $AgentPs1.Replace("'", "''")
  $invokeLiteral = $invokePromptPath.Replace("'", "''")
  $outLiteral = $outFile.Replace("'", "''")
  $errLiteral = $errFile.Replace("'", "''")
  # Nested powershell so agent.ps1's `exit` does not skip our redirects mid-call.
  # Agent argv stays inside this wrapper (prompt-via-file); Start-Process only sees -File wrapper.
  @(
    "`$agent = '$agentPs1Literal'"
    "`$invoke = '$invokeLiteral'"
    "`$out = '$outLiteral'"
    "`$err = '$errLiteral'"
    '$text = Get-Content -LiteralPath $invoke -Raw'
    'try {'
    '  & $agent -p --force --output-format text -- $text >$out 2>$err'
    '  $code = $LASTEXITCODE'
    '  if ($null -eq $code) { $code = 0 }'
    '  exit $code'
    '} catch {'
    '  $_ | Out-File -LiteralPath $err -Append -Encoding utf8'
    '  exit 1'
    '}'
  ) | Set-Content -LiteralPath $wrapperPath -Encoding utf8

  # Only -File <wrapper>; quote wrapper path. Do not Write-Host the argument list.
  $argLine = '-NoProfile -File ' + (Escape-ProcessArg $wrapperPath)
  $p = Start-Process -FilePath 'powershell.exe' `
    -WorkingDirectory $WorkDir `
    -PassThru -WindowStyle Hidden `
    -ArgumentList $argLine

  $timeoutMs = [Math]::Max(1, $TimeoutSec) * 1000
  if (-not $p.WaitForExit($timeoutMs)) {
    $timedOut = $true
    # Kill the whole process tree (powershell + agent children).
    & taskkill.exe /PID $p.Id /T /F 2>$null | Out-Null
    try { $p.WaitForExit(5000) | Out-Null } catch { }
    try { $p.WaitForExit() | Out-Null } catch { }
    $exitCode = 124
    Add-Content -LiteralPath $logPath -Value 'ended exit=124 error=timeout' -Encoding utf8
  } else {
    $p.WaitForExit() | Out-Null
    $p.Refresh()
    # exit $null becomes 0 in PowerShell — never treat a missing ExitCode as success.
    if ($null -eq $p.ExitCode) { $exitCode = 1 } else { $exitCode = [int]$p.ExitCode }
    Add-Content -LiteralPath $logPath -Value ("ended exit=" + $exitCode) -Encoding utf8
  }

  if (Test-Path -LiteralPath $outFile) {
    # PowerShell `>` writes UTF-16 LE; normalize report.md to UTF-8.
    $raw = [System.IO.File]::ReadAllBytes($outFile)
    if ($raw.Length -ge 2 -and $raw[0] -eq 0xFF -and $raw[1] -eq 0xFE) {
      $text = [System.Text.Encoding]::Unicode.GetString($raw, 2, $raw.Length - 2)
      [System.IO.File]::WriteAllText($reportPath, $text, [System.Text.UTF8Encoding]::new($false))
    } elseif ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF) {
      Copy-Item -LiteralPath $outFile -Destination $reportPath -Force
    } else {
      $text = [System.Text.Encoding]::UTF8.GetString($raw)
      [System.IO.File]::WriteAllText($reportPath, $text, [System.Text.UTF8Encoding]::new($false))
    }
  } else {
    Set-Content -LiteralPath $reportPath -Value $(if ($timedOut) { '# timed out before report' } else { '# no stdout' }) -Encoding utf8
  }
  if (Test-Path -LiteralPath $errFile) {
    $errLen = (Get-Item -LiteralPath $errFile).Length
    Add-Content -LiteralPath $logPath -Value ("stderr_bytes=" + $errLen) -Encoding utf8
  }
} catch {
  Add-Content -LiteralPath $logPath -Value 'run-failed' -Encoding utf8
  $exitCode = 1
  if (-not (Test-Path -LiteralPath $reportPath)) {
    Set-Content -LiteralPath $reportPath -Value '# run failed before report' -Encoding utf8
  }
} finally {
  $ended = (Get-Date).ToUniversalTime().ToString('o')
  $statusObj = @{
    job = $JobName
    run_id = $runId
    exit_code = $exitCode
    host = $env:COMPUTERNAME
    workdir = $WorkDir
    prompt_path = $PromptFile
    started_at = $started
    ended_at = $ended
    report = $reportPath
    timeout_sec = $TimeoutSec
  }
  if ($timedOut) { $statusObj.error = 'timeout' }
  Write-Status $statusObj
  if ($null -ne $lockStream) { $lockStream.Dispose() }
}

exit $exitCode
