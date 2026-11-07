# Script test for ops/cli-jobs/run-with-build-receipt.ps1 argument quoting.
# Run under pwsh 7.4 and Windows PowerShell 5.1 where available:
#   pwsh -NoProfile -File ops/cli-jobs/tests/run-with-build-receipt.Tests.ps1
#   powershell.exe -NoProfile -File ops/cli-jobs/tests/run-with-build-receipt.Tests.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$failed = 0
function Assert-True([bool]$cond, [string]$msg) {
  if (-not $cond) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    $script:failed++
  } else {
    Write-Host "ok: $msg"
  }
}

$here = $PSScriptRoot
$wrapper = (Resolve-Path (Join-Path $here '..\run-with-build-receipt.ps1')).Path
$hostLabel = if ($PSVersionTable.PSEdition -eq 'Core') { "pwsh $($PSVersionTable.PSVersion)" } else { "Windows PowerShell $($PSVersionTable.PSVersion)" }
Write-Host "=== run-with-build-receipt quoting test on $hostLabel ==="

$root = Join-Path ([System.IO.Path]::GetTempPath()) ("br-quote test " + [guid]::NewGuid().ToString('N').Substring(0, 8))
$workDir = Join-Path $root 'work dir with spaces'
$promptDir = Join-Path $root 'prompt dir with spaces'
$agentDir = Join-Path $root 'agent dir with spaces'
New-Item -ItemType Directory -Force -Path $workDir, $promptDir, $agentDir | Out-Null

$promptFile = Join-Path $promptDir 'my prompt.md'
Set-Content -LiteralPath $promptFile -Value 'do the thing' -Encoding UTF8

$agentArgsFile = Join-Path $root 'agent-args.json'
$agentPs1 = Join-Path $agentDir 'agent.ps1'
# No param block: every token lands in $args (avoids -p/--force binding errors).
$agentStubOk = @'
$out = $env:BUILD_RECEIPT_TEST_ARGS_FILE
if (-not $out) { throw "BUILD_RECEIPT_TEST_ARGS_FILE unset" }
($args | ConvertTo-Json -Compress) | Set-Content -LiteralPath $out -Encoding UTF8
exit 0
'@
$agentStubFail = @'
$out = $env:BUILD_RECEIPT_TEST_ARGS_FILE
if (-not $out) { throw "BUILD_RECEIPT_TEST_ARGS_FILE unset" }
($args | ConvertTo-Json -Compress) | Set-Content -LiteralPath $out -Encoding UTF8
exit 7
'@
Set-Content -LiteralPath $agentPs1 -Value $agentStubOk -Encoding UTF8

$receiptLog = Join-Path $root 'receipts.jsonl'
$receiptInvoker = {
  param([Parameter(Mandatory = $false)][string[]] $ReceiptArgs)
  if (-not $ReceiptArgs -or $ReceiptArgs.Count -eq 0) {
    $ReceiptArgs = @($args | ForEach-Object { $_ })
  }
  $line = ($ReceiptArgs | ConvertTo-Json -Compress)
  Add-Content -LiteralPath $env:BUILD_RECEIPT_TEST_RECEIPT_LOG -Value $line -Encoding UTF8
  $global:LASTEXITCODE = 0
}

$env:BUILD_RECEIPT_TEST_ARGS_FILE = $agentArgsFile
$env:BUILD_RECEIPT_TEST_RECEIPT_LOG = $receiptLog
$psExe = (Get-Command powershell.exe).Source

function Invoke-Wrapper([string]$orderId) {
  & $wrapper `
    -OrderId $orderId `
    -Repo 'A-sop/logans-tools' `
    -Branch 'div4/build-receipts' `
    -Machine 'HZR52' `
    -ExpectedFinish '2026-11-01T23:00:00+01:00' `
    -WorkDir $workDir `
    -PromptFile $promptFile `
    -AgentPs1 $agentPs1 `
    -ReceiptInvoker $receiptInvoker `
    -PowerShellExe $psExe
  return $LASTEXITCODE
}

# --- Case 1: exit 0 → finish done; prompt + paths with spaces stay one argv ---
if (Test-Path -LiteralPath $receiptLog) { Remove-Item -LiteralPath $receiptLog -Force }
if (Test-Path -LiteralPath $agentArgsFile) { Remove-Item -LiteralPath $agentArgsFile -Force }
$exit1 = Invoke-Wrapper 'ord-space-1'
Assert-True ($exit1 -eq 0) "wrapper exit 0 when stub agent exits 0 (got $exit1)"

Assert-True (Test-Path -LiteralPath $agentArgsFile) 'stub agent wrote args file'
$parsed = (Get-Content -LiteralPath $agentArgsFile -Raw) | ConvertFrom-Json
$argList = @($parsed)
$promptArg = $argList | Where-Object { $_ -is [string] -and $_ -like 'Read the prompt file at *' } | Select-Object -First 1
Assert-True ($null -ne $promptArg) 'prompt arrived as a single recognisable argument'
Assert-True ($promptArg -match [regex]::Escape($promptFile)) 'prompt arg contains full PromptFile path with spaces'
Assert-True ($promptArg -match [regex]::Escape($workDir)) 'prompt arg contains full WorkDir path with spaces'
# Path fragments must not appear as their own argv entries
$loose = @($argList | Where-Object { $_ -eq 'with' -or $_ -eq 'spaces' -or $_ -eq 'dir' })
Assert-True ($loose.Count -eq 0) 'path/prompt words did not arrive as separate argv entries'

$receiptLines = @(Get-Content -LiteralPath $receiptLog)
Assert-True ($receiptLines.Count -ge 2) "expected start+finish receipt calls (got $($receiptLines.Count))"
$finishLine = $receiptLines | Select-Object -Last 1
Assert-True (($finishLine -match '"finish"') -and ($finishLine -match '"done"')) "exit 0 yields finish status done ($finishLine)"

# --- Case 2: non-zero agent exit → finish failed ---
Set-Content -LiteralPath $agentPs1 -Value $agentStubFail -Encoding UTF8
Remove-Item -LiteralPath $receiptLog -Force -ErrorAction SilentlyContinue
$exit2 = Invoke-Wrapper 'ord-space-2'
Assert-True ($exit2 -eq 7) "wrapper propagates stub agent exit 7 (got $exit2)"
$receiptLines2 = @(Get-Content -LiteralPath $receiptLog)
$finishLine2 = $receiptLines2 | Select-Object -Last 1
Assert-True (($finishLine2 -match '"finish"') -and ($finishLine2 -match '"failed"')) "non-zero exit yields finish status failed ($finishLine2)"

Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item Env:BUILD_RECEIPT_TEST_ARGS_FILE -ErrorAction SilentlyContinue
Remove-Item Env:BUILD_RECEIPT_TEST_RECEIPT_LOG -ErrorAction SilentlyContinue

if ($failed -gt 0) {
  Write-Host "FAILED $failed assertion(s) on $hostLabel" -ForegroundColor Red
  exit 1
}
Write-Host "ALL PASSED on $hostLabel"
exit 0
