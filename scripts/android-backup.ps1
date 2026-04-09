param(
  [string]$ConfigPath = ".\android-backup.config.json",
  [string]$SnapshotLabel = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ConfigPath {
  param([string]$PathValue)
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  $fromScript = Join-Path -Path $PSScriptRoot -ChildPath $PathValue
  if (Test-Path -LiteralPath $fromScript) {
    return [System.IO.Path]::GetFullPath($fromScript)
  }
  $fromCwd = Join-Path -Path (Get-Location).Path -ChildPath $PathValue
  return [System.IO.Path]::GetFullPath($fromCwd)
}

function Ensure-Directory {
  param([string]$PathValue)
  New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
}

$resolvedConfigPath = Resolve-ConfigPath -PathValue $ConfigPath
if (-not (Test-Path -LiteralPath $resolvedConfigPath)) {
  throw "Config file not found: $resolvedConfigPath"
}

$config = Get-Content -LiteralPath $resolvedConfigPath -Raw | ConvertFrom-Json

if (-not $config.stagingRoot) {
  throw "Missing required config value: stagingRoot"
}

if (-not $config.sourceFolders -or $config.sourceFolders.Count -eq 0) {
  throw "Missing required config value: sourceFolders"
}

$stagingRoot = [string]$config.stagingRoot
$fullStagingRoot = [System.IO.Path]::GetFullPath($stagingRoot.TrimEnd('\', '/'))

foreach ($sourceEntry in $config.sourceFolders) {
  $enabled = if ($sourceEntry.enabled -ne $null) { [bool]$sourceEntry.enabled } else { $true }
  if (-not $enabled -or -not $sourceEntry.path) {
    continue
  }
  $sourcePath = [string]$sourceEntry.path
  try {
    $fullSource = [System.IO.Path]::GetFullPath($sourcePath.TrimEnd('\', '/'))
  } catch {
    continue
  }
  if ($fullStagingRoot.Equals($fullSource, [StringComparison]::OrdinalIgnoreCase)) {
    throw "stagingRoot cannot be the same path as a source folder: $fullStagingRoot"
  }
  if ($fullStagingRoot.StartsWith($fullSource + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "stagingRoot must not be inside a source folder (avoids recursive copy bloat). stagingRoot=$fullStagingRoot source=$fullSource"
  }
}

$timestamp = if ($SnapshotLabel) { $SnapshotLabel } else { Get-Date -Format "yyyy-MM-dd_HHmmss" }
$snapshotRoot = Join-Path -Path $stagingRoot -ChildPath "usb-snapshots\$timestamp"
$logsRoot = Join-Path -Path $stagingRoot -ChildPath "logs"
$logFile = Join-Path -Path $logsRoot -ChildPath "backup-$timestamp.log"

Ensure-Directory -PathValue $stagingRoot
Ensure-Directory -PathValue $snapshotRoot
Ensure-Directory -PathValue $logsRoot

$retryCount = if ($config.robocopy.retryCount -ne $null) { [int]$config.robocopy.retryCount } else { 2 }
$waitSeconds = if ($config.robocopy.waitSeconds -ne $null) { [int]$config.robocopy.waitSeconds } else { 2 }
$useRestartable = if ($config.robocopy.useRestartableMode -ne $null) { [bool]$config.robocopy.useRestartableMode } else { $true }

Write-Host "Starting Android backup"
Write-Host "Config: $resolvedConfigPath"
Write-Host "Snapshot: $snapshotRoot"
Write-Host "Log: $logFile"

$fatalErrors = 0
$copiedSources = 0

foreach ($sourceEntry in $config.sourceFolders) {
  $enabled = if ($sourceEntry.enabled -ne $null) { [bool]$sourceEntry.enabled } else { $true }
  if (-not $enabled) {
    continue
  }

  if (-not $sourceEntry.path) {
    Write-Warning "Skipping source without path."
    continue
  }

  $sourcePath = [string]$sourceEntry.path
  $sourceName = if ($sourceEntry.name) { [string]$sourceEntry.name } else { [System.IO.Path]::GetFileName($sourcePath.TrimEnd('\')) }
  if (-not $sourceName) {
    $sourceName = "source"
  }

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    Write-Warning "Source path not found, skipping: $sourcePath"
    continue
  }

  $destinationPath = Join-Path -Path $snapshotRoot -ChildPath $sourceName
  Ensure-Directory -PathValue $destinationPath

  $robocopyArgs = @(
    "`"$sourcePath`"",
    "`"$destinationPath`"",
    "/E",
    "/R:$retryCount",
    "/W:$waitSeconds",
    "/FFT",
    "/DCOPY:DAT",
    "/COPY:DAT",
    "/NP",
    "/TEE",
    "/LOG+:`"$logFile`""
  )

  # Prevent recursive self-copy when staging root is inside a source path.
  $robocopyArgs += "/XD"
  $robocopyArgs += "`"$stagingRoot`""

  if ($useRestartable) {
    $robocopyArgs += "/Z"
  }

  Write-Host "Copying $sourcePath -> $destinationPath"
  & robocopy @robocopyArgs | Out-Host
  $exitCode = $LASTEXITCODE

  if ($exitCode -ge 8) {
    $fatalErrors += 1
    Write-Error "Robocopy failed for source '$sourceName' with exit code $exitCode."
    continue
  }

  $copiedSources += 1
}

if ($copiedSources -eq 0) {
  Write-Warning "No enabled source folders were copied. Check your config."
}

if ($fatalErrors -gt 0) {
  throw "Backup finished with $fatalErrors fatal copy error(s). Check: $logFile"
}

Write-Host "Backup completed successfully. Snapshot: $snapshotRoot"
