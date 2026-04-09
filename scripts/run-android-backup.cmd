@echo off
setlocal

set SCRIPT_DIR=%~dp0
set POWERSHELL_EXE=powershell.exe

echo.
echo Running Android backup...
echo Script: %SCRIPT_DIR%android-backup.ps1
echo Config: %SCRIPT_DIR%android-backup.config.json
echo.

%POWERSHELL_EXE% -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%android-backup.ps1" -ConfigPath "%SCRIPT_DIR%android-backup.config.json"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% EQU 0 (
  echo Backup completed successfully.
) else (
  echo Backup failed with exit code %EXIT_CODE%.
)

echo.
pause
exit /b %EXIT_CODE%
