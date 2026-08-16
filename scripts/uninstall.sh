#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Tailor CV — uninstall (macOS / Linux)
#
#  Usage:  ./uninstall.sh         (removes ~/tailor-cv)
#          ./uninstall.sh /my/path
#
#  Stops the app and deletes ALL Tailor CV files, including your data
#  (jobs, CV, history). Export anything you need first.
#  Docker Desktop itself stays installed.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="${1:-$HOME/tailor-cv}"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }

printf "${BOLD}\n═══ Tailor CV uninstaller ═══\n${NC}\n"
warn "This deletes the app AND your data (jobs, CV, history) at $APP_DIR."

read -r -p "Type YES to confirm: " answer
[ "$answer" = "YES" ] || { echo "Cancelled."; exit 0; }

if [ -f "$APP_DIR/docker-compose.yml" ]; then
  echo "Stopping the app…"
  docker compose -f "$APP_DIR/docker-compose.yml" down --rmi local --volumes 2>/dev/null || true
  ok "App stopped"
fi

rm -rf "$APP_DIR"
ok "Removed $APP_DIR"

printf "${BOLD}✅ Tailor CV uninstalled. Docker Desktop stays for your other projects.\n${NC}"
