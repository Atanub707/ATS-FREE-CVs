@echo off
rem Tailor CV — updater (Windows). Double-click to update.
title Tailor CV Updater
echo.
echo  ═══ Tailor CV updater ═══
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
echo.
pause
