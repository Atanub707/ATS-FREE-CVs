# Design: LLM API-Key Gate (no silent fallbacks)

**Date:** 2026-08-07 · **Status:** Approved by user ("just go ahead")

## Problem

LLM-dependent actions (Tailor, Match/Score, AI CV Compress, Manual JD analysis) currently fail silently:

- `LlmMatcher.matchJob` catches ANY LLM error and silently returns a heuristic score (`llmMatcher.ts:100-101`).
- Tailor failures are only `console.error`'d; the user never sees why.
- No pre-flight check tells the user an API token is missing/expired.

## Requirement (user words)

1. If no API token is configured → automated alert, operation **blocked**, no process runs.
2. If the token is expired/invalid (provider 401/403) → alert "your API key is expired", **blocked**, no fallback result.
3. Scraping, downloads, portals, CV editing keep working without a key — only LLM actions are gated.

## Design

### Server — `server/llm/apiKeyGuard.ts` (new)

- `hasApiKeyConfigured(): boolean` — true if `config.llm.apiKey` or env fallback (`GEMINI_API_KEY`) is set (reuses `resolveApiKey` from `llmAdapter`).
- `mapLlmError(err): { code, status, message }`:
  - error carries `code === 'NO_API_KEY'` → `{ code: 'no_api_key', status: 428, message: 'No API token configured — add your API key in Settings. This process will not run.' }`
  - provider message contains HTTP status 401/403 (regex on `...error 401:` / `Anthropic API error 403`) → `{ code: 'invalid_key', status: 401, message: 'Your API key appears to be expired or invalid — update it in Settings.' }`
  - anything else → `{ code: 'llm_error', status: 502, message: 'LLM service error: <original message>' }`

### Server — `server/llm/llmAdapter.ts`

- Attach `code = 'NO_API_KEY'` to the thrown error when no key is configured.

### Server — `server/matcher/llmMatcher.ts`

- REMOVE the silent `fallbackHeuristicMatch` call; rethrow the LLM error so it reaches the route's structured error handling.

### Server — routes (`server.ts`)

Gate these endpoints (pre-flight no-key check → 428; catch → `mapLlmError` response):

- `POST /api/jobs/:id/match`
- `POST /api/jobs/batch-match`
- `POST /api/jobs/:id/tailor`
- `POST /api/jobs/batch-tailor`
- `POST /api/cv/ai/analyze`
- `POST /api/analyze-jd`
- `POST /api/analyze-jd/tailor`

All error responses: `{ error: string, code: 'no_api_key' | 'invalid_key' | 'llm_error' }`.

### Frontend — `src/lib/llmError.ts` (new)

- `llmErrorMessage(code, raw): string` — maps codes to the alert texts above (raw message appended for `llm_error`).

### Frontend — `src/App.tsx`

- `handleMatchJob` / `handleTailorJob`: on non-OK response → `alert(llmErrorMessage(...))`.
- `handleBatchMatch` / `handleBatchTailor`: on non-OK response → single `alert(llmErrorMessage(...))` (e.g. no-key blocks the whole batch); OK path unchanged.

### Frontend — `src/components/MasterCvScreen.tsx` + `ManualJdScreen.tsx`

- AI Compress analyze + Manual JD analyze/tailor fetches: on non-OK response → `alert(llmErrorMessage(...))`, abort the flow (no progress state).

## Non-goals

- No key masking in Settings (out of scope).
- No heuristic fallback removal for genuine transient outages — those now alert too (`llm_error`), never a fake result.

## Verification

1. Temporarily clear `config.ini` apiKey → `POST /api/jobs/:id/tailor` returns 428 `no_api_key`; UI shows alert.
2. Restore key → tailor succeeds (200).
3. Invalid-key simulation (set bogus key) → 401 `invalid_key` alert.
4. Scrape endpoint still works with no key.
