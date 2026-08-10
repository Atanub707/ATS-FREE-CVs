# Recruiters Channel — Apify Recruiter Enrichment (Design)

**Date:** 2026-08-10
**Status:** Approved
**Feature:** Feed the Recruiters channel with `recruiterName` / `recruiterUrl` from the Apify LinkedIn Jobs actor output, and surface recruiter LinkedIn profiles in the Recruiters screen and the Job Detail modal.

## 1. Background & goal

The app scrapes LinkedIn jobs via Apify's `valig/linkedin-jobs-scraper`. That actor already returns `recruiterName` and `recruiterUrl` (a LinkedIn profile link) for every job — but `mapItem` currently drops them. The Recruiters channel (extracts emails/phones from descriptions) gains real recruiter identity from this free metadata: names, profile links, and contact rows even when a description contains no email/phone.

## 2. Data model & pipeline

### Job type (`src/types.ts`)
Add two optional fields to the `Job` interface:
- `recruiterName?: string`
- `recruiterUrl?: string`

### Apify mapping (`server/scraper/apifyScraper.ts`)
In `mapItem`, map from the actor output:
- `recruiterName` → `recruiterName`
- `recruiterUrl` → `recruiterUrl`

### `hr_contacts` table
Two new nullable columns via the existing table-rebuild migration pattern (same approach as the `phone` column):
- `recruiter_name TEXT`
- `recruiter_url TEXT`

### Upsert rules (`upsertContactsFromJob` in `server/storage/fileStorage.ts`)
For each job that carries a recruiter:
1. **URL dedupe**: find an existing row by `recruiter_url` → bump `job_count`, refresh `last_seen`, fill any missing `name`/`recruiter_name`.
2. **Name merge**: if no URL match, match an existing row by name (case-insensitive equality between the stored name and `recruiterName`) → attach `recruiter_url` + `recruiter_name` to that row, bump count.
3. **Insert**: otherwise insert a profile-only contact: `email = NULL`, `phone = NULL`, `name = recruiterName`, `recruiter_name = recruiterName`, `recruiter_url` set, `type = 'recruit'`, `type_label = 'Recruiting'`, company/role/url from the job, `job_count = 1`.
4. **Name priority**: the actor's `recruiterName` wins over any description-inferred name on the same row.

**Backfill note:** `mapItem` dropped these fields historically, so existing jobs in the DB do NOT contain recruiter data. Backfill cannot recover it without re-scraping. Enrichment applies to jobs scraped from now on.

## 3. UI

### Recruiters screen (`src/components/RecruitersScreen.tsx`)
- Contact cards show a **LinkedIn icon button** when `recruiterUrl` exists → opens the profile in a new tab.
- Profile-only contacts (no email/phone) render: name, Recruiting tag, LinkedIn button, company · role, N-jobs badge, dismiss. The copy button copies the LinkedIn URL when no email/phone exists.
- Search matches `recruiterName` too.
- Copy-all remains email-only.

### Job Detail modal (`src/components/JobDetailModal.tsx`)
Under the contacts box, when the job has recruiter data: a row `Recruiter: <name> · LinkedIn ↗` (link opens in a new tab).

## 4. API

`GET /api/contacts` rows include `recruiterName` / `recruiterUrl` (mapped from the new columns). No new endpoints.

## 5. Edge cases

- Same recruiter across many jobs → one row, aggregated `job_count` (URL dedupe).
- Description email/phone contact whose name matches the recruiter → profile attached to the existing row, no duplicate.
- Jobs without recruiter data (free scrapers, Manual JD) → pipeline unchanged.
- Profile-only rows hide/dismiss like any contact.
- Migration is idempotent (rebuild only when `recruiter_url` column is missing).

## 6. Verification

1. Run a live Apify search → confirm new jobs in the DB carry `recruiterName`/`recruiterUrl`.
2. Recruiters screen shows LinkedIn entries (profile-only and merged).
3. Run the same search twice → recruiter rows aggregate instead of duplicating.
4. Job Detail modal shows the recruiter row on a job with recruiter data.
5. `npx tsc --noEmit`, `npx vite build`, Docker rebuild — no regressions on existing contact flows (email/phone extraction, hide, copy-all).

## 7. Out of scope

- Cost tracking / budget guards (separate brainstorm).
- `skipJobId` duplicate-avoidance (separate brainstorm).
- Recruiter photo fetch or profile enrichment.
