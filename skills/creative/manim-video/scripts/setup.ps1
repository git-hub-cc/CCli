# Manim Video Skill — Setup Check (Windows PowerShell)
# Run: pwsh -File scripts/setup.ps1
# Or:  powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$Green = "`e[0;32m"; $Red = "`e[0;31m"; $Reset = "`e[0m"
function ok($msg)   { Write-Host "  ${Green}+${Reset} $msg" }
function fail($msg) { Write-Host "  ${Red}x${Reset} $msg" }

Write-Host ""
Write-Host "Manim Video Skill — Setup Check (Windows)"
Write-Host ""

$errors = 0

# Python check (Windows: python or python3)
$pyCmd = $null
foreach ($cmd in @("python", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) { $pyCmd = $cmd; break }
}
if ($pyCmd) {
    $pyVer = & $pyCmd --version 2>&1
    ok "Python $pyVer"
} else {
    fail "Python not found — download from https://www.python.org/"
    $errors++
}

# Manim check
if ($pyCmd) {
    $manimCheck = & $pyCmd -c "import manim; print(manim.__version__)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        ok "Manim $manimCheck"
    } else {
        fail "Manim not installed: $pyCmd -m pip install manim"
        $errors++
    }
}

# LaTeX check (Windows: MiKTeX or TeX Live via pdflatex)
if (Get-Command pdflatex -ErrorAction SilentlyContinue) {
    ok "LaTeX (pdflatex)"
} else {
    fail "LaTeX not found — install MiKTeX: https://miktex.org/download"
    $errors++
}

# ffmpeg check
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    ok "ffmpeg"
} else {
    fail "ffmpeg not found — install via: winget install Gyan.FFmpeg  or  choco install ffmpeg"
    $errors++
}

Write-Host ""
if ($errors -eq 0) {
    Write-Host "${Green}All prerequisites satisfied.${Reset}"
} else {
    Write-Host "${Red}$errors prerequisite(s) missing.${Reset}"
    exit 1
}
Write-Host ""
