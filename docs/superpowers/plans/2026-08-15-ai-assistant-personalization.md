# AI Assistant Personalization — Scrape, Skill Gaps, CV, Interviews, Voice (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the AI Assistant a personalized job copilot: (0) living 3D orb character with speech states, (1) assistant-triggered scraping that stores jobs, (2) aggregate skill-gap analysis from all scored jobs, (3) CV generation + PDF using existing templates only, (4) mock interview mode, (5) voice I/O via Voicebox with browser fallback.

**Architecture:** All new capability = new MCP tools in `server/mcp/registry.ts` + UI states in `ChatPanel.tsx`. Voice via Voicebox REST/MCP on localhost:17493 with graceful fallback to browser speechSynthesis/speechRecognition.

## Global Constraints
- Gate: `npx tsc --noEmit`, `npm test`, `npx vite build`; 0 high vulns
- Same BYOK key; no auto-apply; existing 4 CV templates only (harvard/jake/atanu/atanu-pro)
- Tools stay user-scoped; commits per phase; never push unless asked

---

### Phase 0: Living 3D orb character (UI)

**Files:** `src/components/ChatPanel.tsx`

- Replace the robot with a **3D orb** (pure CSS): layered radial gradients, glossy highlight, inner glow
- States:
  - `idle` — gentle float (translateY)
  - `listening` (user recording) — pulsing ring + slight scale
  - `speaking` (AI replying/thinking) — **wobble animation** (oscillating rotate/scaleX, ~1.1s cycle) so it feels like it's talking
- Orb appears in the hero AND as the small assistant avatar next to messages
- Commit: `feat(chat): living 3D orb with listening/speaking states`

### Phase 1: `scrape_jobs` tool (assistant-triggered scraping, stored)

**Files:** `server/mcp/registry.ts`, `server.ts`

- New tool `scrape_jobs({ role, location, sources?, maxPerSource? })` → runs the existing scraper pipeline server-side (reuse the same functions `handleScrape` uses — extract a server-side `runScrape(params)` helper if needed), results go through the **existing dedupe/save path** (same DB, user-scoped)
- Returns `{ added, duplicates, jobs: [{id,title,company,url}] }` so the assistant can then call `search_jobs` on the fresh data
- System prompt: when the user asks to "scrape/search for jobs", call `scrape_jobs` first, then `search_jobs`
- Test: `tests/recruiters/mcp.test.ts` — scrape tool saves rows (mocked scraper result)
- Commit: `feat(chat): scrape_jobs tool — assistant can trigger scrapes and results are stored`

### Phase 2: Aggregate skill-gap analysis

**Files:** `server/mcp/registry.ts`, `ChatPanel.tsx`

- New tool `analyze_skill_gaps({ limit? })` → scans ALL jobs with `gapAnalysis`, counts `missingKeywords` frequency, returns top N (default 15): `{ gaps: [{keyword, count, ofTotal, pct}], suggestion }`
- Assistant answers "what should I add to my CV?" with real aggregate data
- **Apply to Master CV**: new tool `apply_gaps_to_cv({ keywords: string[] })` — adds keywords to the Master CV skills (preview → confirm in chat: returns diff, user confirms, then persists via existing `saveMasterCv`)
- Test: seed 2 jobs with overlapping missing keywords, assert counts
- Commit: `feat(chat): aggregate skill-gap analysis + apply-to-CV tool`

### Phase 3: CV generation + PDF (existing templates only)

**Files:** `server/mcp/registry.ts`, `server.ts`, `ChatPanel.tsx`

- New tool `generate_cv({ changes?, template? })` → builds a working copy of the Master CV (+ optional changes), renders PDF via the **existing** `generatePdfBuffer(masterCvToTailoredCv(cv), template)` with template restricted to the 4 existing ids
- Chat returns a **"Download PDF"** card (server returns the PDF bytes as base64; UI builds a blob) — no new templates ever
- Commit: `feat(chat): generate CV + download PDF (existing templates only)`

### Phase 4: Mock interview mode

**Files:** `server/llm/tools.ts` (interview prompts), `ChatPanel.tsx` (mode toggle), `server.ts` (`/api/interview/start`, `/api/interview/answer`)

- Chat mode toggle: **Chat | Interview**
- `/api/interview/start` — role + CV → assistant begins one question at a time
- `/api/interview/answer` — user's answer → next question or final scorecard (per-question notes + overall, personalized from CV)
- Interview state held client-side (conversation context in the chat); prompts instruct: one question per turn, interviewer persona, final JSON scorecard `{"__score":{...}}`
- Commit: `feat(chat): mock interview mode with scorecard`

### Phase 5: Voice I/O (Voicebox + fallback)

**Files:** `ChatPanel.tsx`, `server.ts` (`/api/voice/health`), `docs/recruiters.md`

- **Detection:** `GET /api/voice/health` → tries `http://127.0.0.1:17493/profiles` (short timeout) → `{ available, profiles: [{id,name}] }`
- **Input:** mic button → MediaRecorder captures audio → `POST /api/voice/transcribe` (proxies to Voicebox `/transcribe`) → text into the chat input; fallback: Web Speech API `webkitSpeechRecognition` when Voicebox absent
- **Output:** on assistant reply → `POST /api/voice/speak` (proxies to Voicebox `/speak` with chosen profile) → plays audio; orb goes into **speaking** wobble while playing; fallback: `speechSynthesis`
- **Settings:** voice profile dropdown in Settings → new **Assistant** card (or in-chat gear); stored in config
- Docs: Voicebox setup guide (install, first run, port 17493)
- Commit: `feat(chat): voice I/O via Voicebox with browser fallback`

---

## Self-Review Checklist
- [ ] Orb states: idle/listening/speaking, reduced-motion safe
- [ ] Scraped jobs stored via existing dedupe path (no duplicates)
- [ ] Skill gaps computed from real stored analyses; CV updates only with user confirm
- [ ] PDF templates restricted to the 4 existing ids
- [ ] Interview = one question per turn + scorecard
- [ ] Voice: graceful fallback when Voicebox not installed; no cloud dependency
- [ ] Gates green after each phase; no push without request
