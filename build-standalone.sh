#!/usr/bin/env bash
set -e

echo "Building ATS CV Tailor — Standalone Executable"
echo "==============================================="

# 1. Install deps
echo "[1/5] Installing dependencies..."
npm install --loglevel=error

# 2. Build frontend
echo "[2/5] Building frontend..."
npx vite build

# 3. Bundle server + all dependencies into one file
echo "[3/5] Bundling server..."
npx esbuild server.ts --bundle --platform=node --format=cjs --outfile=dist/bundle.cjs

# 4. Create SEA blob
echo "[4/5] Creating SEA blob..."
node --experimental-sea-config sea-config.json

# 5. Create executable
echo "[5/5] Creating executable..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  NODE_BIN=$(which node)
  cp "$NODE_BIN" dist/ats-cv-tailor
  npx postject dist/ats-cv-tailor NODE_SEA_BLOB dist/sea.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA
  echo ""
  echo "✅ Created: dist/ats-cv-tailor (macOS executable)"
  echo "   Double-click or run: ./dist/ats-cv-tailor"
  echo "   Open http://localhost:3000"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  NODE_BIN=$(which node)
  cp "$NODE_BIN" dist/ats-cv-tailor
  npx postject dist/ats-cv-tailor NODE_SEA_BLOB dist/sea.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
  echo ""
  echo "✅ Created: dist/ats-cv-tailor (Linux executable)"
  echo "   Run: ./dist/ats-cv-tailor"
  echo "   Open http://localhost:3000"

else
  # Windows
  where node >nul 2>&1
  if %ERRORLEVEL% equ 0 (
    copy "%ProgramFiles%\nodejs\node.exe" dist\ats-cv-tailor.exe
    npx postject dist\ats-cv-tailor.exe NODE_SEA_BLOB dist\sea.blob ^
      --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    echo ✅ Created: dist\ats-cv-tailor.exe
    echo    Double-click to run
    echo    Open http://localhost:3000
  )
fi
