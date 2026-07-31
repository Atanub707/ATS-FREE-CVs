# Changelog

## v1.0.1 (2026-07-30)

### New Scrapers
- Added **RemoteOK** — free API, 100 latest remote jobs with no keyword restrictions
- Added **WeWorkRemotely** — 6 tech categories (full-stack, frontend, backend, devops, design, product) via HTML scraping

### Tailoring Engine
- **Two-tier keyword placement**: missing keywords go into experience bullets (full weight) or skills section (half weight). No keyword left behind.
- **Honest scoring**: score reflects actual keyword fill ratio. Breakdown shows Already Matched + Newly Integrated + Still Missing.
- **Keyword verification**: every claimed keyword is scanned against the actual CV text. Only verifiably present keywords are displayed.
- **Candidate title preserved**: `targetRole` always comes from Master CV's first experience. Never replaced by job posting title.
- **Auto gap analysis**: clicking Tailor on an unscored job automatically runs match first.
- **Three-tier audit display**: ✓ Integrated in Experience, + Added to Skills, ✕ Could Not Be Added.

### UI / UX
- **Contextual search suggestions**: 7 domains (DevOps, Cybersecurity, Software, Data/AI, Design, Management, Database) with role + skill suggestions.
- **Loading tooltips**: hover over Score/Tailor buttons during processing to see step-by-step messages.
- **Copy JD button**: copies full job description with clipboard fallback.
- **PDF-only downloads**: DOCX format removed.
- **Score badge clickable**: opens directly to tailored audit view.
- **Applied jobs tracker**: manual toggle per job, green card border, applied filter tab, navbar count, dashboard KPI.
- **Ask AI**: AI-generated summary suggestions in Master CV drawer (3 options with different tones).

### LinkedIn Fixes
- `f_WT=2` filter for remote-only job postings.
- Date filter now strictly respects selection (removed fallback that bypassed filter).
- Detail fetch delay reduced from 3-8s to 0.8-2s per job.
- `jobType` hardcoded to `Full-time · Remote` (since `f_WT=2` guarantees remote).
- "Show more" / "Show less" text stripped from descriptions.

### CI/CD
- **Gated pipeline**: gitleaks → npm audit → Trivy → Build. Security failures stop the pipeline.
- **Auto-release on every push**: executables + Docker image published automatically.
- Exception management via `.trivyignore` and `.npm-audit-allowlist`.
- Docker image at `ghcr.io/atanub707/ats-free-cvs:latest` and `:v1.0.1`.
- Step summaries for security scan results in Actions tab.

### Bug Fixes
- Scrape handler calling removed `runWithPopup` (caused infinite loading).
- JobCard memo comparison using wrong prop name (loading state never updated).
- Copy button navigating away due to missing `type="button"`.
- Separate score/tailor message state so each button shows its own independent tooltip.
- `config.ini` removed from git tracking (API key was exposed).

## v1.0.0 (2026-07-28)

- Initial release with LinkedIn, Arbeitnow, SimplyHired, Dice, Reed, Greenhouse, Lever scrapers.
- AI gap analysis + CV tailoring using multiple LLM providers.
- DOCX and PDF export.
- Docker + standalone executables for Linux, macOS, Windows.
