# gh-env.ps1 — GitHub environment detection helper for Hermes Agent skills (Windows PowerShell)
#
# Usage (dot-source to export variables into current session):
#   . skills/github/github-auth/scripts/gh-env.ps1
#
# After sourcing, these variables are set in the current scope:
#   $GH_AUTH_METHOD  - "gh", "curl", or "none"
#   $GITHUB_TOKEN    - personal access token (set if method is "curl")
#   $GH_USER         - GitHub username
#   $GH_OWNER        - repo owner  (only if inside a git repo with a github remote)
#   $GH_REPO         - repo name   (only if inside a git repo with a github remote)
#   $GH_OWNER_REPO   - owner/repo  (only if inside a git repo with a github remote)

$GH_AUTH_METHOD = "none"
$GITHUB_TOKEN   = if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } else { "" }
$GH_USER        = ""

# --- Auth detection ---

# Try gh CLI
if ((Get-Command gh -ErrorAction SilentlyContinue) -and (gh auth status 2>&1 | Out-Null; $LASTEXITCODE -eq 0)) {
    $GH_AUTH_METHOD = "gh"
    $GH_USER = (gh api user --jq '.login' 2>&1)
}
elseif ($GITHUB_TOKEN) {
    $GH_AUTH_METHOD = "curl"
}
else {
    # Try reading from %USERPROFILE%\.hermes\.env
    $hermesEnv = Join-Path $env:USERPROFILE ".hermes\.env"
    if (Test-Path $hermesEnv) {
        $line = Get-Content $hermesEnv | Where-Object { $_ -match "^GITHUB_TOKEN=" } | Select-Object -First 1
        if ($line) {
            $GITHUB_TOKEN = ($line -replace "^GITHUB_TOKEN=", "").Trim()
            if ($GITHUB_TOKEN) { $GH_AUTH_METHOD = "curl" }
        }
    }
    # Try reading from git credential store (%USERPROFILE%\.git-credentials)
    if ($GH_AUTH_METHOD -eq "none") {
        $gitCreds = Join-Path $env:USERPROFILE ".git-credentials"
        if (Test-Path $gitCreds) {
            $line = Get-Content $gitCreds | Where-Object { $_ -match "github\.com" } | Select-Object -First 1
            if ($line -match "https://[^:]+:([^@]+)@") {
                $GITHUB_TOKEN = $Matches[1]
                if ($GITHUB_TOKEN) { $GH_AUTH_METHOD = "curl" }
            }
        }
    }
    # Try Windows Credential Manager (git for Windows stores tokens here)
    if ($GH_AUTH_METHOD -eq "none") {
        try {
            $credResult = cmdkey /list:git:https://github.com 2>&1
            if ($credResult -match "User: ") {
                # Token is managed by Windows Credential Manager; gh CLI or git will use it automatically.
                # We can't extract the raw token here, so flag as "wincredman"
                $GH_AUTH_METHOD = "wincredman"
            }
        } catch {}
    }
}

# Resolve username for curl method
if ($GH_AUTH_METHOD -eq "curl" -and -not $GH_USER) {
    try {
        $apiResp = Invoke-RestMethod -Uri "https://api.github.com/user" `
            -Headers @{ Authorization = "token $GITHUB_TOKEN" } -ErrorAction SilentlyContinue
        $GH_USER = $apiResp.login
    } catch {}
}

# --- Repo detection (if inside a git repo with a GitHub remote) ---

$GH_OWNER      = ""
$GH_REPO       = ""
$GH_OWNER_REPO = ""

try {
    $remoteUrl = git remote get-url origin 2>&1
    if ($LASTEXITCODE -eq 0 -and $remoteUrl -match "github\.com") {
        # Handle both SSH (git@github.com:owner/repo.git) and HTTPS
        if ($remoteUrl -match "github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$") {
            $GH_OWNER      = $Matches[1]
            $GH_REPO       = $Matches[2]
            $GH_OWNER_REPO = "$GH_OWNER/$GH_REPO"
        }
    }
} catch {}

# --- Summary ---

Write-Host "GitHub Auth: $GH_AUTH_METHOD"
if ($GH_USER)       { Write-Host "User: $GH_USER" }
if ($GH_OWNER_REPO) { Write-Host "Repo: $GH_OWNER_REPO" }
if ($GH_AUTH_METHOD -eq "none") {
    Write-Host "WARNING: Not authenticated — see github-auth skill"
}

# Export to environment (so child processes can see them)
$env:GH_AUTH_METHOD = $GH_AUTH_METHOD
$env:GITHUB_TOKEN   = $GITHUB_TOKEN
$env:GH_USER        = $GH_USER
$env:GH_OWNER       = $GH_OWNER
$env:GH_REPO        = $GH_REPO
$env:GH_OWNER_REPO  = $GH_OWNER_REPO
