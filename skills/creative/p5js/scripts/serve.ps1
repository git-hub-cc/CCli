# p5.js Skill — Local Development Server (Windows PowerShell)
# Serves the current directory over HTTP for loading local assets (fonts, images)
#
# Usage:
#   pwsh -File scripts/serve.ps1 [Port] [Directory]
#
# Examples:
#   pwsh -File scripts/serve.ps1                      # serve CWD on port 8080
#   pwsh -File scripts/serve.ps1 3000                 # serve CWD on port 3000
#   pwsh -File scripts/serve.ps1 8080 .\my-project    # serve specific directory

param(
    [int]    $Port      = 8080,
    [string] $Directory = "."
)

$ResolvedDir = Resolve-Path $Directory

Write-Host "=== p5.js Dev Server (Windows) ==="
Write-Host "Serving: $ResolvedDir"
Write-Host "URL:     http://localhost:$Port"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

# Try Python first, then npx serve
$pyCmd = $null
foreach ($cmd in @("python", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) { $pyCmd = $cmd; break }
}

Push-Location $ResolvedDir
try {
    if ($pyCmd) {
        & $pyCmd -m http.server $Port
    } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        Write-Host "Python not found. Using npx serve..."
        & npx serve -l $Port .
    } else {
        Write-Error "Error: Need Python or Node.js (npx) to run a local server.`nInstall Python: https://www.python.org/  or  winget install Python.Python.3"
        exit 1
    }
} finally {
    Pop-Location
}
