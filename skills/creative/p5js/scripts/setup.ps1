# p5.js Skill — Dependency Verification (Windows PowerShell)
# Run: pwsh -File scripts/setup.ps1
# Or:  powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$Green  = "`e[0;32m"; $Yellow = "`e[1;33m"; $Red = "`e[0;31m"; $Reset = "`e[0m"
function ok($msg)   { Write-Host "${Green}[OK]${Reset}   $msg" }
function warn($msg) { Write-Host "${Yellow}[WARN]${Reset} $msg" }
function fail($msg) { Write-Host "${Red}[FAIL]${Reset} $msg" }

Write-Host "=== p5.js Skill — Setup Check (Windows) ==="
Write-Host ""

# Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $v = node -v
    ok "Node.js $v"
} else {
    warn "Node.js not found — optional, needed for headless export"
    Write-Host "       Install: https://nodejs.org/  or  winget install OpenJS.NodeJS"
}

# npm
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $v = npm -v
    ok "npm $v"
} else {
    warn "npm not found — optional, needed for headless export"
}

# Puppeteer
if (Get-Command node -ErrorAction SilentlyContinue) {
    $null = node -e "require('puppeteer')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        ok "Puppeteer installed"
    } else {
        warn "Puppeteer not installed — needed for headless export"
        Write-Host "       Install: npm install puppeteer"
    }
}

# ffmpeg
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    $v = (ffmpeg -version 2>&1 | Select-Object -First 1) -replace '.*version\s+(\S+).*','$1'
    ok "ffmpeg $v"
} else {
    warn "ffmpeg not found — needed for MP4 export"
    Write-Host "       Install: winget install Gyan.FFmpeg  or  choco install ffmpeg"
}

# Python (for local server)
$pyCmd = $null
foreach ($cmd in @("python", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) { $pyCmd = $cmd; break }
}
if ($pyCmd) {
    $v = & $pyCmd --version 2>&1
    ok "Python $v (for local server: $pyCmd -m http.server)"
} else {
    warn "Python not found — needed for local file serving"
    Write-Host "       Install: https://www.python.org/  or  winget install Python.Python.3"
}

# Browser check (Windows)
$browsers = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles (x86)\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
    "$env:ProgramFiles (x86)\Mozilla Firefox\firefox.exe"
)
$browserFound = $false
foreach ($b in $browsers) {
    if (Test-Path $b) {
        ok "Browser found: $b"
        $browserFound = $true
        break
    }
}
if (-not $browserFound) {
    # Edge is always present on modern Windows
    if (Get-Command msedge -ErrorAction SilentlyContinue) {
        ok "Microsoft Edge found"
    } else {
        warn "No browser detected (Edge/Chrome/Firefox)"
    }
}

Write-Host ""
Write-Host "=== Core Requirements ==="
Write-Host "  A modern browser (Chrome/Firefox/Edge)"
Write-Host "  p5.js loaded via CDN — no local install needed"
Write-Host ""
Write-Host "=== Optional (for export) ==="
Write-Host "  Node.js + Puppeteer — headless frame capture"
Write-Host "  ffmpeg              — frame sequence to MP4"
Write-Host "  Python              — local development server"
Write-Host ""
Write-Host "=== Quick Start (Windows) ==="
Write-Host "  1. Create an HTML file with inline p5.js sketch"
Write-Host "  2. Double-click sketch.html to open in browser"
Write-Host "     (or: Start-Process sketch.html)"
Write-Host "  3. Press 's' to save PNG, 'g' to save GIF"
Write-Host ""
Write-Host "Setup check complete."
