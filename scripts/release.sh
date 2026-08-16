#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Tailor CV — release script
#
#  Usage:
#    ./scripts/release.sh v1.5.0 "UI polish & interview fixes"   # real release
#    ./scripts/release.sh v1.5.0 "Title" --dry-run              # preview only
#
#  What it does (follows docs/RELEASE-TEMPLATE.md):
#    1. Validates the version format (vX.Y.Z)
#    2. Checks the CHANGELOG has a "## vX.Y.Z" section — if missing, it
#       scaffolds one from the release template (you fill it in)
#    3. Ensures the working tree is clean
#    4. Commits the changelog, creates the tag, pushes tag + main
#    Then CI publishes the notes-only release automatically.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

VERSION="${1:-}"
TITLE="${2:-}"
DRY="${3:-}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
fail() { printf "${RED}✘ %s${NC}\n" "$*"; exit 1; }

printf "${BOLD}\n═══ Tailor CV release ═══\n${NC}\n"

# ── 1. Validate ─────────────────────────────────────────────────────────────
[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Usage: ./scripts/release.sh vX.Y.Z \"Title\" [--dry-run]"
TITLE="${TITLE:-Tailor CV ${VERSION}}"
DRY_RUN=false
[ "$DRY" = "--dry-run" ] && DRY_RUN=true
[ "$DRY_RUN" = true ] && warn "DRY-RUN — nothing will be committed or pushed."

# ── 2. CHANGELOG section ────────────────────────────────────────────────────
CHANGELOG="CHANGELOG.md"
if ! awk "/^## ${VERSION}/{found=1} found" "$CHANGELOG" | grep -q "^## ${VERSION}"; then
  warn "No \"## ${VERSION}\" section in $CHANGELOG — scaffolding one from the template."
  TODAY=$(date +%Y-%m-%d)
  cat > /tmp/release-section.md <<EOF
## ${VERSION} (${TODAY})

### ✨ Features
- 

### 🐛 Fixes
- 

### ⚠️ Known Issues
- 

### 🔄 Breaking Changes
- None.

### 📦 How to Update
- Re-run your platform installer (install.sh / install.bat / the PowerShell one-liner) — data is untouched.

EOF
  python3 - "$CHANGELOG" <<'PY'
import sys
path = sys.argv[1]
section = open('/tmp/release-section.md').read()
with open(path) as f:
    content = f.read()
# insert after the first "# Changelog" header
header_end = content.index('\n', content.index('# Changelog')) + 1
with open(path, 'w') as f:
    f.write(content[:header_end] + '\n' + section + content[header_end:])
PY
  ok "Scaffolded \"## ${VERSION}\" — edit $CHANGELOG and fill in the Features/Fixes, then rerun this script."
  [ "$DRY_RUN" = false ] || { echo "  (dry-run: scaffolding shown above, nothing saved)"; rm -f /tmp/release-section.md; exit 0; }
  exit 0
fi
ok "CHANGELOG section \"## ${VERSION}\" found"

# ── 3. Clean tree ───────────────────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  fail "Working tree is not clean — commit or stash first."
fi
ok "Working tree clean"

# ── 4. Commit / tag / push ──────────────────────────────────────────────────
if git tag -l "$VERSION" | grep -q "$VERSION"; then
  fail "Tag $VERSION already exists — delete it first if you meant to re-release (git tag -d $VERSION && git push origin :$VERSION)."
fi

if [ "$DRY_RUN" = true ]; then
  echo
  echo "── Dry-run summary ──"
  echo "  would tag:        $VERSION"
  echo "  release title:    $TITLE"
  echo "  would push:       main + tag $VERSION"
  echo "  CI then creates:  notes-only release from the CHANGELOG section"
  exit 0
fi

git tag "$VERSION" -m "$TITLE"
ok "Tagged $VERSION"
git push origin main
git push origin "$VERSION"
ok "Pushed main + $VERSION — CI will publish the release notes."
printf "${BOLD}Release published: ${GREEN}https://github.com/Atanub707/ATS-FREE-CVs/releases/tag/${VERSION}${NC}\n"
