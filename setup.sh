#!/usr/bin/env bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║        ATS CV Tailor — Local Setup        ║${NC}"
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}Node.js is not installed.${NC}"
  echo "Download and install it from: https://nodejs.org/ (LTS version recommended)"
  echo "After installing, close and reopen your terminal, then run this script again."
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
echo -e "✓ Node.js ${GREEN}$(node -v)${NC} detected"

# Clone or use existing
if [ -d "ATS-FREE-CVs" ]; then
  cd ATS-FREE-CVs
  echo -e "✓ Using existing ${GREEN}ATS-FREE-CVs${NC} folder"
else
  echo ""
  echo -e "${BOLD}Step 1: Downloading the app...${NC}"
  if command -v git &> /dev/null; then
    git clone https://github.com/Atanub707/ATS-FREE-CVs.git
    cd ATS-FREE-CVs
  else
    echo -e "${YELLOW}git not found — downloading ZIP instead...${NC}"
    curl -sL https://github.com/Atanub707/ATS-FREE-CVs/archive/main.zip -o ats.zip
    unzip -q ats.zip
    mv ATS-FREE-CVs-main ATS-FREE-CVs
    rm ats.zip
    cd ATS-FREE-CVs
  fi
  echo -e "✓ ${GREEN}Downloaded${NC}"
fi

# Install dependencies
echo ""
echo -e "${BOLD}Step 2: Installing dependencies...${NC}"
npm install --loglevel=error
echo -e "✓ ${GREEN}Dependencies installed${NC}"

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

# API key prompt
echo ""
echo -e "${BOLD}Step 3: API Key${NC}"
echo -e "You need an LLM API key for ATS scoring and CV tailoring."
echo ""
echo -e "  ${BOLD}Recommended (free):${NC}"
echo -e "  Google Gemini → https://aistudio.google.com/apikey"
echo ""
echo -e "  ${BOLD}Other options:${NC}"
echo -e "  OpenAI        → https://platform.openai.com/api-keys"
echo -e "  Anthropic     → https://console.anthropic.com"
echo -e "  OpenRouter    → https://openrouter.ai/keys"
echo ""

if grep -q '^apiKey=$' config.ini; then
  read -p "Paste your API key (or press Enter to skip): " API_KEY
  if [ -n "$API_KEY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/^apiKey=$/apiKey=$API_KEY/" config.ini
    else
      sed -i "s/^apiKey=$/apiKey=$API_KEY/" config.ini
    fi
    echo -e "✓ ${GREEN}API key saved${NC}"
  fi
else
  echo -e "✓ ${GREEN}API key already configured${NC}"
fi

# Summary
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Setup complete!                           ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "  Run this command to start:"
echo ""
echo -e "  ${BOLD}cd ATS-FREE-CVs && npm run dev${NC}"
echo ""
echo -e "  Then open: ${BOLD}http://localhost:3000${NC}"
echo ""
echo -e "  ${YELLOW}Tip:${NC} Set your provider in Settings → LLM Provider"
echo ""
