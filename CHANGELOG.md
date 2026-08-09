# Changelog

## v1.3.0 (2026-08-09)

### 🎨 Manual JD polish (carried in this release)
- Tailoring Updates panel is now a compact dashboard: Impact cards (with before→after score bar), added-skills chip cloud, rewritten bullets showing **BEFORE (struck) → AFTER** text, "What's preserved" row, collapsible review list, and a single auto-saving Download button.
- Analysis panel always shows the honest current-CV score; the boosted score lives on the Tailor screen as `49% → 97%`.
- History restore fixed: the API returns `{ analysis, downloadToken }` with camelCase fields — the UI now unwraps it (previously restored records showed empty results).
- Stepper (Add JD → Analysis → Tailor) is centered; skill chips are deduplicated (`patching ×3`) and capped with "+N more".

## v1.2.0 (2026-08-04)

### ✨ AI CV Compression Assistant (Master CV)
- **AI Compress button** in the Master CV screen — analyzes your CV against **live market data** (keywords extracted from your recent scraped jobs for the target role) and compresses it to the industry-standard 1–2 pages.
- **3-phase engine**: Analyze (per-bullet guidance with reasons) → Rewrite (tightens & merges without losing meaning, weaves market keywords in) → Verify (deterministic keyword-preservation scan, stopword-filtered with word-boundary matching).
- **Uses your BYOK key**: same provider/model from Settings — nothing extra to configure.
- **Single-screen result**: hero outcome card (pages 3→2, % word reduction, market keywords added), a minimal "What changes" list (Tightened / Merged / Kept + reason), then side-by-side **Original (left) vs New CV (right)** at full width — pages auto-scale to fill the lane.
- **Apply** replaces the master CV after an automatic backup; **Versions** drawer restores any backup with one click; a confirmation modal shows before/after stats before applying.
- **Download new CV** (PDF) directly from the result view.

### 🖥️ Master CV screen polish
- Full-screen split editor with a **live, page-wise PDF preview** — content flows onto real A4 pages exactly like the downloaded PDF (headers never orphaned; repaginates as you type).
- Clean header: Back · Save (split button with Download PDF dropdown) · Versions; **AI Compress + PDF rename** live in the preview toolbar.
- Contact links in the preview now show **LinkedIn / GitHub / Portfolio** labels with hyperlinks instead of raw URLs.

### ⚡ Performance & reliability
- **No more global UI lock**: match/tailor processing no longer freezes the app — pagination, filters, deletes, and downloads stay live while jobs process in the background.
- **Batch match & tailor run 3 jobs concurrently** instead of one-by-one (up to ~3× faster batches).
- **Manual JD history**: every analysis is saved per user (SQLite) — restore any past analysis or its tailored CV anytime; history survives restarts.
- Manual JD redesigned: fixed input panel on the left, all insights (score ring, skill chips with why-tooltips, recommendations, tailoring diff with before→after bullet rewrites) on the right.
- **Back button** on all full-screen views (Manual JD, Master CV) — no more browser-history surprises.

### 🐛 Fixes
- `&amp;` literal text in PDF section titles.
- React hooks violation (hooks after early return) that crashed the Master CV screen on close.
- API-key audit advisories: undici + postcss updated (0 vulnerabilities).
- Applicant counts, jobType/under10Applicants param forwarding, and scraper fixes carried forward.

## v1.1.0 (2026-08-03)

### 🔐 Local Accounts & Data Isolation
- **Local sign-in**: create accounts with email + password (scrypt-hashed), or use password-less **guest accounts** (Guest 1, Guest 2…).
- **Per-account isolation**: every account has its own CV, job list, match history, and applied tracker. No more shared "one profile for everyone".
- **Cookie sessions**: httpOnly session cookie per browser, resolved per request — each person on the same machine sees only their own data.
- **One-click guest sign-in**: existing guests are listed on the login screen so switching accounts takes one click.
- **Safe migration**: existing installations are migrated automatically — your old jobs and CV are claimed by a new `Admin` guest account; nothing is lost.

### 🌍 Country-Specific Job Portals (6 new sources)
- **MyCareersFuture** 🇸🇬 Singapore (official government API)
- **Cutshort** 🇮🇳 India
- **Gupy** 🇧🇷 Brazil
- **JobsCh** 🇨🇭 Switzerland
- **Daijob** 🇯🇵 Japan
- **MyJobMag** 🇳🇬 Nigeria
- Source pills show country flags so you can spot regional postings at a glance.
- Greenhouse & Lever company-portal scrapers removed; RemoteOK / WeWorkRemotely parked as "Coming soon".

### 👥 Applicant Counts
- LinkedIn jobs now display **how many people applied** ("200 applicants") right in the listing and job detail — gauge competition without opening the posting.
- Parsed from the job page at scrape time (no extra requests); only shown when the source exposes the number.

### 💾 Real SQLite Storage
- Replaced JSON file storage with **SQLite (`better-sqlite3`)** — WAL mode, crash-safe, faster at scale.
- Legacy JSON data auto-imported on first run.
- **Server-side pagination**: list + stats (`/api/jobs/stats`) moved to the server; large job lists load in pages instead of all-at-once.

### 🎨 Professional Navbar
- Four items (guest chip, Manual JD, Master CV, Settings) consolidated into **one account menu** — avatar pill with dropdown: user card, Workspace (Master CV, Manual JD ⌘J), System (Settings ⌘,), Sign out.
- Duplicate metrics badge removed from the app bar (dashboard KPIs are the single source).
- Keyboard shortcuts: **⌘J** = Manual JD, **⌘,** = Settings.

### 🖱️ UX Improvements
- **Drag-and-drop reordering** for Work Experience, Projects, Certifications in the Master CV drawer.
- **Add-to-top** default for new Experience / Education / Skills / Projects / Certifications entries.
- Reliable **Download CV** (programmatic click survives re-renders during tailoring).
- Master CV form no longer wipes in-progress edits on background refreshes.

### 🐛 Fixes
- `jobType` / `under10Applicants` params were dropped by the scrape route — now forwarded correctly.
- Arbeitnow term matching (e.g. "DevOps Engineer" now returns results).
- MyJobMag date parsing regex; Cutshort slug→role mapping + 30s timeout + hybrid classification.

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
