@echo off
rem ═══════════════════════════════════════════════════════════════════════
rem  Tailor CV — one-click installer (Windows)
rem
rem  HOW TO USE (no technical knowledge needed):
rem    1. Download ONLY this file (install.bat)
rem    2. Double-click it
rem    3. Click "Yes" on the one Windows prompt
rem    4. Done — the browser opens with Tailor CV
rem
rem  This file downloads the installer engine (install.ps1) automatically,
rem  so it works as a single-file installer.
rem ═══════════════════════════════════════════════════════════════════════
setlocal
title Tailor CV Installer
echo.
echo  ═══ Tailor CV installer ═══
echo.

set "ENGINE_URL=https://github.com/Atanub707/ATS-FREE-CVs/raw/main/scripts/install.ps1"

if not exist "%~dp0install.ps1" (
    echo Downloading the installer engine (one time)...
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%ENGINE_URL%' -OutFile '%~dp0install.ps1' -UseBasicParsing } catch { exit 1 }" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo  XX Could not download the installer engine. Check your internet
        echo     connection, or download both files manually from the repository:
        echo     scripts/install.bat  +  scripts/install.ps1
        echo.
        pause
        exit /b 1
    )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
