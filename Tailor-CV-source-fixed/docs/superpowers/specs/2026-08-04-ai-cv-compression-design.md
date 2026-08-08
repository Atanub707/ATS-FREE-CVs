# Design — AI CV Compression Assistant

**Date:** 2026-08-04
**Status:** Approved (design + UI mockup validated)
**Applies to:** Master CV screen (`MasterCvScreen.tsx`), server (`server.ts`, new `server/ai/`)

## Problem

The Master CV grows to 3–4+ pages as users keep adding skills and experience. CV standards say 1–2 pages. Users cannot tell what to cut by hand, and manual cuts risk losing ATS keywords or meaning.

## Goals

1. Add an **AI assistant** inside the Master CV screen that compresses the CV to 1–2 pages **without losing any main keywords or meaning**.
2. Guidance is **professional, visual, and explained in short English** — every change shows *why*.
3. The AI uses **current market data** (the user's own recent scraped jobs for the target role) plus the LLM's knowledge as fallback.
4. Uses the **user's BYOK config** — same provider/model/API key from Settings (existing `ask()` in `llmAdapter.ts`).
5. Safety: **automatic backup + one-click restore**, and a **confirmation modal** before applying.

## Non-Goals

- No real-time web browsing (no search API key). Market data comes from the app's scraped jobs only.
- No auto-replace without user consent (user picks "Use this version").
- No changes to PDF generation or the tailored-CV flow.

## UX / UI (validated via `ai-compress-mockup.html`)

### Entry points (Master CV screen header)
- **"✨ AI Compress"** button (primary, gradient, pulsing sparkle icon).
- **"Versions"** button (opens history drawer).

### Progress overlay
Shows 4 animated steps with a determinate progress bar:
1. Reading the market — N live job postings (target role)
2. Analyzing your CV (bullets, sections)
3. Rewriting — tightening & merging without losing meaning
4. Verifying keywords & page count

### Result — side-by-side compare
- Left: **Original** (page count, word count).
- Right: **AI compressed** (page count, word count, % reduction), rendered with the existing `CvPdfPreview` (page-wise).
- Header badge: ~~3 pages~~ → **2 pages**.
- Verification banner: "All N keywords preserved · X tightened · Y merged · 0 dropped" (warning variant if anything dropped).
- AI version styling: tightened keywords highlighted (blue), new market keywords (green), metrics bolded.

### Guidance strip
"✦ What changed — and why" — three cards:
- **TIGHTENED** (n bullets) — each with short reason
- **MERGED** (n bullets) — each with short reason
- **KEPT AS-IS** (n bullets) — short reason

### Accept flow
- "Use this version" → confirmation modal:
  - Stats: pages before → after, bullets kept (x/y), keywords preserved (n)
  - "What changes:" summary (tightened/merged/dropped, metrics preserved, +market keywords added)
  - Note: original saved as auto-backup
  - Buttons: "Keep original" / "Yes, apply & backup"
- On accept: backup created, Master CV replaced, toast "Applied! Original backed up — restore anytime via Versions".

### Versions drawer
- Active version marked ACTIVE.
- Auto-backup entry ("Before AI compression — 3 pages") with Restore button.
- Manual saves (if versioned) with Restore.

## Architecture

```
┌─ Frontend (MasterCvScreen) ────────────────────────────────┐
│  AI Compress button → progress → side-by-side → guidance   │
│  → confirm modal → accept/backup/restore                    │
└──────────────────────────┬─────────────────────────────────┘
                           │ REST
┌──────────────────────────▼─────────────────────────────────┐
│ Server                                                      │
│  server/ai/cvCompressor.ts  — phase orchestration           │
│    Phase 1 analyzeCv()   → guidance (per bullet, why)       │
│    Phase 2 rewriteCv()   → compressed CV (TailoredCv shape) │
│    Phase 3 verify()      → deterministic keyword scan       │
│  server/ai/marketData.ts — recent scraped jobs → keywords   │
│  storage: cv_versions table (backups)                       │
└─────────────────────────────────────────────────────────────┘
        All LLM calls via existing ask() → BYOK config
```

### New server files
- `server/ai/marketData.ts`
  - `getMarketData(targetRole: string)`: query recent scraped jobs (SQLite `jobs` table) whose title matches the target role keywords (reuse the title→role matching approach from the matcher). Extract top keywords/requirements by frequency from descriptions (deterministic token/category frequency — same keyword extraction style as `extractSkillsFromText` used elsewhere). Return `{ jobCount, topKeywords: string[], sampleRequirements: string[] }`.
  - Fallback: if no matching jobs, return empty market data; the prompt notes "no live market data — using model knowledge".
- `server/ai/cvCompressor.ts`
  - `compressCv(masterCv, targetRole, marketData): Promise<CompressResult>` — orchestrates the 3 phases with `ask()` (temp 0.2, JSON-only prompts like the tailor engine).
  - Phase 1 `analyzeCv` → `{ sections: [{ name, changes: [{ type: 'tighten'|'merge'|'keep', bulletIndexes: number[], reason: string }] }] }` (strict JSON).
  - Phase 2 `rewriteCv` → compressed CV in `TailoredCv` shape (same schema as `llmCvTailor` output so `CvPdfPreview` / pdfkit can consume it).
  - Phase 3 `verify` (no LLM): extract keywords from every original bullet (tokenization + known-skill list), scan compressed output, return `{ preserved: string[], dropped: string[], count: number }`.
  - Target pages: 1 page for junior/early roles (< 3 yrs or "entry"), 2 pages otherwise (10+ yrs still 2 max). Passed as instruction to the LLM.
  - **Page counting is client-side:** the frontend renders both CVs in `CvPdfPreview` (which already paginates and knows its page count) and derives `pagesBefore`/`pagesAfter` from the rendered previews. The server only returns deterministic `wordCountBefore`/`wordCountAfter` (plain text split).

### API endpoints (server.ts)
- `POST /api/cv/ai/analyze`
  - Body: `{ targetRole?: string }` (optional override; default = first experience title).
  - Runs marketData → phase 1 → phase 2 → phase 3.
  - Returns `{ success, guidance, compressedCv, verification, marketSummary, wordCountBefore, wordCountAfter }`.
  - Errors: 400 if no master CV; 500 with message if LLM fails (original untouched).
  - (`pagesBefore`/`pagesAfter` are computed on the frontend from the rendered previews — see cvCompressor phase notes.)
- `POST /api/cv/ai/accept`
  - Body: `{ compressedCv }` (the TailoredCv-shape object from analyze).
  - Server: (1) create backup of current master CV in `cv_versions` with note "Before AI compression — N pages", (2) convert compressedCv back to MasterCv shape (reverse of `masterCvToPdfShape` — map contactInfo/experience/skills/education/certs back), (3) `saveMasterCv`, (4) return updated master CV.
  - Note: the compressed CV is a *working master CV* (not a one-off tailored artifact) — user keeps editing it afterward.
- `GET /api/cv/versions` — list `{ id, note, pages, createdAt, isActive? }` for the current user.
- `POST /api/cv/versions/:id/restore` — restore a version as the master CV.
- `DELETE /api/cv/versions/:id` — optional delete.

### Storage
- New table `cv_versions`:
  ```
  id TEXT PRIMARY KEY, user_id TEXT, data TEXT (MasterCv JSON), note TEXT, pages INTEGER, created_at TEXT
  ```
- Functions in `fileStorage.ts`: `saveCvVersion(data, note)`, `listCvVersions()`, `getCvVersion(id)`, `deleteCvVersion(id)` — all user-scoped via `getCurrentUserId()`.

### Frontend (MasterCvScreen.tsx)
- State: `aiState: 'idle' | 'running' | 'result'`, `compressResult`, `versions`, modals.
- Progress overlay with step messages (rotating messages while the single analyze request is in flight).
- Result view: reuses `CvPdfPreview` for both columns (original from `formData`, compressed from `compressResult.compressedCv` — already TailoredCv-shaped so maps directly to `PdfCvShape`). Page counts for the badge derive from each preview's paginated output.
- Guidance strip rendered from `compressResult.guidance`.
- Confirmation modal → `POST /api/cv/ai/accept` → refresh master CV from response.
- Versions drawer → list/restore.

## Error Handling
- No API key → "Set your key in Settings" (reuse existing pattern).
- LLM failure in any phase → error message, original CV untouched, state back to idle.
- Verification drops found → warning banner (list dropped terms), user may still accept.
- No scraped jobs for role → banner "market data unavailable — using model knowledge".

## Testing
- `tsc --noEmit` clean; `vite build` passes.
- Manual browser test: AI Compress → progress → result → accept → versions → restore.
- API test: analyze (with and without market data), accept creates backup, restore returns prior CV.
- Verify compressed CV renders in `CvPdfPreview` page-wise without errors.

## Out of Scope (future)
- Async background processing with polling (if CVs get huge).
- Real web search integration (needs external key).
- User-editable guidance before applying (accept applies all-or-nothing for now).
