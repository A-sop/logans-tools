# Git Setup Script for Windows
# Run this script in PowerShell to complete your Git configuration

Write-Host "=== Git Setup for Next.js Project ===" -ForegroundColor Cyan
Write-Host ""

# Check if Git is installed
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git is installed: $gitVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Git is not installed. Please install Git for Windows first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Configure Git user name
Write-Host "Configuring Git user name..." -ForegroundColor Yellow
$userName = Read-Host "Enter your name for Git commits"
if ($userName) {
    git config --global user.name "$userName"
    Write-Host "✅ Git user name set to: $userName" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping user name configuration" -ForegroundColor Yellow
}

Write-Host ""

# Configure Git user email
Write-Host "Configuring Git user email..." -ForegroundColor Yellow
$userEmail = Read-Host "Enter your email for Git commits"
if ($userEmail) {
    git config --global user.email "$userEmail"
    Write-Host "✅ Git user email set to: $userEmail" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping user email configuration" -ForegroundColor Yellow
}

Write-Host ""

# Verify Git configuration
Write-Host "=== Current Git Configuration ===" -ForegroundColor Cyan
git config --global --list | Select-String "user\."
Write-Host ""

# Check if repository is initialized
Write-Host "Checking Git repository status..." -ForegroundColor Yellow
if (Test-Path .git) {
    Write-Host "✅ Git repository is initialized" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Repository Status ===" -ForegroundColor Cyan
    git status
} else {
    Write-Host "⚠️  Git repository not initialized. Initializing now..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Repository Status ===" -ForegroundColor Cyan
    git status
}

Write-Host ""
Write-Host "=== .gitignore Check ===" -ForegroundColor Cyan
if (Test-Path .gitignore) {
    Write-Host "✅ .gitignore file exists" -ForegroundColor Green
    $gitignoreContent = Get-Content .gitignore -Raw
    $requiredPatterns = @("node_modules", ".next", ".vercel", ".env")
    $missingPatterns = @()
    
    foreach ($pattern in $requiredPatterns) {
        if ($gitignoreContent -notmatch $pattern) {
            $missingPatterns += $pattern
        }
    }
    
    if ($missingPatterns.Count -eq 0) {
        Write-Host "✅ All required patterns found in .gitignore" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Missing patterns: $($missingPatterns -join ', ')" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ .gitignore file not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "You can now use Git commands like:" -ForegroundColor White
Write-Host "  git add ." -ForegroundColor Gray
Write-Host "  git commit -m 'Your commit message'" -ForegroundColor Gray
Write-Host ""
