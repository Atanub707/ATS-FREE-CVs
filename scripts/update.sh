#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Tailor CV — one-click update (macOS / Linux)
#
#  Usage:  ./update.sh            (updates ~/tailor-cv)
#          ./update.sh /my/path   (updates a custom install folder)
#
#  Pulls the latest code and restarts the app. Your data is untouched.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="${1:-$HOME/tailor-cv}"
APP_URL="http://localhost:3000"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
fail() { printf "${RED}✘ %s${NC}\n" "$*"; exit 1; }

printf "${BOLD}\n═══ Tailor CV updater ═══\n${NC}\n"

[ -d "$APP_DIR/.git" ] || fail "No Tailor CV install found at $APP_DIR — run the installer first."
command -v docker >/dev/null 2>&1 || fail "Docker is not installed — run the installer first."

echo "Pulling the latest code…"
git -C "$APP_DIR" pull --ff-only || fail "Could not pull the update — check your connection."
ok "Code updated"

echo "Refreshing the app…"
docker compose -f "$APP_DIR/docker-compose.yml" up -d --build --pull missing || fail "docker compose failed — see the output above."
ok "Tailor CV updated and running"

sleep 2
open "$APP_URL" 2>/dev/null || true
printf "${BOLD}✅ Updated! The app is at ${GREEN}$APP_URL${NC}\n"
