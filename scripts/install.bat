@echo off
rem ═══════════════════════════════════════════════════════════════════════
rem  Tailor CV — one-click installer (Windows)
rem
rem  Double-click this file. It launches the real installer (install.ps1)
rem  with the execution-policy bypass so Windows lets it run.
rem ═══════════════════════════════════════════════════════════════════════
title Tailor CV Installer
echo.
echo  ═══ Tailor CV installer ═══
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
