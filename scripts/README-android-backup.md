# Android backup v2 (Windows local runner)

This folder now includes an actual local backup runner with two usage modes:

- manual double-click (`run-android-backup.cmd`)
- scheduled automation (Task Scheduler helper script)

## Files

- `android-backup.ps1` - core backup script (`robocopy`-based snapshot run)
- `android-backup.config.json` - editable config (staging root + source folders)
- `android-backup.smoke-test.config.json` - tiny paths for a safe local test (edit if your repo is not under `C:\Dev\logans-tools`)
- `smoke-test-source/` - one small file used only by the smoke test
- `run-android-backup.cmd` - manual double-click launcher
- `register-android-backup-task.ps1` - creates/updates a daily scheduled task

## Safety rule (avoid disk bloat)

**`stagingRoot` must not live inside any `sourceFolders` path.** If it does, `robocopy` can recurse into the snapshot and create huge nested trees. The script now **errors early** if it detects that layout.

## Smoke test (from repo root)

```bash
npm run backup:android:smoke
```

This writes to `C:\Dev\_android-backup-smoke-out\` (edit the JSON if your paths differ). Delete that folder after verifying.

## Cleaning old mistaken test trees

If a bad test created `_tmp-backup-test*` folders with very deep paths, delete with an empty-folder mirror (run in `cmd`):

```bat
mkdir C:\Dev\_empty_mirror
robocopy C:\Dev\_empty_mirror C:\Dev\logans-tools\_tmp-backup-test2 /MIR
rmdir C:\Dev\_empty_mirror
rmdir C:\Dev\logans-tools\_tmp-backup-test2
```

Repeat for `C:\Dev\logans-tools\scripts\_tmp-backup-test` if it exists.

## Office / guest Wi-Fi

Company networks sometimes **isolate clients** (AP isolation) or block peer sync. If Syncthing never connects, try **USB (MTP)** or your **phone hotspot** with the laptop on that hotspot. When in doubt, ask IT whether device-to-device traffic is allowed.

## 1) Configure paths

Edit `android-backup.config.json`:

- `stagingRoot`: where all snapshots and logs should live
- `sourceFolders`: local folders to copy into each dated snapshot
  - good default: Syncthing receive folder (`...\Android-Phone\incoming`)
  - optional: a manual USB drop folder

## 2) Manual mode (double-click)

- Double-click: `scripts/run-android-backup.cmd`
- It runs the PowerShell script and pauses so you can see success/failure.
- Output:
  - snapshots under `...\Android-Phone\usb-snapshots\YYYY-MM-DD_HHMMSS\`
  - logs under `...\Android-Phone\logs\`

## 3) Automated mode (Task Scheduler)

Run in PowerShell:

```powershell
Set-Location "C:\Dev\logans-tools\scripts"
.\register-android-backup-task.ps1 -TaskName "AndroidPhoneBackup" -DailyAt "21:00"
```

This creates a daily task that runs:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\android-backup.ps1 -ConfigPath scripts\android-backup.config.json
```

To check:

```powershell
Get-ScheduledTask -TaskName "AndroidPhoneBackup"
```

## Notes

- MTP and Syncthing remain the ingestion paths from phone to local machine.
- This script snapshots local source folders; it does not directly browse phone storage.
- App-private Android data is usually not included unless apps export it.
- Ensure your external-HDD backup includes the full `Android-Phone` tree.
