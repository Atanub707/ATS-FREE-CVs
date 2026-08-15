# AI System — Interview v2 (Job-Description-Grounded) — Implementation Plan

> **Status:** Approved focus — Interview only. Personalize AI Assistant comes later (card shows "Coming soon").

**Goal:** Replace the generic chat with an AI System screen. Clicking AI Assistant → landing with two 50/50 choice cards → **Interview with AI** takes over the full screen: 3 intro questions (real interviewer style) → 7-question Q&A **grounded in the actual job descriptions scraped in the dashboard** → scored per answer → final scorecard. No generic job-search chat.

## Interview flow

1. **Landing** (AI System): Interview card (active) + Personalize card ("Coming soon").
2. **Intro — interviewer asks 3 things:**
   - Which role from your dashboard? (role chips with job counts from real DB + "or type a role")
   - Years of experience in this role
   - Pick a real posting from your list (optional — questions then target that JD)
3. **Q&A (7 questions):** each question is grounded in a real JD from the dashboard (title/company + description excerpt). "Question N of 7 · From this JD: …". Answer → scored 0–10 + one-line feedback → next.
4. **Scorecard:** overall ring, per-question rows, verdict. Done → landing · Take another → intro.

## Server (`server/interview.ts` — rewrite)

- `getRoleOptions(): { label, count }[]` — aggregate `getAllJobs()` by normalized title (strip senior/lead/principal/junior/\(...\) suffixes), top 10, user-scoped.
- `getJobsForRole(label): { id, title, company, description }[]` — matching jobs (≤5, those with descriptions), used as the question bank.
- `startInterview({ role, experienceYears, jobId? })` → session { id, role, exp, jobs, qIndex, qa[], cvContext } → returns first question.
- `askNextQuestion(session)` — prompt: senior interviewer + candidate CV + **the real JD excerpt** ("Your dashboard shows the X posting requires A, B, C. Ask question N of 7 based on this posting…"). Rotates through the session's JDs.
- `scoreAnswer(session, answer)` — SCORE: n / FEEDBACK: one line (existing format).
- `buildScorecard(session)` — per-question + overall + verdict (existing).

**Routes (`server.ts`):**
- `GET /api/interview/roles` → `{ roles }`
- `GET /api/interview/jobs?role=` → `{ jobs: [{id,title,company}] }`
- `POST /api/interview/start` `{ role, experienceYears?, jobId? }` → `{ sessionId, question, questionIndex, total }`
- `POST /api/interview/answer` `{ sessionId, answer }` → `{ done:false, score, feedback, question, questionIndex }` | `{ done:true, scorecard }`

## Client — `src/components/AiSystemScreen.tsx` (replaces ChatPanel.tsx)

- Views: `landing` | `interview` | `personalize(coming-soon)`
- Interview steps: `intro` → `qa` → `scorecard`; header w/ back button; orb (speaking while waiting); per-answer score pill; JD source chips on each question.
- Orb CSS copied from ChatPanel (orb states idle/listening/speaking; reduced-motion safe).

## Cleanup
- Delete `src/components/ChatPanel.tsx`; `App.tsx` renders AiSystemScreen; navbar "AI Assistant" label updated.
- `/api/chat` route + MCP tool loop stay server-side (unused by UI, tests keep passing).
- Rewrite `tests/recruiters/interview.test.ts` for the new engine (role aggregation, JD-grounded question, scoring, scorecard).
- Docs: `docs/recruiters.md` AI section → AI System; CHANGELOG entry.

## Gate
tsc · npm test · vite build · Docker rebuild · browser E2E: landing → intro → Q&A (real JD chips) → scorecard. Commit per milestone; push only on request.
