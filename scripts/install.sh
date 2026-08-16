#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Tailor CV — one-click installer (macOS / Linux)
#
#  Usage:  ./install.sh            (installs to ~/tailor-cv)
#          ./install.sh /my/path   (installs to a custom folder)
#
#  What it does (idempotent — safe to rerun):
#    1. Checks for Docker → installs Docker Desktop via Homebrew if missing
#    2. Starts the Docker engine and waits until it is ready
#    3. Downloads Tailor CV (git clone) if not present
#    4. Runs `docker compose up -d` and opens the app in your browser
#
#  No code-signing needed: you run Docker Desktop (signed by Docker Inc),
#  so macOS shows no warnings about this script's app.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="${1:-$HOME/tailor-cv}"
REPO_URL="https://github.com/Atanub707/ATS-FREE-CVs.git"
APP_URL="http://localhost:3000"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
fail() { printf "${RED}✘ %s${NC}\n" "$*"; exit 1; }

printf "${BOLD}\n═══ Tailor CV installer ═══\n${NC}\n"

# ── 1. Docker CLI ───────────────────────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  ok "Docker CLI found"
else
  echo "Docker not found — installing Docker Desktop (signed by Docker Inc, no warnings)…"
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew not found — installing it first (takes a few minutes)…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null)"
  fi
  brew install --cask docker || fail "Could not install Docker Desktop via Homebrew."
  ok "Docker Desktop installed"
fi

# Compose v2 (bundled with Docker Desktop)?
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is missing — update Docker Desktop."

# ── 2. Docker engine ────────────────────────────────────────────────────────
if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker Desktop…"
  open -a Docker 2>/dev/null || warn "Could not launch Docker Desktop — please start it manually."
  echo "Waiting for the Docker engine (first launch can take a minute)…"
  ready=0
  for _ in $(seq 1 90); do
    if docker info >/dev/null 2>&1; then ready=1; break; fi
    printf "."; sleep 2
  done
  printf "\n"
  [ "$ready" = "1" ] || fail "The Docker engine did not start. Open Docker Desktop once, let it finish, then rerun this installer."
  ok "Docker engine is ready"
fi

# ── 3. Get the app ──────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
  echo "Downloading Tailor CV…"
  command -v git >/dev/null 2>&1 || fail "git is required. Install it (brew install git) and rerun."
  mkdir -p "$APP_DIR"
  git clone --depth 1 "$REPO_URL" "$APP_DIR" || fail "Could not download the app. Check your connection, or clone $REPO_URL manually."
  ok "App downloaded to $APP_DIR"
fi

# ── 4. Run ──────────────────────────────────────────────────────────────────
echo "Starting Tailor CV…"
docker compose -f "$APP_DIR/docker-compose.yml" up -d --pull missing || fail "docker compose failed — see the output above."
ok "Tailor CV is running"

sleep 2
echo "Opening $APP_URL in your browser…"
open "$APP_URL" 2>/dev/null || true

printf "${BOLD}\nDone! The app is running at ${GREEN}$APP_URL${NC}\n"
echo "Tip: stop it later with:  docker compose -f $APP_DIR/docker-compose.yml down"
