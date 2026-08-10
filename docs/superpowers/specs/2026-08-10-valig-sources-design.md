# Valig Sources + Apify-Powered Source Registry (Design)

**Date:** 2026-08-10 · **Status:** Approved (scope: all 6 Valig actors + source registry)

## 1. Goal

Bring all of Vali G's remaining job-scraper actors into the platform as first-class, Apify-powered sources — and make it *visible* to the user which sources their Apify API key powers, both in Settings and in the search UI.

- Add 6 new sources: **Indeed, Naukri, Glassdoor, StepStone (DE), Totaljobs (UK), Upwork** — all via Valig's actors (`valig/indeed-jobs-scraper` $0.10/1K, `valig/naukri-jobs-scraper` $0.40/1K, `valig/glassdoor-jobs-scraper` $0.40/1K, `valig/stepstone-jobs-scraper` $0.40/1K, `valig/totaljobs-jobs-scraper` $0.40/1K, `valig/upwork-jobs-scraper` $0.20/1K).
- Introduce a **single source registry** (`src/constants/sources.ts`) that both server and client consume, so "which sources use Apify" is defined in exactly one place.
- Add **`GET /api/sources`** so the endpoint itself reports the registry (Apify-powered sources + their per-1K price).
- Settings → Apify card shows the Apify-powered source chips; ScraperBar shows the 6 new sources (disabled with a "requires Apify key" hint until a valid key is saved).

## 2. Source registry (single source of truth)

New `src/constants/sources.ts`:

```ts
interface SourceMeta {
  id: JobSource;
  label: string;              // 'Indeed'
  apifyActorId?: string;      // 'valig~indeed-jobs-scraper' (REST form) — present ⇔ Apify-powered
  needsApify?: boolean;       // true for the 6 new sources (no built-in fallback)
  builtInFallback?: boolean;  // LinkedIn only (Apify → built-in free scraper)
  pricePer1K?: string;        // '$0.10' — display in Settings
}
export const SOURCES: Record<JobSource, SourceMeta>;
export const APIFY_SOURCES: SourceMeta[]; // the 7 Apify-powered sources
```

- `JobSource` union in `src/types.ts` grows: `'Indeed' | 'Naukri' | 'Glassdoor' | 'StepStone' | 'Totaljobs' | 'Upwork'`.
- `ScraperBar.ALL_SOURCES`, `ScraperFactory.SOURCE_DOMAINS`/routing, Settings chips, and `GET /api/sources` all derive from the registry. `SOURCE_DOMAINS` gains no entries for the 6 new sources (robots.txt guard does not apply — Apify runs the crawl, we never touch those domains).

## 3. Server: generic Apify path

- **`server/scraper/apifyBase.ts`**: shared base class with the current `apifyScraper.ts` plumbing — token/config guard (`config.apify.enabled && token`), `run-sync-get-dataset-items` POST with 240s timeout, `cleanDescription`, `parseSalary`, `parseApplicants` (promoted from `apifyScraper.ts`), and a generic `scrape(params)` that builds a source-specific input via an overridable `buildInput(params)` hook.
- **6 thin classes** (`indeedScraper.ts`, `naukriScraper.ts`, `glassdoorScraper.ts`, `stepStoneScraper.ts`, `totaljobsScraper.ts`, `upworkScraper.ts`) in `server/scraper/`: each sets its `actorId` + implements `mapItem` for its actor's real output schema (verified from each actor's README example) and any input quirks:
  - Indeed: `title/location/datePosted` + company, salary, applicationsCount — map to the existing `Job` shape; URL uses the actor's job url.
  - Naukri: salary packages (lakhs), experience, company insights — salary parsed through `parseSalary`.
  - Glassdoor: role/location/date/rating filters; the rating is appended to the description text ("Company rating: X.X") — no new Job fields.
  - StepStone / Totaljobs: LinkedIn-like output (structured jobs + company data) — near-identical mapper.
  - Upwork: budget + skills + client data — budget string mapped through `parseSalary` into salaryMin/Max so the existing salary display works.
  - If an actor output schema drifts, `mapItem` logs keys (same loud-warning pattern as `DESCRIPTION_FIELDS` in `apifyScraper.ts`).
- **`scraperFactory.ts`**: replace the LinkedIn-only Apify special case with a generic branch — if the source's registry entry has `apifyActorId`, build that scraper; `needsApify` sources with Apify disabled/missing token are skipped and pushed to `lastSkippedSources` with reason `requires Apify API key — enable in Settings`. LinkedIn keeps `builtInFallback` behavior.
- **`GET /api/sources`** (server.ts): returns `{ sources: SourceMeta[] }` from the registry — no auth needed for metadata, but returned for the Settings screen to render chips.

## 4. UI

- **Settings → Apify card**: "Powered by your Apify API key" — chips for all 7 Apify sources (`APIFY_SOURCES`), each labeled with `pricePer1K` (e.g. "Indeed · $0.10/1K"). Read-only. Rendered by importing the shared registry directly (client and server share the same file — no network dependency); `GET /api/sources` exists as the API mirror for external/curl consumers.
- **ScraperBar dropdown**: append the 6 new sources to the source list, each tagged "Apify". If `!apifyEnabled || !token`: the 6 render disabled with a "requires Apify key" hint (tooltip/subtext); LinkedIn stays as-is. If key present: all enabled.
- Job cards / detail: source badge colors derive from the registry; new sources use the existing amber fallback (no new colors needed).

## 5. Error handling

- New source without Apify → skipped, listed under the existing skipped-sources notice with reason.
- Actor run failure → isolated per source (factory try/catch already guarantees no cascade); logged with `[Apify]` prefix.
- Empty result set → `[]` returned, no fake jobs.
- `skipJobId` remains LinkedIn-only (actor-specific); other sources rely on `saveNewJobs` URL/id dedupe.

## 6. Out of scope

- Built-in (non-Apify) scrapers for the new boards.
- New `Job` fields (no schema change beyond the 6 source labels).
- Profile/company enrichment, email APIs, other Apify developers' actors.
- Changing robots.txt handling for existing sources.

## 7. Verification

1. `npx tsc --noEmit`, `npx vite build`, `npm audit --audit-level=high` — all pass.
2. No Apify key: all 6 new sources disabled in ScraperBar; a forced multi-source search reports them in the skipped-sources notice.
3. With Apify key: live search on Indeed + Naukri stores real jobs (DB rows with correct `source`), Glassdoor/StepStone/Totaljobs/Upwork return valid jobs or a clean empty set.
4. `GET /api/sources` returns all 7 Apify sources with `apifyActorId` + `pricePer1K`.
5. Settings Apify card renders the 7 chips with prices.
6. Existing LinkedIn Apify path unchanged (regression: repeat search still dedupes via skipJobId).
7. Docker boots with "server running".
