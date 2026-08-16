@echo off
rem Tailor CV — uninstaller (Windows). Double-click to remove the app + data.
title Tailor CV Uninstaller
echo.
echo  ═══ Tailor CV uninstaller ═══
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
