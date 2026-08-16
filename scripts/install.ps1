# ═══════════════════════════════════════════════════════════════════════════
#  Tailor CV — one-click installer (Windows)
#
#  Launched by install.bat. Idempotent — safe to rerun.
#    1. Checks for Docker → installs Docker Desktop via winget (one UAC click)
#    2. Installs WSL2 if missing (first-time machines; may need one reboot)
#    3. Starts the Docker engine and waits until it is ready
#    4. Downloads Tailor CV (git clone) if not present
#    5. Runs `docker compose up -d` and opens the app in your browser
#
#  No code-signing needed: you run Docker Desktop (signed by Docker Inc),
#  so SmartScreen shows no warnings about this app.
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'

$AppDir  = Join-Path $env:USERPROFILE 'tailor-cv'
$RepoUrl = 'https://github.com/Atanub707/ATS-FREE-CVs.git'
$AppUrl  = 'http://localhost:3000'

function Say  ($m) { Write-Host $m -ForegroundColor White }
function Ok   ($m) { Write-Host "OK   $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "!!   $m" -ForegroundColor Yellow }
function Fail ($m) { Write-Host "XX   $m" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

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
    exit 0
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
    Fail 'WSL2 was installed. Restart your PC, then double-click install.bat again — it will skip straight to starting the app.'
  }
  Ok 'Docker Desktop installed'
}

# Compose v2 (bundled with Docker Desktop)?
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail 'docker compose v2 is missing — update Docker Desktop.' }

# ── 2. Docker engine ────────────────────────────────────────────────────────
if (-not (docker info *> $null)) {
  Say 'Starting Docker Desktop and waiting for the engine (first launch can take a minute)…'
  Start-Process 'Docker Desktop'
  $ready = $false
  for ($i = 0; $i -lt 120; $i++) {
    if (docker info *> $null) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { Fail 'The Docker engine did not start. Open Docker Desktop once, let it finish, then rerun this installer.' }
  Ok 'Docker engine is ready'
}

# ── 3. Get the app ──────────────────────────────────────────────────────────
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

# ── 4. Run ──────────────────────────────────────────────────────────────────
Say 'Starting Tailor CV…'
docker compose -f (Join-Path $AppDir 'docker-compose.yml') up -d --pull missing
if ($LASTEXITCODE -ne 0) { Fail 'docker compose failed — see the output above.' }
Ok 'Tailor CV is running'

Start-Sleep -Seconds 2
Start-Process $AppUrl

Say ''
Say '──────────────────────────────────────────────'
Say "Done! Tailor CV is ready at $AppUrl"
Say '  Sign in or continue as guest, then set your AI key:'
Say '  top-right menu -> Settings -> Integrations -> LLM & AI'
Say "  Stop it:     docker compose -f $(Join-Path $AppDir 'docker-compose.yml') down"
Say '  Update:      double-click update.bat'
Say '  Uninstall:   double-click uninstall.bat'
Say '──────────────────────────────────────────────'
Say ''
