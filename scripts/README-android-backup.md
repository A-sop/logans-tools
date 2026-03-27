# Android backup script templates (Windows)

These examples are non-secret templates for consolidating Android phone
backups inside a local staging folder.

Use placeholders:

- `<STAGING_ROOT>` (example: `D:\Backups`)
- `<SNAPSHOT_DATE>` (example: `2026-03-23`)

Recommended root:

```text
<STAGING_ROOT>\Android-Phone\
```

## Example 1: Create dated snapshot folders

```powershell
$staging = "<STAGING_ROOT>\\Android-Phone"
$date = "<SNAPSHOT_DATE>"

New-Item -ItemType Directory -Force -Path "$staging\\usb-snapshots\\$date" | Out-Null
New-Item -ItemType Directory -Force -Path "$staging\\adb-snapshots\\$date" | Out-Null
New-Item -ItemType Directory -Force -Path "$staging\\logs" | Out-Null
```

## Example 2: Mirror one folder into a dated snapshot (robocopy)

```powershell
# Replace source path with where files were copied from USB first.
$source = "<SOURCE_FOLDER>"
$dest = "<STAGING_ROOT>\\Android-Phone\\usb-snapshots\\<SNAPSHOT_DATE>\\Documents"
$log = "<STAGING_ROOT>\\Android-Phone\\logs\\usb-documents-<SNAPSHOT_DATE>.log"

robocopy $source $dest /E /R:2 /W:2 /FFT /DCOPY:DAT /COPY:DAT /Z /NP /TEE /LOG:$log
```

## Example 3: Optional ADB pulls

```powershell
$date = "<SNAPSHOT_DATE>"
$base = "<STAGING_ROOT>\\Android-Phone\\adb-snapshots\\$date"

adb devices
adb pull /sdcard/DCIM "$base\\DCIM"
adb pull /sdcard/Documents "$base\\Documents"
```

## Notes

- MTP (File Explorer) backup works without ADB and should be enough for most users.
- App-private data is usually not included unless an app exports it.
- Make sure your scheduled external-HDD backup includes the full
  `<STAGING_ROOT>\Android-Phone\` tree.
