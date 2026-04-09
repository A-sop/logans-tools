param(
  [string]$TaskName = "AndroidPhoneBackup",
  [string]$DailyAt = "21:00"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "android-backup.ps1"
$configPath = Join-Path -Path $PSScriptRoot -ChildPath "android-backup.config.json"

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Backup script not found: $scriptPath"
}

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Backup config not found: $configPath"
}

$actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ConfigPath `"$configPath`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Scheduled task '$TaskName' created/updated for daily run at $DailyAt."
