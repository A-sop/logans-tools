<#
.SYNOPSIS
  HZR52 CLI launch with Div4 build-receipt start/finish around agent.ps1.
.DESCRIPTION
  Writes build-receipt start before agent.ps1, and finish after exit.
  Uses the call operator so prompts/paths with spaces stay single arguments
  (Start-Process -ArgumentList array items were splitting on spaces).
  Never echoes the agent argument list (may carry keys). Zero-token; no LLM.
  Acceptance: docs/acceptance/2026-11-01_build_receipts_open_orders_stall.ACCEPTANCE.md
              + AMENDMENT-1.md
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $OrderId,
  [Parameter(Mandatory = $true)]
  [string] $Repo,
  [Parameter(Mandatory = $true)]
  [string] $Branch,
  [Parameter(Mandatory = $true)]
  [string] $Machine,
  [Parameter(Mandatory = $true)]
  [string] $ExpectedFinish,
  [Parameter(Mandatory = $true)]
  [string] $WorkDir,
  [Parameter(Mandatory = $true)]
  [string] $PromptFile,
  [string] $AgentPs1 = '',
  [string[]] $PrLinks = @(),
  [string] $ToolsRoot = '',
  # Test hook: when set, invoked instead of npm run dabos:build-receipt (receives string[] args).
  [scriptblock] $ReceiptInvoker = $null,
  # Test hook: host exe used to launch -File $AgentPs1 (default powershell.exe).
  [string] $PowerShellExe = 'powershell.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-BuildReceiptEnvFile {
  # Load name=value from the standard env file into process env. Never prints values.
  $candidates = @(
    (Join-Path $env:USERPROFILE '.config\dabos\build-receipt.env'),
    (Join-Path $HOME '.config/dabos/build-receipt.env')
  ) | Select-Object -Unique
  foreach ($p in $candidates) {
    if (-not (Test-Path -LiteralPath $p)) { continue }
    foreach ($line in Get-Content -LiteralPath $p) {
      if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
      if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
        $name = $Matches[1]
        $val = $Matches[2].Trim().Trim('"').Trim("'")
        Set-Item -Path "Env:$name" -Value $val
      }
    }
    break
  }
}

Import-BuildReceiptEnvFile

if (-not (Test-Path -LiteralPath $PromptFile)) {
  throw "prompt file not found: $PromptFile"
}
$PromptFile = (Resolve-Path -LiteralPath $PromptFile).Path
if (-not (Test-Path -LiteralPath $WorkDir)) {
  throw "workdir not found: $WorkDir"
}
$WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path

if (-not $AgentPs1) {
  $AgentPs1 = Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.ps1'
}
if (-not (Test-Path -LiteralPath $AgentPs1)) {
  throw "agent.ps1 not found: $AgentPs1"
}
$AgentPs1 = (Resolve-Path -LiteralPath $AgentPs1).Path

if (-not $ToolsRoot) {
  $ToolsRoot = $PSScriptRoot
  if ($ToolsRoot -match '[\\/]ops[\\/]cli-jobs$') {
    $ToolsRoot = (Resolve-Path (Join-Path $ToolsRoot '..\..')).Path
  }
}

function Invoke-BuildReceipt {
  param([string[]] $ReceiptArgs)
  if ($null -ne $ReceiptInvoker) {
    # Test hook: success = no throw. Do not inherit a prior native LASTEXITCODE.
    $global:LASTEXITCODE = 0
    & $ReceiptInvoker $ReceiptArgs
    if ($LASTEXITCODE -ne 0) {
      throw "build-receipt failed exit=$LASTEXITCODE"
    }
    return
  }
  Push-Location -LiteralPath $ToolsRoot
  try {
    & npm run dabos:build-receipt -- @ReceiptArgs
    if ($LASTEXITCODE -ne 0) {
      throw "build-receipt failed exit=$LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

$startArgs = @(
  'start',
  '--order-id', $OrderId,
  '--repo', $Repo,
  '--branch', $Branch,
  '--machine', $Machine,
  '--expected-finish', $ExpectedFinish
)
foreach ($pr in @($PrLinks)) {
  if ($pr) { $startArgs += @('--pr', $pr) }
}
Invoke-BuildReceipt -ReceiptArgs $startArgs

$exitCode = 1
$runDir = Join-Path ([System.IO.Path]::GetTempPath()) ("build-receipt-" + $OrderId -replace '[^A-Za-z0-9._-]', '_')
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$outFile = Join-Path $runDir 'stdout.txt'
$errFile = Join-Path $runDir 'stderr.txt'

try {
  # Prompt path only; do not Write-Host the argument list.
  # Call operator keeps $agentPrompt and $AgentPs1 as single argv entries even with spaces.
  $agentPrompt = "Read the prompt file at $PromptFile and carry it out completely. Work in $WorkDir. Write nothing that contains secrets."
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $PowerShellExe -NoProfile -File $AgentPs1 -p --force --output-format text -- $agentPrompt 1>$outFile 2>$errFile
    if ($null -ne $LASTEXITCODE) {
      $exitCode = [int]$LASTEXITCODE
    } else {
      $exitCode = 1
    }
  } finally {
    $ErrorActionPreference = $prevEap
  }
} catch {
  $exitCode = 1
}

$finishStatus = if ($exitCode -eq 0) { 'done' } else { 'failed' }
$finishArgs = @(
  'finish',
  '--order-id', $OrderId,
  '--status', $finishStatus
)
foreach ($pr in @($PrLinks)) {
  if ($pr) { $finishArgs += @('--pr', $pr) }
}
try {
  Invoke-BuildReceipt -ReceiptArgs $finishArgs
} catch {
  Write-Error $_
  if ($exitCode -eq 0) { $exitCode = 1 }
}

exit $exitCode
