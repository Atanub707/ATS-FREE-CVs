# Tailor CV — uninstaller (Windows). Launched by uninstall.bat.
# Deletes the app AND your data (jobs, CV, history) at ~\tailor-cv.
# Docker Desktop stays installed.
$AppDir = Join-Path $env:USERPROFILE 'tailor-cv'

function Say  ($m) { Write-Host $m -ForegroundColor White }
function Ok   ($m) { Write-Host "OK   $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "!!   $m" -ForegroundColor Yellow }

Say ''
Say '════ Tailor CV uninstaller ════'
Say ''
Warn "This deletes the app AND your data (jobs, CV, history) at $AppDir"
$answer = Read-Host 'Type YES to confirm'
if ($answer -ne 'YES') { Say 'Cancelled.'; exit 0 }

if (Test-Path (Join-Path $AppDir 'docker-compose.yml')) {
  Say 'Stopping the app…'
  docker compose -f (Join-Path $AppDir 'docker-compose.yml') down --rmi local --volumes 2>$null
  Ok 'App stopped'
}

Remove-Item -Recurse -Force $AppDir -ErrorAction SilentlyContinue
Ok "Removed $AppDir"

Say ''
Say 'Done. Tailor CV is uninstalled. Docker Desktop stays for your other projects.'
Say ''
