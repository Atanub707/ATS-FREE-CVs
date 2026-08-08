# Design: Manual JD Enhancement — skill selection, side-by-side diff, history

**Date:** 2026-08-08 · **Status:** Approved by user (mockup reviewed)

## Problem

Manual JD currently: paste → analyze (score + gaps) → tailor (full-auto) → bullet diff → PDF. The user wants control: select which skills to add, remove changes they don't like, see a full side-by-side comparison, and browse history.

## Design (per approved mockup — 3 screens)

### 1. Skill selection (post-analyze, pre-generate)
- After Analyze, show `gapAnalysis.missingSkills` as a **checkbox list**, each with a destination label (Skills section / Experience bullet — heuristic by skill type).
- Live **projected score** = matchScore + estimated boost per selected skill.
- "Generate Tailored CV with Selected Skills" sends `includeSkills: string[]` to `/api/analyze-jd/tailor`.
- Unselected skills are NEVER added.

### 2. Tailor engine constraint (server)
- `LlmCvTailor.tailorCv(job, masterCv, opts?: { includeSkills?: string[] })`.
- When `includeSkills` is provided, the prompt instructs: "INCORPORATE ONLY these missing keywords: [...] — do NOT add any missing keyword not in this list."
- `audit.skillsAdded` reflects only the selected skills.

### 3. Side-by-side comparison + per-point review (post-generate)
- Comparison view: Master CV | Tailored CV; added lines (green +), rewritten lines (amber), removed (red strikethrough), unchanged (gray) — built from `diff.bulletRewrites` + `diff.addedAfter` + both CVs.
- Each change gets **✓ Accept / ✕ Remove** buttons. Removed changes are tracked.
- "Regenerate after removals" → re-tailor with `includeSkills` minus removed skills → fresh diff.
- Buttons: Save to history, Download PDF.

### 4. History
- Existing `manual_analysis` table + restore/delete. UI enhanced: score chip, role/company/date, actions: **View diff** (re-open comparison), **Restore** (existing), **Tailor now** (analyzed-only rows), **Delete** (existing).

## Non-goals
- No master-CV editing in this screen.
- No PDF preview redesign.

## Files
- `server/builder/llmCvTailor.ts` — optional `includeSkills`
- `server.ts` — `/api/analyze-jd/tailor` accepts `includeSkills`
- `src/components/ManualJdScreen.tsx` — skill panel, comparison view, per-point review, regenerate, history UI
- `src/types.ts` — `includeSkills` in tailor request types if needed
