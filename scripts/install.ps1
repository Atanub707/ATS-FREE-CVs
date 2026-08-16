# ═══════════════════════════════════════════════════════════════════════════
#  Tailor CV — one-click installer (Windows)
#
#  Run via the copy-paste one-liner (irm | iex) or install.bat.
#  Idempotent — safe to rerun.
#
#  Architecture:
#    1. Check Docker CLI → install Docker Desktop via winget if missing
#    2. Install WSL2 if missing (first-time machines; may need one reboot)
#    3. START Docker Desktop explicitly
#    4. WAIT until the Docker engine is actually ready (docker info)
#    5. Verify docker compose v2
#    6. Download Tailor CV (git clone) if not present
#    7. Run docker compose up -d
#    8. Verify the app is healthy (HTTP check)
#
#  No code-signing needed: you run Docker Desktop (signed by Docker Inc),
#  so SmartScreen shows no warnings about this app.
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'

$AppDir  = Join-Path $env:USERPROFILE 'tailor-cv'
$RepoUrl = 'https://github.com/Atanub707/ATS-FREE-CVs.git'
$AppUrl  = 'http://localhost:3000'
$DockerDesktopExe = Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'

function Say  ($m) { Write-Host $m -ForegroundColor White }
function Ok   ($m) { Write-Host "OK   $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "!!   $m" -ForegroundColor Yellow }
function Fail ($m) { Write-Host "XX   $m" -ForegroundColor Red; Read-Host 'Press Enter to close'; return }

Say ''
Say '════ Tailor CV installer ════'
Say ''

# ── 0. Already running? ─────────────────────────────────────────────────────
try {
  $probe = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
  if ($probe.StatusCode -eq 200) {
    Warn "Tailor CV is already running at $AppUrl - nothing to do."
    Start-Process $AppUrl
    Read-Host 'Press Enter to close'
    return
  }
} catch { }

# ── 1. Docker CLI ───────────────────────────────────────────────────────────
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Ok 'Docker CLI found'
} else {
  Say 'Docker not found — installing Docker Desktop (one UAC prompt will appear, click Yes).'
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail 'winget is missing. Update Windows 10/11, or install Docker Desktop manually from https://www.docker.com/products/docker-desktop/'
  }
  winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Fail 'Could not install Docker Desktop via winget.' }

  # First-time machines: WSL2 itself may be missing.
  wsl --status *> $null
  if ($LASTEXITCODE -ne 0) {
    Warn 'WSL2 is missing — installing it now (this may take a few minutes).'
    wsl --install --no-distribution | Out-Host
    Fail 'WSL2 was installed. Restart your PC, then run the installer again — it will skip straight to starting the app.'
  }
  Ok 'Docker Desktop installed'
}

# ── 2. Start Docker Desktop EXPLICITLY ──────────────────────────────────────
# Installing Docker Desktop does NOT start the engine. Launch it by its full
# path so the Linux engine (dockerDesktopLinuxEngine pipe) actually comes up.
if (-not (Test-Path $DockerDesktopExe)) { $DockerDesktopExe = 'Docker Desktop' }
$engineReady = $false
if (docker info *> $null) {
  $engineReady = $true
} else {
  Say 'Starting Docker Desktop…'
  try { Start-Process $DockerDesktopExe } catch { Warn 'Could not launch Docker Desktop — please start it manually from the Start menu.' }

  # ── 3. WAIT for the engine (not just the CLI) ─────────────────────────────
  # First launch: Docker service → WSL2 init → Linux VM → engine → named pipe.
  # This can take 1–3 minutes. Poll docker info every 2s (90 attempts).
  Say 'Waiting for the Docker engine to be ready (first launch can take a few minutes)…'
  for ($i = 1; $i -le 90; $i++) {
    if (docker info *> $null) { $engineReady = $true; break }
    if ($i % 10 -eq 0) { Say "  still waiting… attempt $i/90" }
    Start-Sleep -Seconds 2
  }
}

if (-not $engineReady) {
  Fail 'The Docker engine did not become ready. Open Docker Desktop once, accept any first-run prompts, then run the installer again.'
}
Ok 'Docker engine is ready'

# ── 4. Verify compose v2 (bundled with Docker Desktop) ──────────────────────
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail 'docker compose v2 is missing — update Docker Desktop.' }
Ok 'docker compose v2 found'

# ── 5. Get the app ──────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $AppDir 'docker-compose.yml'))) {
  Say "Downloading Tailor CV to $AppDir"
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Warn 'git not found — installing it via winget.'
    winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements | Out-Null
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is required. Install it manually, then rerun.' }
  }
  New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
  git clone --depth 1 $RepoUrl $AppDir
  if ($LASTEXITCODE -ne 0) { Fail 'Could not download the app. Check your connection, or clone the repo manually.' }
  Ok 'App downloaded'
}

# ── 6. Run ──────────────────────────────────────────────────────────────────
Say 'Starting Tailor CV…'
docker compose -f (Join-Path $AppDir 'docker-compose.yml') up -d --pull missing
if ($LASTEXITCODE -ne 0) { Fail 'docker compose failed — see the output above.' }
Ok 'Tailor CV container started'

# ── 7. Verify the app is healthy ────────────────────────────────────────────
Say 'Verifying the app…'
$healthy = $false
for ($i = 1; $i -le 30; $i++) {
  try {
    $check = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($check.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if ($healthy) { Ok 'Tailor CV is running and healthy' } else { Warn 'The app started, but is still warming up — open the URL below in a moment.' }

Start-Process $AppUrl

Say ''
Say '──────────────────────────────────────────────'
Say "Done! Tailor CV is ready at $AppUrl"
Say '  Sign in or continue as guest, then set your AI key:'
Say '  top-right menu -> Settings -> Integrations -> LLM & AI'
Say "  Stop it:     docker compose -f $(Join-Path $AppDir 'docker-compose.yml') down"
Say '  Update:      run update.bat (or the same one-liner with update.ps1)'
Say '  Uninstall:   run uninstall.bat'
Say '──────────────────────────────────────────────'
Say ''
