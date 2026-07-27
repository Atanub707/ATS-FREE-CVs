#!/usr/bin/env bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║        ATS CV Tailor — One-Click Setup    ║${NC}"
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js is required but not installed.${NC}"
  echo ""
  echo -e "  ${BOLD}Download it here (free):${NC}"
  echo -e "  ${BLUE}https://nodejs.org/${NC}"
  echo ""
  echo -e "  Click the big green button that says ${BOLD}\"LTS\"${NC}"
  echo -e "  Install it like any other program (next → next → finish)."
  echo ""
  echo -e "  ${YELLOW}After installing, close this window and run this script again.${NC}"
  echo ""
  read -p "Press Enter to open the download page..." 
  open https://nodejs.org/ 2>/dev/null || xdg-open https://nodejs.org/ 2>/dev/null || true
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
echo -e "✓ ${GREEN}Node.js $(node -v)${NC} — ready"

# Download
if [ -d "ATS-FREE-CVs" ]; then
  cd ATS-FREE-CVs
  echo -e "✓ Using existing folder"
else
  echo ""
  echo -e "Downloading..."
  if command -v git &> /dev/null; then
    git clone --depth=1 https://github.com/Atanub707/ATS-FREE-CVs.git 2>/dev/null
  else
    curl -sL https://github.com/Atanub707/ATS-FREE-CVs/archive/main.zip -o ats.zip
    unzip -q ats.zip && mv ATS-FREE-CVs-main ATS-FREE-CVs && rm ats.zip
  fi
  cd ATS-FREE-CVs
  echo -e "✓ ${GREEN}Downloaded${NC}"
fi

# Install
echo ""
echo -e "Installing dependencies..."
npm install --loglevel=error 2>/dev/null
echo -e "✓ ${GREEN}Ready${NC}"

# Config
if [ ! -f config.ini ]; then
  cat > config.ini << 'EOF'
[thresholds]
minMatchForTailor=40
earlyBlockThreshold=30

[llm]
provider=gemini
apiKey=
baseUrl=
model=gemini-3.6-flash
temperature=0.2

[storage]
mode=sqlite
sqliteDbPath=./data/ats_jobs.sqlite
jsonDbPath=./data/jobs_backup.json

[scraper]
stealthMode=true
maxRetries=3
EOF
fi

# API Key
if grep -q '^apiKey=$' config.ini; then
  echo ""
  echo -e "${BOLD}LLM API Key${NC}"
  echo -e "This app needs an API key for AI features."
  echo ""
  echo -e "  ${BOLD}Free option — Google Gemini:${NC}"
  echo -e "  1. Go to ${BLUE}https://aistudio.google.com/apikey${NC}"
  echo -e "  2. Sign in with your Google account"
  echo -e "  3. Click \"Create API key\""
  echo -e "  4. Copy the key and paste it below"
  echo ""
  read -p "Paste your API key (or press Enter to skip): " API_KEY
  if [ -n "$API_KEY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/^apiKey=$/apiKey=$API_KEY/" config.ini
    else
      sed -i "s/^apiKey=$/apiKey=$API_KEY/" config.ini
    fi
    echo -e "✓ ${GREEN}API key saved${NC}"
  fi
fi

# Start
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Starting the app...                      ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "  Opening ${BLUE}http://localhost:3000${NC} in your browser..."
echo -e "  ${YELLOW}Press Ctrl+C to stop the app when done.${NC}"
echo ""

sleep 2
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || true
npm run dev
