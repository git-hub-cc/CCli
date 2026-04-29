# p5.js Skill — Headless Render Pipeline (Windows PowerShell)
# Renders a p5.js sketch to MP4 video via Puppeteer + ffmpeg
#
# Usage:
#   pwsh -File scripts/render.ps1 sketch.html output.mp4 [options]
#
# Options:
#   -Width       Canvas width (default: 1920)
#   -Height      Canvas height (default: 1080)
#   -Fps         Frames per second (default: 30)
#   -Duration    Duration in seconds (default: 10)
#   -Quality     CRF value 0-51 (default: 18, lower = better)
#   -FramesOnly  Only export frames, skip MP4 encoding
#
# Examples:
#   pwsh -File scripts/render.ps1 sketch.html output.mp4
#   pwsh -File scripts/render.ps1 sketch.html output.mp4 -Duration 30 -Fps 60
#   pwsh -File scripts/render.ps1 sketch.html output.mp4 -Width 3840 -Height 2160

param(
    [Parameter(Mandatory=$true,  Position=0)] [string]$Input,
    [Parameter(Mandatory=$true,  Position=1)] [string]$Output,
    [int]    $Width      = 1920,
    [int]    $Height     = 1080,
    [int]    $Fps        = 30,
    [int]    $Duration   = 10,
    [int]    $Quality    = 18,
    [switch] $FramesOnly
)

$ErrorActionPreference = "Stop"

$TotalFrames = $Fps * $Duration
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrameDir    = Join-Path $env:TEMP ("p5js_frames_" + [System.IO.Path]::GetRandomFileName().Replace(".",""))
New-Item -ItemType Directory -Path $FrameDir -Force | Out-Null

Write-Host "=== p5.js Render Pipeline (Windows) ==="
Write-Host "Input:      $Input"
Write-Host "Output:     $Output"
Write-Host "Resolution: ${Width}x${Height}"
Write-Host "FPS:        $Fps"
Write-Host "Duration:   ${Duration}s ($TotalFrames frames)"
Write-Host "Quality:    CRF $Quality"
Write-Host "Frame dir:  $FrameDir"
Write-Host ""

# Check dependencies
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Error: Node.js required. Install: https://nodejs.org/  or  winget install OpenJS.NodeJS"
    exit 1
}
if (-not $FramesOnly -and -not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Error "Error: ffmpeg required for MP4. Install: winget install Gyan.FFmpeg  or  choco install ffmpeg"
    exit 1
}

# Step 1: Capture frames via Puppeteer
Write-Host "Step 1/2: Capturing $TotalFrames frames..."
$ExportScript = Join-Path $ScriptDir "export-frames.js"
& node $ExportScript $Input --output $FrameDir --width $Width --height $Height --frames $TotalFrames --fps $Fps
if ($LASTEXITCODE -ne 0) { Write-Error "Frame capture failed."; exit 1 }
Write-Host "Frames captured to $FrameDir"

if ($FramesOnly) {
    Write-Host "Frames saved to: $FrameDir"
    Write-Host "To encode manually:"
    Write-Host "  ffmpeg -framerate $Fps -i `"$FrameDir\frame-%04d.png`" -c:v libx264 -crf $Quality -pix_fmt yuv420p `"$Output`""
    exit 0
}

# Step 2: Encode to MP4
Write-Host "Step 2/2: Encoding MP4..."
$LogFile = Join-Path $FrameDir "ffmpeg.log"
& ffmpeg -y -framerate $Fps -i "$FrameDir\frame-%04d.png" `
    -c:v libx264 -preset slow -crf $Quality -pix_fmt yuv420p -movflags +faststart `
    $Output 2>$LogFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ffmpeg error — see log: $LogFile"
    exit 1
}

# Cleanup
Remove-Item -Recurse -Force $FrameDir

# Report
$FileSize = (Get-Item $Output).Length / 1MB
Write-Host ""
Write-Host "=== Done ==="
Write-Host "Output:   $Output ($([math]::Round($FileSize,1)) MB)"
Write-Host "Duration: ${Duration}s at ${Fps}fps, ${Width}x${Height}"
