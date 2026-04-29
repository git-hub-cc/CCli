# setup.ps1 — Automated setup for twozero MCP plugin for TouchDesigner (Windows PowerShell)
# Idempotent: safe to run multiple times.
#
# Usage:
#   pwsh -File scripts/setup.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$ErrorActionPreference = "SilentlyContinue"

$Green = "`e[0;32m"; $Red = "`e[0;31m"; $Yellow = "`e[1;33m"; $Cyan = "`e[0;36m"; $Reset = "`e[0m"
$OK   = "${Green}v${Reset}"
$FAIL = "${Red}x${Reset}"
$WARN = "${Yellow}!${Reset}"

$TWOZERO_URL  = "https://www.404zero.com/pisang/twozero.tox"
$TOX_PATH     = Join-Path $env:USERPROFILE "Downloads\twozero.tox"
$HERMES_HOME  = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:USERPROFILE ".hermes" }
$HERMES_CFG   = Join-Path $HERMES_HOME "config.yaml"
$MCP_PORT     = 40404
$MCP_ENDPOINT = "http://localhost:${MCP_PORT}/mcp"

$ManualSteps = @()

Write-Host ""
Write-Host "${Cyan}═══ twozero MCP for TouchDesigner — Setup (Windows) ═══${Reset}"
Write-Host ""

# ── 1. Check if TouchDesigner is running ──
$tdRunning = $false
$tdProc = Get-Process -Name "TouchDesigner*" -ErrorAction SilentlyContinue
if ($tdProc) {
    Write-Host " ${OK} TouchDesigner is running"
    $tdRunning = $true
} else {
    Write-Host " ${WARN} TouchDesigner is not running"
}

# ── 2. Ensure twozero.tox exists ──
if (Test-Path $TOX_PATH) {
    Write-Host " ${OK} twozero.tox already exists at $TOX_PATH"
} else {
    Write-Host " ${WARN} twozero.tox not found — downloading..."
    try {
        Invoke-WebRequest -Uri $TWOZERO_URL -OutFile $TOX_PATH -UseBasicParsing -ErrorAction Stop
        Write-Host " ${OK} Downloaded twozero.tox to $TOX_PATH"
    } catch {
        Write-Host " ${FAIL} Failed to download twozero.tox from $TWOZERO_URL"
        Write-Host "        Please download manually and place at $TOX_PATH"
        $ManualSteps += "Download twozero.tox from $TWOZERO_URL to $TOX_PATH"
    }
}

# ── 3. Ensure Hermes config has twozero_td MCP entry ──
if (-not (Test-Path $HERMES_CFG)) {
    Write-Host " ${FAIL} Hermes config not found at $HERMES_CFG"
    $ManualSteps += "Create $HERMES_CFG with twozero_td MCP server entry"
} elseif (Select-String -Path $HERMES_CFG -Pattern "twozero_td" -Quiet) {
    Write-Host " ${OK} twozero_td MCP entry exists in Hermes config"
} else {
    Write-Host " ${WARN} Adding twozero_td MCP entry to Hermes config..."
    $pyCmd = $null
    foreach ($cmd in @("python", "python3")) {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) { $pyCmd = $cmd; break }
    }
    if ($pyCmd) {
        $pyscript = @"
import yaml, sys
cfg_path = r'$HERMES_CFG'
with open(cfg_path, 'r') as f:
    cfg = yaml.safe_load(f) or {}
if 'mcp_servers' not in cfg:
    cfg['mcp_servers'] = {}
if 'twozero_td' not in cfg['mcp_servers']:
    cfg['mcp_servers']['twozero_td'] = {'url': '$MCP_ENDPOINT', 'timeout': 120, 'connect_timeout': 60}
    with open(cfg_path, 'w') as f:
        yaml.dump(cfg, f, default_flow_style=False, sort_keys=False)
"@
        $pyscript | & $pyCmd - 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ${OK} twozero_td MCP entry added to config"
        } else {
            Write-Host " ${FAIL} Could not update config (is PyYAML installed?)"
            $ManualSteps += "Add twozero_td MCP entry to $HERMES_CFG manually"
        }
    } else {
        Write-Host " ${FAIL} Python not found — cannot auto-update config"
        $ManualSteps += "Add twozero_td MCP entry to $HERMES_CFG manually"
    }
    $ManualSteps += "Restart Hermes session to pick up config change"
}

# ── 4. Test if MCP port is responding ──
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $tcpClient.Connect("127.0.0.1", $MCP_PORT)
    Write-Host " ${OK} Port $MCP_PORT is open"
    $tcpClient.Close()

    # ── 5. Verify MCP endpoint responds ──
    try {
        $resp = Invoke-WebRequest -Uri $MCP_ENDPOINT -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($resp.Content) {
            Write-Host " ${OK} MCP endpoint responded at $MCP_ENDPOINT"
        } else {
            Write-Host " ${WARN} Port open but MCP endpoint returned empty response"
            $ManualSteps += "Verify MCP is enabled in twozero settings"
        }
    } catch {
        Write-Host " ${WARN} Port open but MCP endpoint returned empty response"
        $ManualSteps += "Verify MCP is enabled in twozero settings"
    }
} catch {
    Write-Host " ${WARN} Port $MCP_PORT is not open"
    if ($tdRunning) {
        $ManualSteps += "In TD: drag twozero.tox into network editor → click Install"
        $ManualSteps += "Enable MCP: twozero icon → Settings → mcp → 'auto start MCP' → Yes"
    } else {
        $ManualSteps += "Launch TouchDesigner"
        $ManualSteps += "Drag twozero.tox into the TD network editor and click Install"
        $ManualSteps += "Enable MCP: twozero icon → Settings → mcp → 'auto start MCP' → Yes"
    }
}

# ── Status Report ──
Write-Host ""
Write-Host "${Cyan}═══ Status Report ═══${Reset}"
Write-Host ""

if ($ManualSteps.Count -eq 0) {
    Write-Host " ${OK} ${Green}Fully configured! twozero MCP is ready to use.${Reset}"
    Write-Host ""
    exit 0
} else {
    Write-Host " ${WARN} ${Yellow}Manual steps remaining:${Reset}"
    Write-Host ""
    for ($i = 0; $i -lt $ManualSteps.Count; $i++) {
        Write-Host "   $($i+1). $($ManualSteps[$i])"
    }
    Write-Host ""
    exit 1
}
