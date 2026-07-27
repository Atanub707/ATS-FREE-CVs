@echo off
title ATS CV Tailor — Setup
cls

echo.
echo ╔════════════════════════════════════════════╗
echo ║        ATS CV Tailor — Local Setup        ║
echo ╚════════════════════════════════════════════╝
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Node.js is not installed.
  echo Download it from: https://nodejs.org/ (LTS version)
  echo After installing, close and reopen this terminal, then run setup.bat again.
  pause
  exit /b 1
)

for /f "tokens=1" %%v in ('node -v') do set NODE_VER=%%v
echo ✓ Node.js %NODE_VER% detected

REM Clone or use existing
if exist "ATS-FREE-CVs" (
  cd ATS-FREE-CVs
  echo ✓ Using existing ATS-FREE-CVs folder
) else (
  echo.
  echo Step 1: Downloading the app...
  where git >nul 2>&1
  if %ERRORLEVEL% equ 0 (
    git clone https://github.com/Atanub707/ATS-FREE-CVs.git
    cd ATS-FREE-CVs
  ) else (
    echo Downloading ZIP...
    curl -sL https://github.com/Atanub707/ATS-FREE-CVs/archive/main.zip -o ats.zip
    tar -xf ats.zip
    move ATS-FREE-CVs-main ATS-FREE-CVs
    del ats.zip
    cd ATS-FREE-CVs
  )
  echo ✓ Downloaded
)

REM Install
echo.
echo Step 2: Installing dependencies...
call npm install --loglevel=error
echo ✓ Dependencies installed

REM Config
if not exist config.ini (
  echo [thresholds] > config.ini
  echo minMatchForTailor=40 >> config.ini
  echo earlyBlockThreshold=30 >> config.ini
  echo. >> config.ini
  echo [llm] >> config.ini
  echo provider=gemini >> config.ini
  echo apiKey= >> config.ini
  echo baseUrl= >> config.ini
  echo model=gemini-3.6-flash >> config.ini
  echo temperature=0.2 >> config.ini
  echo. >> config.ini
  echo [storage] >> config.ini
  echo mode=sqlite >> config.ini
  echo sqliteDbPath=./data/ats_jobs.sqlite >> config.ini
  echo jsonDbPath=./data/jobs_backup.json >> config.ini
  echo. >> config.ini
  echo [scraper] >> config.ini
  echo stealthMode=true >> config.ini
  echo maxRetries=3 >> config.ini
  echo adzunaAppId= >> config.ini
  echo adzunaApiKey= >> config.ini
  echo indeedPublisherId= >> config.ini
)

REM API key
echo.
echo Step 3: API Key
echo You need an LLM API key for ATS scoring and CV tailoring.
echo.
echo   Recommended (free): Google Gemini
echo   https://aistudio.google.com/apikey
echo.
echo   Other options:
echo   OpenAI     https://platform.openai.com/api-keys
echo   Anthropic  https://console.anthropic.com
echo.

findstr /b "apiKey=" config.ini | findstr /v "apiKey=$" >nul
if %ERRORLEVEL% neq 0 (
  set /p API_KEY="Paste your API key (or press Enter to skip): "
  if not "%API_KEY%"=="" (
    powershell -Command "(gc config.ini) -replace '^apiKey=$', 'apiKey=%API_KEY%' | Out-File config.ini"
    echo ✓ API key saved
  )
) else (
  echo ✓ API key already configured
)

REM Done
echo.
echo ╔════════════════════════════════════════════╗
echo ║  Setup complete!                           ║
echo ╚════════════════════════════════════════════╝
echo.
echo To start the app, run:
echo   cd ATS-FREE-CVs ^&^& npm run dev
echo.
echo Then open http://localhost:3000 in your browser.
echo.
pause
