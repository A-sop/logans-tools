# First Commit Script - Run this in your project folder
# Usage: .\first-commit.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== Step 1: What does Git see? ===" -ForegroundColor Cyan
Write-Host ""
git status
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Git repository not initialized. Running git init..." -ForegroundColor Yellow
    git init
    Write-Host ""
    Write-Host "=== Step 1 (again): What does Git see? ===" -ForegroundColor Cyan
    git status
}
Write-Host ""
Read-Host "Press Enter to continue to Step 2 (stage all files)"

Write-Host ""
Write-Host "=== Step 2: Stage all files (respects .gitignore) ===" -ForegroundColor Cyan
Write-Host ""
git add .
Write-Host "Done. Files staged." -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to continue to Step 3 (verify staged)"

Write-Host ""
Write-Host "=== Step 3: Verify what's staged ===" -ForegroundColor Cyan
Write-Host ""
git status
Write-Host ""
Read-Host "Press Enter to continue to Step 4 (create commit)"

Write-Host ""
Write-Host "=== Step 4: Create initial commit ===" -ForegroundColor Cyan
Write-Host ""
git commit -m "Initial project setup"
Write-Host ""
Write-Host "=== Step 5: Verify the commit was created ===" -ForegroundColor Cyan
Write-Host ""
git log -1 --oneline
Write-Host ""
Write-Host "Done. Your first commit has been created." -ForegroundColor Green
Write-Host ""
