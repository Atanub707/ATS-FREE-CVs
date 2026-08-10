# Apify Job Fields + Filters + skipJobId (Design)

**Date:** 2026-08-10 · **Status:** Approved (scope: full package)

## 1. Goal

Use the Apify actor's structured output and input capabilities we currently ignore:
- Capture 4 new structured fields per job: `experienceLevel`, `contractType`, `companyUrl`, `applyType`
- Send real filter codes to the actor (contract type + experience level) instead of dropping them
- Pass `skipJobId` so repeat searches don't re-fetch (and re-charge) jobs already in the user's DB

## 2. Data model

`Job` type gains 4 optional fields (src/types.ts): `experienceLevel?: string`, `contractType?: string`, `companyUrl?: string`, `applyType?: string`.

`mapItem` (server/scraper/apifyScraper.ts) maps them from the actor output with truthy guards, same pattern as recruiterName/recruiterUrl.

## 3. Filters (sent to the actor)

- **contractType**: new select in ScraperBar (All / Full-time / Part-time / Contract / Temporary / Internship). Values sent to the actor as the LinkedIn codes `F` / `P` / `C` / `T` / `I` (`O`=Other omitted; All = omitted).
- **experienceLevel**: the existing ScraperBar select currently sends UI values (`entry`/`mid`/`senior`/`lead`) that the actor ignores. Replace its options with the actor's exact six levels and send the LinkedIn codes `1`–`6`:
  - `1` Internship · `2` Entry · `3` Associate · `4` Mid-Senior · `5` Director · `6` Executive
- Both flow: ScraperBar → ScraperParams (`contractType?`, `experienceLevel?: string` meaning the code) → server route → `apifyScraper` input. Only the Apify path uses them; other scrapers ignore them (kept out of their logic).

## 4. skipJobId (cost saver)

- In the scrape route (server.ts), before running sources, gather the current user's existing LinkedIn job IDs from the DB (`source='LinkedIn'`), strip the `linkedin-` prefix to get the actor's numeric IDs, cap at 1000, and pass as `ScraperParams.jobIds?: string[]`.
- `apifyScraper` sends them as `input.skipJobId` (actor field: array of job IDs to exclude).
- Effect: repeat searches fetch only genuinely new jobs → fewer charged results.

## 5. UI display

- **Job cards** (JobMatrix): small badges when the job has the data — `[Full-time]` (contractType), `[Mid-Senior]` (experienceLevel), `[⚡ Easy Apply]` when applyType === 'EASY_APPLY'.
- **Job Detail modal**: same badges + an "Open company ↗" link when `companyUrl` exists.

## 6. Out of scope

- Profile-scraper enrichment, email enrichment APIs, company-page scraping, other boards.
- Changing the privacy sanitizer.

## 7. Verification

1. Live Apify search → stored jobs carry the new fields (check via DB).
2. Repeat the same search → fewer results fetched (skipJobId log line `[Apify] ... fetched`), no duplicate rows.
3. Selecting Contract type / Experience level sends the codes (verify via a 1-job live search + DB/lookup).
4. UI badges render on cards + detail modal; company link opens.
5. `npx tsc --noEmit`, `npx vite build`, Docker boots with "server running"; existing filters (remote/date/limit) unaffected.
