# Tailor CV — updater (Windows). Launched by update.bat.
$ErrorActionPreference = 'Stop'
$AppDir = Join-Path $env:USERPROFILE 'tailor-cv'
$AppUrl = 'http://localhost:3000'

function Say  ($m) { Write-Host $m -ForegroundColor White }
function Ok   ($m) { Write-Host "OK   $m" -ForegroundColor Green }
function Fail ($m) { Write-Host "XX   $m" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

Say ''
Say '════ Tailor CV updater ════'
Say ''

if (-not (Test-Path (Join-Path $AppDir '.git'))) { Fail "No Tailor CV install found at $AppDir — run the installer first." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail 'Docker is not installed — run the installer first.' }

Say 'Pulling the latest code…'
git -C $AppDir pull --ff-only
if ($LASTEXITCODE -ne 0) { Fail 'Could not pull the update — check your connection.' }
Ok 'Code updated'

Say 'Refreshing the app…'
docker compose -f (Join-Path $AppDir 'docker-compose.yml') up -d --build --pull missing
if ($LASTEXITCODE -ne 0) { Fail 'docker compose failed — see the output above.' }
Ok 'Tailor CV updated and running'

Start-Sleep -Seconds 2
Start-Process $AppUrl
Say ''
Say "Done! The app is at $AppUrl"
Say ''
