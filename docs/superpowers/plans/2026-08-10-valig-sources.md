# Valig Sources + Apify-Powered Source Registry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all 6 remaining Valig actors (Indeed, Naukri, Glassdoor, StepStone, Totaljobs, Upwork) as Apify-powered job sources, backed by a single shared source registry that Settings, ScraperBar, the scraper factory, and a new `GET /api/sources` endpoint all consume.

**Architecture:** A registry (`src/constants/sources.ts`) is the single source of truth for every source (19 total): display meta (flag/country/region) + scrape meta (apifyActorId, needsApify, builtInFallback, pricePer1K). The server side gets a shared `ApifyBaseScraper` base class (moved plumbing from `apifyScraper.ts`) with 6 thin per-actor subclasses; `ScraperFactory` routes Apify sources generically from the registry and skips Apify-only sources with an explanatory reason when no Apify key is set. UI: ScraperBar shows the 6 new chips (disabled + "requires Apify key" hint until a key is saved, then an "Apify" badge), Settings' Apify card lists all 7 Apify-powered sources with per-1K prices.

**Tech Stack:** TypeScript (tsx server + Vite React client), Express, better-sqlite3, Apify REST API (run-sync-get-dataset-items). No test framework — verification is `npx tsc --noEmit` + `npx vite build` + live `curl` checks against the running server (per AGENTS.md).

## Global Constraints

- Quality gate before any commit: `npx tsc --noEmit` (0 errors) → `npm audit --audit-level=high` (0 high) → `npx vite build` (success).
- **Never push** — commit locally only (AGENTS.md push policy). User pushes on request.
- No new `Job` fields. No new npm dependencies. No test framework — do not add one.
- `skipJobId` remains LinkedIn-only (Task 3/4 scrapers do not send it).
- robots.txt guard (`SOURCE_DOMAINS`) gains **no** entries for the 6 new sources (Apify does the crawling).
- Server-side imports use `.js` extensions; client imports are extensionless (existing convention).
- New job IDs use lowercase `source-` prefixes: `indeed-`, `naukri-`, `glassdoor-`, `stepstone-`, `totaljobs-`, `upwork-` (matches existing `linkedin-`).
- Actor prices (from Valig's profile page): LinkedIn $0.40 · Indeed $0.10 · Naukri $0.40 · Glassdoor $0.40 · StepStone $0.40 · Totaljobs $0.40 · Upwork $0.20 (all "/1K jobs").

---

### Task 1: Source registry + JobSource union

**Files:**
- Modify: `src/types.ts:2` (JobSource union)
- Create: `src/constants/sources.ts`
- Modify: `src/constants/sourceMeta.ts` (become a re-export shim)

**Interfaces:**
- Produces: `SOURCES: Record<JobSource, SourceMeta>`, `APIFY_SOURCES: SourceMeta[]`, `getSourceFlag(source: string): string`, `getSourceCountry(source: string): string`, `getSourceMeta(source: JobSource): SourceMeta | undefined` — consumed by Tasks 5, 6, 7, 8.

- [ ] **Step 1: Extend the JobSource union**

In `src/types.ts`, replace line 2:

```ts
export type JobSource = 'LinkedIn' | 'Indeed' | 'Naukri' | 'Glassdoor' | 'StepStone' | 'Totaljobs' | 'Upwork' | 'Arbeitnow' | 'SimplyHired' | 'Dice' | 'Reed' | 'RemoteOK' | 'WeWorkRemotely' | 'MyCareersFuture' | 'Cutshort' | 'Gupy' | 'JobsCh' | 'Daijob' | 'MyJobMag' | 'Custom';
```

- [ ] **Step 2: Create the registry**

Create `src/constants/sources.ts`:

```ts
import { JobSource } from '../types';

export interface SourceMeta {
  id: JobSource;
  label: string;
  flag: string;
  country: string;
  region: 'global' | 'us' | 'uk' | 'eu' | 'asia' | 'apac';
  apifyActorId?: string; // REST form (valig~name) — present ⇔ Apify-powered
  needsApify?: boolean; // true = works ONLY with an Apify API key
  builtInFallback?: boolean; // LinkedIn only: Apify → built-in free scraper
  pricePer1K?: string; // displayed in Settings
}

export const SOURCES: Record<JobSource, SourceMeta> = {
  // ── Apify-powered (Valig) ──
  LinkedIn: { id: 'LinkedIn', label: 'LinkedIn', flag: '🌐', country: 'Global', region: 'global', apifyActorId: 'valig~linkedin-jobs-scraper', builtInFallback: true, pricePer1K: '$0.40' },
  Indeed: { id: 'Indeed', label: 'Indeed', flag: '🇺🇸', country: 'Global', region: 'global', apifyActorId: 'valig~indeed-jobs-scraper', needsApify: true, pricePer1K: '$0.10' },
  Naukri: { id: 'Naukri', label: 'Naukri', flag: '🇮🇳', country: 'India', region: 'asia', apifyActorId: 'valig~naukri-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  Glassdoor: { id: 'Glassdoor', label: 'Glassdoor', flag: '🌐', country: 'Global', region: 'global', apifyActorId: 'valig~glassdoor-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  StepStone: { id: 'StepStone', label: 'StepStone', flag: '🇩🇪', country: 'Germany', region: 'eu', apifyActorId: 'valig~stepstone-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  Totaljobs: { id: 'Totaljobs', label: 'Totaljobs', flag: '🇬🇧', country: 'UK', region: 'uk', apifyActorId: 'valig~totaljobs-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  Upwork: { id: 'Upwork', label: 'Upwork', flag: '🌐', country: 'Global freelance', region: 'global', apifyActorId: 'valig~upwork-jobs-scraper', needsApify: true, pricePer1K: '$0.20' },

  // ── Built-in free scrapers ──
  Arbeitnow: { id: 'Arbeitnow', label: 'Arbeitnow', flag: '🌍', country: 'Europe', region: 'eu' },
  SimplyHired: { id: 'SimplyHired', label: 'SimplyHired', flag: '🇺🇸', country: 'USA', region: 'us' },
  Dice: { id: 'Dice', label: 'Dice', flag: '🇺🇸', country: 'USA', region: 'us' },
  Reed: { id: 'Reed', label: 'Reed', flag: '🇬🇧', country: 'UK', region: 'uk' },
  RemoteOK: { id: 'RemoteOK', label: 'RemoteOK', flag: '🌍', country: 'Global remote', region: 'global' },
  WeWorkRemotely: { id: 'WeWorkRemotely', label: 'WeWorkRemotely', flag: '🌍', country: 'Global remote', region: 'global' },
  MyCareersFuture: { id: 'MyCareersFuture', label: 'MyCareersFuture', flag: '🇸🇬', country: 'Singapore', region: 'asia' },
  Cutshort: { id: 'Cutshort', label: 'Cutshort', flag: '🇮🇳', country: 'India', region: 'asia' },
  Gupy: { id: 'Gupy', label: 'Gupy', flag: '🇧🇷', country: 'Brazil', region: 'apac' },
  JobsCh: { id: 'JobsCh', label: 'JobsCh', flag: '🇨🇭', country: 'Switzerland', region: 'eu' },
  Daijob: { id: 'Daijob', label: 'Daijob', flag: '🇯🇵', country: 'Japan', region: 'asia' },
  MyJobMag: { id: 'MyJobMag', label: 'MyJobMag', flag: '🇳🇬', country: 'Nigeria', region: 'apac' },
  Custom: { id: 'Custom', label: 'Custom', flag: '🌐', country: 'Custom', region: 'global' },
};

export const APIFY_SOURCES: SourceMeta[] = Object.values(SOURCES).filter((s) => s.apifyActorId);

export function getSourceFlag(source: string): string {
  return SOURCES[source as JobSource]?.flag || '🌐';
}

export function getSourceCountry(source: string): string {
  return SOURCES[source as JobSource]?.country || 'Global';
}

export function getSourceMeta(source: JobSource): SourceMeta | undefined {
  return SOURCES[source];
}
```

- [ ] **Step 3: Turn sourceMeta.ts into a re-export shim**

Replace the entire contents of `src/constants/sourceMeta.ts` with:

```ts
export { getSourceFlag, getSourceCountry, getSourceMeta, SOURCES as SOURCE_METADATA, type SourceMeta } from './sources';
```

(`ScraperBar` and any other existing consumer keep importing from `sourceMeta` unchanged.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/constants/sources.ts src/constants/sourceMeta.ts
git commit -m "feat: shared source registry — 19 sources, 7 Apify-powered (Valig)"
```

---

### Task 2: ApifyBaseScraper + LinkedIn refactor

**Files:**
- Create: `server/scraper/apifyBase.ts`
- Modify: `server/scraper/apifyScraper.ts` (extend the base; delete moved code)

**Interfaces:**
- Consumes: Task 1's `SOURCES`/`getSourceMeta` (not required here, but registry exists).
- Produces: `abstract class ApifyBaseScraper { abstract readonly source: JobSource; abstract readonly actorId: string; protected abstract buildInput(params: ScraperParams): Record<string, any>; protected abstract mapItem(item: any): Job | null; async scrape(params: ScraperParams): Promise<Job[]> }` + exported helpers `cleanDescription(raw: string | undefined): string`, `parseSalary(text: string | undefined): { text?: string; min?: number; max?: number }`, `parseApplicants(caption: string | undefined): { count?: number; caption?: string; lowCompetition?: boolean }`, `extractDescription(item: any): string`, `normalizeIsoDate(value: string | number | undefined): string` — consumed by Tasks 3 and 4.

- [ ] **Step 1: Create the base class**

Create `server/scraper/apifyBase.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';

const RUN_SYNC_URL = (token: string, actorId: string) =>
  `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

export function cleanDescription(raw: string | undefined): string {
  return (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseApplicants(caption: string | undefined): { count?: number; caption?: string; lowCompetition?: boolean } {
  if (!caption) return {};
  const clean = String(caption).trim();
  if (!clean || /^null$/i.test(clean)) return {};
  const firstMatch = clean.match(/be among the first\s+([\d,.]+)\s+applicants?/i);
  const overMatch = clean.match(/over\s+([\d,.]+)\s+applicants?/i);
  const numMatch = clean.match(/([\d,.]+)\s*applicants?/i);
  let count: number | undefined;
  if (firstMatch) count = parseInt(firstMatch[1].replace(/,/g, ''), 10);
  else if (overMatch) count = parseInt(overMatch[1].replace(/,/g, ''), 10);
  else if (numMatch) count = parseInt(numMatch[1].replace(/,/g, ''), 10);
  if (count !== undefined && isNaN(count)) count = undefined;
  if (count === undefined) return {};
  return {
    count,
    caption: clean.charAt(0).toUpperCase() + clean.slice(1),
    lowCompetition: !!firstMatch,
  };
}

export function parseSalary(text: string | undefined): { text?: string; min?: number; max?: number } {
  if (!text) return {};
  const nums = text.match(/([\d,.]+)/g) || [];
  const parsed = nums.map((n) => parseInt(n.replace(/,/g, ''), 10)).filter((n) => !isNaN(n));
  return {
    text,
    min: parsed.length > 0 ? Math.min(...parsed) : undefined,
    max: parsed.length > 1 ? Math.max(...parsed) : undefined,
  };
}

// Actors change their output schema without warning; check every plausible
// variant so schema drift degrades gracefully instead of silently producing
// empty descriptions. If NONE match, log the actual keys (10-second fix).
const DESCRIPTION_FIELDS = [
  'descriptionHtml', 'description', 'descriptionText', 'jobDescription',
  'fullDescription', 'jobDescriptionHtml', 'descriptionPlain',
];

export function extractDescription(item: any): string {
  for (const field of DESCRIPTION_FIELDS) {
    const val = item?.[field];
    if (typeof val === 'string' && val.trim().length > 0) return val;
  }
  const nested = item?.details?.description || item?.jobDetails?.description;
  if (typeof nested === 'string' && nested.trim().length > 0) return nested;
  return '';
}

// Normalize any posted-date shape (ISO string, YYYY-MM-DD, epoch ms, or a
// "N days ago" relative caption) into an ISO string, or '' when unknown.
// Never show future dates and never fake a posting time with scrape time.
export function normalizeIsoDate(value: string | number | undefined, relativeCaption?: string): string {
  let rawPosted: Date | null = null;
  if (typeof value === 'number' && !isNaN(value)) {
    rawPosted = value > 1e12 ? new Date(value) : new Date(value * 1000); // ms vs s epoch
  } else if (typeof value === 'string' && value.trim()) {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnly) {
      const rel = String(relativeCaption || '').match(/(\d+)\s*(min|hour|day)s?\s*ago/i);
      if (rel) {
        const n = parseInt(rel[1], 10);
        const unit = rel[2].toLowerCase();
        const ms = unit === 'min' ? n * 60000 : unit === 'hour' ? n * 3600000 : n * 86400000;
        rawPosted = new Date(Date.now() - ms);
      } else {
        rawPosted = new Date(`${dateOnly[1]}T12:00:00Z`);
      }
    } else {
      rawPosted = new Date(value);
    }
  }
  if (!rawPosted || isNaN(rawPosted.getTime())) return '';
  const iso = rawPosted.toISOString();
  return new Date(iso).getTime() > Date.now() + 2 * 60 * 60 * 1000 ? '' : iso;
}

export abstract class ApifyBaseScraper {
  abstract readonly source: JobSource;
  abstract readonly actorId: string;

  protected abstract buildInput(params: ScraperParams): Record<string, any>;
  protected abstract mapItem(item: any): Job | null;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const config = loadConfig();
    const token = config.apify.token?.trim();
    if (!token || config.apify.enabled !== true) return [];

    try {
      const input = this.buildInput(params);
      const response = await fetch(RUN_SYNC_URL(token, this.actorId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(240000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.warn(`[Apify] ${this.source} actor returned ${response.status}: ${body.slice(0, 200)}`);
        return [];
      }

      const items = await response.json();
      if (!Array.isArray(items) || items.length === 0) {
        console.log(`[Apify] ${this.source} actor returned no jobs`);
        return [];
      }

      let result = items
        .map((item) => this.mapItem(item))
        .filter((j): j is Job => j !== null);

      // Relevance: at least ONE significant keyword word must appear in the
      // title or company. Any term counts — requiring only the first term
      // wrongly drops Platform/SRE/Cloud Engineer roles that the board
      // matched. If nothing matches (odd query), keep everything.
      const terms = params.keywords.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      if (terms.length > 0) {
        const before = result.length;
        const relevant = result.filter((j) => {
          const hay = `${j.title} ${j.company}`.toLowerCase();
          return terms.some((t) => hay.includes(t));
        });
        if (relevant.length > 0) {
          console.log(`[Apify] ${before} ${this.source} fetched, ${before - relevant.length} irrelevant (no "${terms.join('" / "')}" in title/company)`);
          result = relevant;
        }
      }

      console.log(`[Apify] Got ${result.length} ${this.source} jobs via Apify`);
      return result;
    } catch (err: any) {
      // Isolated failure — callers fall back (LinkedIn) or report skipped.
      console.warn(`[Apify] ${this.source} failed: ${err?.message || err}`);
      return [];
    }
  }
}
```

- [ ] **Step 2: Refactor apifyScraper.ts onto the base**

Replace the entire contents of `server/scraper/apifyScraper.ts` with:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate, parseApplicants, parseSalary } from './apifyBase.js';
import { classifyFromText } from './workMode.js';

// LinkedIn source via Apify's cloud scraper (valig/linkedin-jobs-scraper).
// Used when the user enables it in Settings with an Apify API token.
// The factory falls back to the built-in free LinkedIn scraper when this
// returns nothing (builtInFallback in the source registry).

const DATE_PARAMS: Record<string, string> = {
  '24h': 'r86400',
  '7d': 'r604800',
  '30d': 'r2592000',
};

// LinkedIn's native f_WT codes: 1=On-site, 2=Remote, 3=Hybrid — applied by
// LinkedIn itself, the strongest work-type guarantee available.
const REMOTE_PARAMS: Record<string, string[]> = {
  remote: ['2'],
  hybrid: ['3'],
  onsite: ['1'],
};

export class ApifyLinkedInScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'LinkedIn';
  readonly actorId = 'valig~linkedin-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      title: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && DATE_PARAMS[params.datePostedFilter]) {
      input.datePosted = DATE_PARAMS[params.datePostedFilter];
    }
    if (params.jobType && params.jobType !== 'all' && REMOTE_PARAMS[params.jobType]) {
      input.remote = REMOTE_PARAMS[params.jobType];
    }
    if (params.experienceLevel) {
      input.experienceLevel = [params.experienceLevel];
    }
    if (params.contractType) {
      input.contractType = [params.contractType];
    }
    if (params.jobIds && params.jobIds.length > 0) {
      input.skipJobId = params.jobIds;
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || !id) return null;
    const now = new Date().toISOString();
    const applicants = parseApplicants(item.applicationsCount);
    const salary = parseSalary(item.salary);
    const rawDescription = extractDescription(item);
    if (!rawDescription) {
      console.warn(`[Apify] No description field matched for LinkedIn job "${title}" (id=${id}). Actual item keys: ${Object.keys(item || {}).join(', ')}`);
    }

    const finalPosted = normalizeIsoDate(item.postedDate, String(item.postedTimeAgo || ''));

    // valig's 'workType' is job function, not work mode. The work-type
    // guarantee comes from LinkedIn's native f_WT search filter; label from
    // description evidence only — never guess.
    const cleanedDescription = cleanDescription(rawDescription);
    const detectedMode = classifyFromText(cleanedDescription);
    const jobType = detectedMode ? `Full-time · ${detectedMode}` : 'Full-time';

    return {
      id: `linkedin-${id}`,
      title,
      company: item.companyName || 'Unknown Company',
      location: item.location || '',
      source: 'LinkedIn',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.linkedin.com/jobs/view/${id}`,
      postedDate: finalPosted,
      ...(finalPosted ? { postedDateParsed: finalPosted.slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      jobType,
      ...(applicants.count !== undefined ? { applicantCount: applicants.count } : {}),
      ...(applicants.caption ? { applicantCaption: applicants.caption } : {}),
      ...(applicants.lowCompetition ? { lowCompetition: true } : {}),
      ...(item.recruiterName ? { recruiterName: String(item.recruiterName) } : {}),
      ...(item.recruiterUrl ? { recruiterUrl: String(item.recruiterUrl) } : {}),
      ...(item.experienceLevel ? { experienceLevel: String(item.experienceLevel) } : {}),
      ...(item.contractType ? { contractType: String(item.contractType) } : {}),
      ...(item.companyUrl ? { companyUrl: String(item.companyUrl) } : {}),
      ...(item.applyType ? { applyType: String(item.applyType) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0. (Behavioral parity — the live check happens in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add server/scraper/apifyBase.ts server/scraper/apifyScraper.ts
git commit -m "refactor: shared ApifyBaseScraper — LinkedIn moves onto it, plumbing centralized"
```

---

### Task 3: Indeed, Naukri, Glassdoor scrapers

**Files:**
- Create: `server/scraper/indeedScraper.ts`
- Create: `server/scraper/naukriScraper.ts`
- Create: `server/scraper/glassdoorScraper.ts`

**Interfaces:**
- Consumes: Task 2's `ApifyBaseScraper` + helpers.
- Produces: `IndeedScraper`, `NaukriScraper`, `GlassdoorScraper` classes (each `source` + `actorId` + `buildInput` + `mapItem`), consumed by Task 5's factory.

- [ ] **Step 1: IndeedScraper**

Create `server/scraper/indeedScraper.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate, parseSalary } from './apifyBase.js';

// Indeed via valig/indeed-jobs-scraper (~$0.10 per 1K jobs, Apify-powered).
// Output shape (README): url, title, datePublished (ISO), location object,
// employer.name, baseSalary {min,max,unitOfWork,currencyCode},
// description {text, html}, jobTypes {code: label}.

const DATE_DAYS: Record<string, string> = { '24h': '1', '7d': '7', '30d': '14' };

export class IndeedScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Indeed';
  readonly actorId = 'valig~indeed-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      title: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && DATE_DAYS[params.datePostedFilter]) {
      input.datePosted = DATE_DAYS[params.datePostedFilter];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.key || item.refNum;
    if (!title || !id) return null;
    const now = new Date().toISOString();
    const salary = item.baseSalary
      ? {
          text: `${item.baseSalary.min}-${item.baseSalary.max} ${item.baseSalary.currencyCode || ''}/${String(item.baseSalary.unitOfWork || 'YEAR').toLowerCase()}`,
          min: typeof item.baseSalary.min === 'number' ? item.baseSalary.min : undefined,
          max: typeof item.baseSalary.max === 'number' ? item.baseSalary.max : undefined,
        }
      : parseSalary(undefined);

    const loc = item.location || {};
    const location = [loc.city, loc.admin1Code, loc.countryName].filter(Boolean).join(', ');

    const jobTypeValues = Object.values(item.jobTypes || {}) as string[];
    const jobType = jobTypeValues.length > 0 ? jobTypeValues.join(', ') : undefined;

    const rawDescription = extractDescription(item) || String(item.description?.text || '');
    const cleanedDescription = cleanDescription(rawDescription);

    return {
      id: `indeed-${id}`,
      title,
      company: item.employer?.name || 'Unknown Company',
      location,
      source: 'Indeed',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.indeed.com/viewjob?jk=${id}`,
      postedDate: normalizeIsoDate(item.datePublished),
      ...(item.datePublished ? { postedDateParsed: String(item.datePublished).slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(item.employer?.companyPageUrl ? { companyUrl: String(item.employer.companyPageUrl) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 2: NaukriScraper**

Create `server/scraper/naukriScraper.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate } from './apifyBase.js';

// Naukri (India) via valig/naukri-jobs-scraper (~$0.40 per 1K, Apify-powered).
// Output shape (README): id, title, url, company.name, salary {currency,
// minimum, maximum, label} (INR), experience.text, description.full (HTML),
// createdDate (epoch ms), locations [{label}], wfhType ('0'|'2'|'3'),
// employmentType, applyCount, viewCount.

const JOB_AGE: Record<string, string> = { '24h': '1', '7d': '7', '30d': '30' };
const WFH: Record<string, string[]> = { remote: ['2'], hybrid: ['3'], onsite: ['0'] };

export class NaukriScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Naukri';
  readonly actorId = 'valig~naukri-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.jobType && params.jobType !== 'all' && WFH[params.jobType]) {
      input.wfhType = WFH[params.jobType];
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && JOB_AGE[params.datePostedFilter]) {
      input.jobAge = JOB_AGE[params.datePostedFilter];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || !id) return null;
    const now = new Date().toISOString();
    const salary = item.salary && typeof item.salary.minimum === 'number' && typeof item.salary.maximum === 'number'
      ? { text: item.salary.label || `${item.salary.minimum}-${item.salary.maximum} INR`, min: item.salary.minimum, max: item.salary.maximum }
      : undefined;

    const location = Array.isArray(item.locations) ? item.locations.map((l: any) => l.label).filter(Boolean).join(', ') : '';

    const rawDescription = extractDescription(item) || String(item.description?.full || item.description?.short || '');
    const cleanedDescription = cleanDescription(rawDescription);
    const employmentType = String(item.employmentType || '');
    const wfhMap: Record<string, string> = { '0': 'On-site', '2': 'Remote', '3': 'Hybrid' };
    const jobType = [employmentType, wfhMap[String(item.wfhType)]].filter(Boolean).join(' · ') || undefined;

    return {
      id: `naukri-${id}`,
      title,
      company: item.company?.name || 'Unknown Company',
      location,
      source: 'Naukri',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.naukri.com/`,
      postedDate: normalizeIsoDate(item.createdDate),
      ...(typeof item.createdDate === 'number' ? { postedDateParsed: new Date(item.createdDate).toISOString().slice(0, 10) } : {}),
      ...(salary?.text ? { salaryText: salary.text } : {}),
      ...(salary?.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary?.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(typeof item.applyCount === 'number' ? { applicantCount: item.applyCount } : {}),
      ...(item.experience?.text ? { experienceLevel: String(item.experience.text) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 3: GlassdoorScraper**

Create `server/scraper/glassdoorScraper.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription } from './apifyBase.js';

// Glassdoor via valig/glassdoor-jobs-scraper (~$0.40 per 1K, Apify-powered).
// Output shape (README): id, title, url, ageInDays, rating (company),
// employer.name, location.name, pay {min,max,currency,period}, description (HTML).

const DAYS_OLD: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };

export class GlassdoorScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Glassdoor';
  readonly actorId = 'valig~glassdoor-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && DAYS_OLD[params.datePostedFilter]) {
      input.daysOld = DAYS_OLD[params.datePostedFilter];
    }
    if (params.jobType === 'remote') {
      input.remoteWorkType = true;
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || id === undefined) return null;
    const now = new Date().toISOString();
    const salary = item.pay && typeof item.pay.min === 'number' && typeof item.pay.max === 'number'
      ? { text: `${item.pay.min}-${item.pay.max} ${item.pay.currency || ''}/${String(item.pay.period || 'ANNUAL').toLowerCase()}`, min: item.pay.min, max: item.pay.max }
      : undefined;

    const rating = typeof item.rating === 'number' ? `Company rating: ${item.rating.toFixed(1)}` : '';
    const rawDescription = extractDescription(item);
    const cleanedDescription = cleanDescription(rawDescription);
    const description = [cleanedDescription, rating].filter(Boolean).join('\n\n') || 'Description not available';

    return {
      id: `glassdoor-${id}`,
      title,
      company: item.employer?.name || 'Unknown Company',
      location: typeof item.location?.name === 'string' ? item.location.name : '',
      source: 'Glassdoor',
      description,
      url: item.url || `https://www.glassdoor.com/job-listing/j?jl=${id}`,
      ...(typeof item.ageInDays === 'number'
        ? { postedDate: new Date(Date.now() - item.ageInDays * 86400000).toISOString() }
        : {}),
      ...(typeof item.ageInDays === 'number'
        ? { postedDateParsed: new Date(Date.now() - item.ageInDays * 86400000).toISOString().slice(0, 10) }
        : {}),
      ...(salary?.text ? { salaryText: salary.text } : {}),
      ...(salary?.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary?.max !== undefined ? { salaryMax: salary.max } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/scraper/indeedScraper.ts server/scraper/naukriScraper.ts server/scraper/glassdoorScraper.ts
git commit -m "feat: Indeed, Naukri, Glassdoor scrapers via Valig Apify actors"
```

---

### Task 4: StepStone, Totaljobs, Upwork scrapers

**Files:**
- Create: `server/scraper/stepStoneScraper.ts`
- Create: `server/scraper/totaljobsScraper.ts`
- Create: `server/scraper/upworkScraper.ts`

**Interfaces:**
- Consumes: Task 2's `ApifyBaseScraper` + helpers.
- Produces: `StepStoneScraper`, `TotaljobsScraper`, `UpworkScraper` classes, consumed by Task 5's factory.

- [ ] **Step 1: StepStoneScraper**

Create `server/scraper/stepStoneScraper.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, normalizeIsoDate } from './apifyBase.js';

// StepStone (Germany) via valig/stepstone-jobs-scraper (~$0.40 per 1K,
// Apify-powered). Output shape (README): id, title, url, datePosted (ISO+tz),
// workFromHome ('1' partial/'2' full), location.location (string),
// company.name, salary {min,max,period,currencyIso} (EUR), textSections
// [{name, content HTML}], textSnippet.

const AG: Record<string, string> = { '24h': 'age_1', '7d': 'age_7' };
const WFH: Record<string, string> = { remote: '2', hybrid: '1' };

export class StepStoneScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'StepStone';
  readonly actorId = 'valig~stepstone-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && AG[params.datePostedFilter]) {
      input.ag = AG[params.datePostedFilter];
    }
    if (params.jobType && params.jobType !== 'all' && WFH[params.jobType]) {
      input.wfh = WFH[params.jobType];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || id === undefined) return null;
    const now = new Date().toISOString();
    const salary = item.salary && typeof item.salary.min === 'number' && typeof item.salary.max === 'number'
      ? { text: `${item.salary.min}-${item.salary.max} ${item.salary.currencyIso || 'EUR'}/${String(item.salary.period || 'year')}`, min: item.salary.min, max: item.salary.max }
      : undefined;

    const sections = Array.isArray(item.textSections) ? item.textSections.map((s: any) => s?.content || '').filter(Boolean) : [];
    const rawDescription = [String(item.textSnippet || ''), ...sections].join('\n\n');
    const cleanedDescription = cleanDescription(rawDescription);
    const wfhMap: Record<string, string> = { '1': 'Hybrid', '2': 'Remote' };
    const jobType = wfhMap[String(item.workFromHome)] || undefined;

    return {
      id: `stepstone-${id}`,
      title,
      company: item.company?.name || 'Unknown Company',
      location: typeof item.location?.location === 'string' ? item.location.location : '',
      source: 'StepStone',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.stepstone.de/stellenangebote--${id}.html`,
      postedDate: normalizeIsoDate(item.datePosted),
      ...(item.datePosted ? { postedDateParsed: String(item.datePosted).slice(0, 10) } : {}),
      ...(salary?.text ? { salaryText: salary.text } : {}),
      ...(salary?.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary?.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(item.company?.url ? { companyUrl: String(item.company.url) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 2: TotaljobsScraper**

Create `server/scraper/totaljobsScraper.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate, parseSalary } from './apifyBase.js';

// Totaljobs (UK) via valig/totaljobs-jobs-scraper (~$0.40 per 1K,
// Apify-powered). Output shape (README): id, title, url, datePosted (ISO),
// location (string), company.name, workType ("Permanent"), salary (STRING
// like "£65000.00 - £70000 per annum"), description (HTML).

const POSTED_WITHIN: Record<string, string> = { '24h': '1', '7d': '7', '30d': '14' };

export class TotaljobsScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Totaljobs';
  readonly actorId = 'valig~totaljobs-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && POSTED_WITHIN[params.datePostedFilter]) {
      input.postedWithin = POSTED_WITHIN[params.datePostedFilter];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || id === undefined) return null;
    const now = new Date().toISOString();
    const salary = parseSalary(item.salary);
    const cleanedDescription = cleanDescription(extractDescription(item));

    return {
      id: `totaljobs-${id}`,
      title,
      company: item.company?.name || 'Unknown Company',
      location: typeof item.location === 'string' ? item.location : '',
      source: 'Totaljobs',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.totaljobs.com/job/${id}`,
      postedDate: normalizeIsoDate(item.datePosted),
      ...(item.datePosted ? { postedDateParsed: String(item.datePosted).slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(item.workType ? { jobType: String(item.workType) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 3: UpworkScraper**

Create `server/scraper/upworkScraper.ts`:

```ts
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, normalizeIsoDate } from './apifyBase.js';

// Upwork (freelance) via valig/upwork-jobs-scraper (~$0.20 per 1K,
// Apify-powered). Output shape (README): id, title, url, jobType
// ("FIXED"|"HOURLY"), hourlyBudgetMin/Max, fixedPriceAmount {amount},
// totalApplicants, skills [{prefLabel}], client {country, totalSpent},
// description (plain text), publishTime (ISO), createTime.

export class UpworkScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Upwork';
  readonly actorId = 'valig~upwork-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = [location]; // Upwork's location filter is client-country array
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || !id) return null;
    const now = new Date().toISOString();

    let salary: { text?: string; min?: number; max?: number } = {};
    if (String(item.jobType) === 'FIXED' && item.fixedPriceAmount?.amount != null) {
      const amount = parseFloat(String(item.fixedPriceAmount.amount));
      if (!isNaN(amount)) {
        salary = { text: `Fixed price: $${amount}`, min: amount, max: amount };
      }
    } else if (String(item.jobType) === 'HOURLY' && (item.hourlyBudgetMin != null || item.hourlyBudgetMax != null)) {
      const min = item.hourlyBudgetMin != null ? parseFloat(String(item.hourlyBudgetMin)) : NaN;
      const max = item.hourlyBudgetMax != null ? parseFloat(String(item.hourlyBudgetMax)) : NaN;
      salary = {
        text: `Hourly: $${isNaN(min) ? '?' : min}-$${isNaN(max) ? '?' : max}`,
        min: isNaN(min) ? undefined : min,
        max: isNaN(max) ? undefined : max,
      };
    }

    const jobType = String(item.jobType) === 'FIXED' ? 'Fixed-price' : String(item.jobType) === 'HOURLY' ? 'Hourly' : undefined;
    const location = item.client?.country ? `Remote · ${item.client.country}` : 'Remote';
    const contractorTier = typeof item.contractorTier === 'string'
      ? String(item.contractorTier).replace(/([a-z])([A-Z])/g, '$1 $2') // 'IntermediateLevel' → 'Intermediate Level'
      : undefined;

    return {
      id: `upwork-${id}`,
      title,
      company: 'Upwork Client',
      location,
      source: 'Upwork',
      description: cleanDescription(String(item.description || '')) || 'Description not available',
      url: item.url || `https://www.upwork.com/jobs/~${item.cipherText || ''}`,
      postedDate: normalizeIsoDate(item.publishTime || item.createTime),
      ...(item.publishTime || item.createTime ? { postedDateParsed: String(item.publishTime || item.createTime).slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(typeof item.totalApplicants === 'number' ? { applicantCount: item.totalApplicants } : {}),
      ...(contractorTier ? { experienceLevel: contractorTier } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/scraper/stepStoneScraper.ts server/scraper/totaljobsScraper.ts server/scraper/upworkScraper.ts
git commit -m "feat: StepStone, Totaljobs, Upwork scrapers via Valig Apify actors"
```

---

### Task 5: ScraperFactory registry wiring + Apify gating

**Files:**
- Modify: `server/scraper/scraperFactory.ts`

**Interfaces:**
- Consumes: Task 1 `SOURCES` registry, Tasks 2–4 scraper classes.
- Produces: unchanged `runScrape(params)` signature; `lastSkippedSources` now also reports `requires Apify API key — enable in Settings` — consumed by Task 7's UI message.

- [ ] **Step 1: Rewrite the factory**

Replace the contents of `server/scraper/scraperFactory.ts` with:

```ts
import { LinkedInScraper } from './linkedInScraper.js';
import { ApifyLinkedInScraper } from './apifyScraper.js';
import { IndeedScraper } from './indeedScraper.js';
import { NaukriScraper } from './naukriScraper.js';
import { GlassdoorScraper } from './glassdoorScraper.js';
import { StepStoneScraper } from './stepStoneScraper.js';
import { TotaljobsScraper } from './totaljobsScraper.js';
import { UpworkScraper } from './upworkScraper.js';
import { isCrawlingAllowed } from './robotsGuard.js';
import { ArbeitnowScraper } from './arbeitnowScraper.js';
import { SimplyHiredScraper } from './simplyHiredScraper.js';
import { DiceScraper } from './diceScraper.js';
import { ReedScraper } from './reedScraper.js';
import { RemoteOkScraper } from './remoteOkScraper.js';
import { WeWorkRemotelyScraper } from './weWorkRemotelyScraper.js';
import { MyCareersFutureScraper } from './myCareersFutureScraper.js';
import { CutshortScraper } from './cutshortScraper.js';
import { GupyScraper } from './gupyScraper.js';
import { JobsChScraper } from './jobsChScraper.js';
import { DaijobScraper } from './daijobScraper.js';
import { MyJobMagScraper } from './myJobMagScraper.js';
import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';
import { SOURCES } from '../../src/constants/sources.js';
import { contradictsWanted } from './workMode.js';
import { ApifyBaseScraper } from './apifyBase.js';

// Apify-powered sources — constructed from the shared registry (Task 1).
const APIFY_SCRAPERS: Partial<Record<JobSource, () => ApifyBaseScraper>> = {
  LinkedIn: () => new ApifyLinkedInScraper(),
  Indeed: () => new IndeedScraper(),
  Naukri: () => new NaukriScraper(),
  Glassdoor: () => new GlassdoorScraper(),
  StepStone: () => new StepStoneScraper(),
  Totaljobs: () => new TotaljobsScraper(),
  Upwork: () => new UpworkScraper(),
};

export class ScraperFactory {
  // Populated by the last runScrape: sources skipped (robots.txt or Apify gate).
  static lastSkippedSources: { source: string; reason: string }[] = [];
  static async runScrape(params: ScraperParams): Promise<Job[]> {
    const sources = params.sources || ['LinkedIn'];
    const allJobs: Job[] = [];
    ScraperFactory.lastSkippedSources = [];

    // Good-faith crawler check: resolve robots.txt once per domain (parallel,
    // cached 1h) and skip sources whose sites disallow crawling. Only applies
    // to sources we crawl directly — Apify-powered sources run on Apify's
    // infrastructure and are never in SOURCE_DOMAINS.
    const SOURCE_DOMAINS: Record<string, string> = {
      LinkedIn: 'www.linkedin.com',
      Arbeitnow: 'arbeitnow.com',
      SimplyHired: 'www.simplyhired.com',
      Dice: 'www.dice.com',
      Reed: 'www.reed.co.uk',
      RemoteOK: 'remoteok.com',
      WeWorkRemotely: 'weworkremotely.com',
      MyCareersFuture: 'www.mycareersfuture.gov.sg',
      Cutshort: 'cutshort.io',
      Gupy: 'portal.gupy.io',
      JobsCh: 'jobs.ch',
      Daijob: 'daijob.com',
      MyJobMag: 'myjobmag.com',
    };
    let robotsAllowed = new Map<string, boolean>();
    const respectRobotsTxt = loadConfig().scraper.respectRobotsTxt !== false;
    if (respectRobotsTxt) {
      const domains = [...new Set(sources.map((s) => SOURCE_DOMAINS[s]).filter(Boolean))];
      const robotsResults = await Promise.all(
        domains.map(async (d) => [d, await isCrawlingAllowed(d)] as const)
      );
      robotsAllowed = new Map<string, boolean>(robotsResults);
    }

    for (const source of sources) {
      const domain = SOURCE_DOMAINS[source];
      if (respectRobotsTxt && domain && robotsAllowed.get(domain) === false) {
        console.warn(`[ScraperFactory] ${source}: skipped — robots.txt disallows crawling (${domain}/robots.txt)`);
        ScraperFactory.lastSkippedSources.push({ source, reason: `robots.txt disallows automated access (${domain})` });
        continue;
      }

      try {
        let jobs: Job[] = [];
        const meta = SOURCES[source];

        if (meta?.apifyActorId) {
          // Apify path — generic for all 7 Apify-powered sources.
          const apifyConfig = loadConfig().apify;
          const apifyAvailable = apifyConfig.enabled && !!apifyConfig.token?.trim();
          if (meta.needsApify && !apifyAvailable) {
            ScraperFactory.lastSkippedSources.push({ source, reason: 'requires Apify API key — enable in Settings' });
            continue;
          }
          const make = APIFY_SCRAPERS[source];
          if (make) {
            jobs = await make().scrape(params);
          }
          // LinkedIn only: Apify → built-in free scraper fallback.
          if (meta.builtInFallback && jobs.length === 0) {
            jobs = await new LinkedInScraper().scrape(params);
          }
        } else if (source === 'Arbeitnow') {
          jobs = await new ArbeitnowScraper().scrape(params);
        } else if (source === 'SimplyHired') {
          jobs = await new SimplyHiredScraper().scrape(params);
        } else if (source === 'Dice') {
          jobs = await new DiceScraper().scrape(params);
        } else if (source === 'Reed') {
          jobs = await new ReedScraper().scrape(params);
        } else if (source === 'RemoteOK') {
          jobs = await new RemoteOkScraper().scrape(params);
        } else if (source === 'WeWorkRemotely') {
          jobs = await new WeWorkRemotelyScraper().scrape(params);
        } else if (source === 'MyCareersFuture') {
          jobs = await new MyCareersFutureScraper().scrape(params);
        } else if (source === 'Cutshort') {
          jobs = await new CutshortScraper().scrape(params);
        } else if (source === 'Gupy') {
          jobs = await new GupyScraper().scrape(params);
        } else if (source === 'JobsCh') {
          jobs = await new JobsChScraper().scrape(params);
        } else if (source === 'Daijob') {
          jobs = await new DaijobScraper().scrape(params);
        } else if (source === 'MyJobMag') {
          jobs = await new MyJobMagScraper().scrape(params);
        } else {
          console.warn(`[ScraperFactory] Unknown source: ${source}, skipping`);
          continue;
        }
        allJobs.push(...jobs);
        console.log(`[ScraperFactory] ${source}: ${jobs.length} jobs`);
      } catch (err: any) {
        // Isolate failures: one broken source must not abort the rest
        console.warn(`[ScraperFactory] ${source} failed: ${err?.message || err}`);
      }
    }

    // Work-mode guarantee across ALL sources: a remote request must never
    // ADD jobs explicitly labeled Hybrid/On-site (and vice versa).
    if (params.jobType && params.jobType !== 'all') {
      const wanted = params.jobType as 'remote' | 'hybrid' | 'onsite';
      const before = allJobs.length;
      const filtered = allJobs.filter((j) => !contradictsWanted(j.jobType, wanted));
      if (filtered.length !== before) {
        console.log(`[ScraperFactory] Work-mode guard: ${before - filtered.length} jobs dropped (contradict ${wanted} search)`);
      }
      return filtered;
    }

    return allJobs;
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/scraper/scraperFactory.ts
git commit -m "feat: registry-driven factory — 6 new Apify sources, key gate with skip reason"
```

---

### Task 6: GET /api/sources endpoint

**Files:**
- Modify: `server.ts` (add route near the other settings/config routes)

**Interfaces:**
- Consumes: Task 1 `SOURCES`.
- Produces: `GET /api/sources` → `{ sources: SourceMeta[] }` — verifiable via curl (Task 9).

- [ ] **Step 1: Add the import and route**

In `server.ts`, add the import with the other `./src` imports:

```ts
import { SOURCES } from './src/constants/sources.js';
```

Add this route next to the `/api/config` route (search for `app.get('/api/config'`):

```ts
  // Source registry — lets clients (and API consumers) see which sources
  // are Apify-powered and what each Apify source costs per 1K jobs.
  app.get('/api/sources', (_req, res) => {
    res.json({ sources: Object.values(SOURCES) });
  });
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`, then start/restart the server (`npm run dev` or `tsx server.ts`) and:

```bash
curl -s http://localhost:3000/api/sources | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('sources:',j.sources.length);console.log('apify-powered:',j.sources.filter(s=>s.apifyActorId).map(s=>s.id+' ('+s.pricePer1K+')').join(', '))})"
```

Expected: `sources: 19` and all 7 Apify sources listed with prices (LinkedIn, Indeed, Naukri, Glassdoor, StepStone, Totaljobs, Upwork).

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: GET /api/sources — registry endpoint (19 sources, 7 Apify-powered)"
```

---

### Task 7: ScraperBar — 6 new chips with Apify gate + badge

**Files:**
- Modify: `src/components/ScraperBar.tsx`
- Modify: `src/App.tsx:422` (pass the `apifyAvailable` prop)

**Interfaces:**
- Consumes: Task 1 `SOURCES`/`getSourceMeta`/`getSourceFlag`/`getSourceCountry` (via the `sourceMeta` shim), App.tsx `config` state.
- Produces: `ScraperBarProps.apifyAvailable?: boolean` — new optional prop.

- [ ] **Step 1: ScraperBar changes**

In `src/components/ScraperBar.tsx`:

1. Replace the import on line 12:

```ts
import { getSourceFlag, getSourceCountry, getSourceMeta } from '../constants/sourceMeta';
```

2. Replace `ALL_SOURCES` / `COMING_SOON` (lines 30–31):

```ts
const ALL_SOURCES: JobSource[] = ['LinkedIn', 'Arbeitnow', 'SimplyHired', 'Dice', 'Reed', 'MyCareersFuture', 'Cutshort', 'Gupy', 'JobsCh', 'Daijob', 'MyJobMag', 'RemoteOK', 'WeWorkRemotely', 'Indeed', 'Naukri', 'Glassdoor', 'StepStone', 'Totaljobs', 'Upwork'];
const COMING_SOON: JobSource[] = ['RemoteOK', 'WeWorkRemotely'];
```

3. Add the prop to the interface and component signature:

```ts
interface ScraperBarProps {
  // ...existing props...
  apifyAvailable?: boolean; // Apify enabled + token saved — lights up Apify-only sources
}
```

and

```ts
export const ScraperBar: React.FC<ScraperBarProps> = ({ onScrape, isLoading, apifyAvailable }) => {
```

4. Add a helper after `toggleSource`:

```ts
const isApifyGated = (source: JobSource) => !!getSourceMeta(source)?.needsApify && !apifyAvailable;

const toggleSource = (source: JobSource) => {
  if (COMING_SOON.includes(source) || isApifyGated(source)) return;
  setSelectedSources((prev) =>
    prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
  );
};
```

5. Replace `renderSourceChip` with:

```tsx
const renderSourceChip = (src: JobSource) => {
    const isComingSoon = COMING_SOON.includes(src);
    const isSelected = selectedSources.includes(src);
    const gated = isApifyGated(src);
    const meta = getSourceMeta(src);
    const disabled = isComingSoon || gated;
    const title = isComingSoon
      ? `${src} — Coming soon`
      : gated
      ? `${src} — requires Apify API key — enable in Settings`
      : `${src} — ${getSourceCountry(src)}${meta?.pricePer1K ? ` · ${meta.pricePer1K}/1K jobs` : ''}`;
    return (
      <button
        key={src}
        type="button"
        onClick={() => toggleSource(src)}
        disabled={disabled}
        title={title}
        className={`inline-flex items-center gap-[7px] pl-2 pr-3 py-[7px] rounded-lg text-[12px] font-medium border transition-colors whitespace-nowrap ${
          disabled
            ? 'opacity-45 cursor-not-allowed bg-white border-slate-200 text-slate-500'
            : isSelected
            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold cursor-pointer'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 cursor-pointer'
        }`}
      >
        <span className="text-[13px] leading-none">{getSourceFlag(src)}</span>
        <span>{src}</span>
        {meta?.apifyActorId && !gated && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1 py-[1px]">Apify</span>
        )}
        {isComingSoon && (
          <span className="text-[9px] font-bold uppercase text-slate-400">Soon</span>
        )}
      </button>
    );
  };
```

6. Replace the skipped-sources message (lines 85–88) so it shows each source's real reason:

```ts
    } else if (result?.skippedSources && result.skippedSources.length > 0) {
      const skippedNames = result.skippedSources.map((s) => `${s.source} (${s.reason})`).join(', ');
      setScrapeSuccessMsg(`Searched — skipped: ${skippedNames}.`);
    }
```

- [ ] **Step 2: App.tsx — pass the prop**

In `src/App.tsx`, change line 422:

```tsx
          <ScraperBar onScrape={handleScrape} isLoading={isScrapingLoading} apifyAvailable={!!config?.apify.enabled && !!config?.apify.token} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/ScraperBar.tsx src/App.tsx
git commit -m "feat: ScraperBar — 6 Valig sources, Apify-key gate with hint, Apify badge"
```

---

### Task 8: Settings — "Powered by your Apify API key" chips

**Files:**
- Modify: `src/components/SettingsModal.tsx` (Apify card, around lines 298–326)

**Interfaces:**
- Consumes: Task 1 `APIFY_SOURCES`.

- [ ] **Step 1: Add the import and chips**

In `src/components/SettingsModal.tsx`, add to the imports:

```ts
import { APIFY_SOURCES } from '../constants/sources';
```

Inside the Apify card, immediately after the API-token row block (after the closing `</div>` of the `{formData.apify.enabled && (...)}` token section, still inside `.set-card`), add:

```tsx
            {formData.apify.enabled && (
              <div style={{ padding: '4px 2px 2px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>
                  Powered by your Apify API key
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {APIFY_SOURCES.map((s) => (
                    <span key={s.id} title={`${s.label} — ${s.pricePer1K}/1K jobs`}
                      style={{ fontSize: 11, fontWeight: 600, color: '#6366F1', background: '#EEF0FF', border: '1px solid #E0E4FE', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                      {s.label} <span style={{ fontWeight: 400, color: '#94A3B8' }}>· {s.pricePer1K}/1K</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: Settings — Apify card lists all 7 Apify-powered sources with prices"
```

---

### Task 9: End-to-end verification + full gate

**Files:** none (verification only)

- [ ] **Step 1: Full quality gate**

Run, in order, from the repo root:

```bash
npx tsc --noEmit
npm audit --audit-level=high
npx vite build
```

Expected: tsc exit 0 · `found 0 vulnerabilities` · build success.

- [ ] **Step 2: Registry endpoint**

With the server running (restart if it was started before Task 6):

```bash
curl -s http://localhost:3000/api/sources | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.sources.length, 'sources;', j.sources.filter(s=>s.apifyActorId).length, 'Apify-powered')})"
```

Expected: `19 sources; 7 Apify-powered`.

- [ ] **Step 3: Live scrape — Indeed + Naukri**

Using the saved Apify token in `config.ini`, scrape two new sources (choose keywords that match the boards, e.g. `DevOps Engineer`; location `Bangalore` for Naukri). Replace `<admin-cookie>` with the current admin session cookie value (contents of `/tmp/admin-cookie.txt` if present, else the `ats_session` cookie from the logged-in browser tab):

```bash
curl -s -X POST http://localhost:3000/api/jobs/scrape -H "Content-Type: application/json" -H "Cookie: <admin-cookie>" -d '{"keywords":"DevOps Engineer","location":"Bangalore","sources":["Indeed","Naukri"],"datePostedFilter":"7d","jobType":"all","maxJobsPerSource":10}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('scraped:',j.scrapedTotal,'added:',j.addedCount,'skipped:',j.skippedDuplicates,'skippedSources:',JSON.stringify(j.skippedSources))})"
```

Expected: `addedCount > 0`, `skippedSources` empty. Then confirm rows exist:

```bash
curl -s -H "Cookie: <admin-cookie>" "http://localhost:3000/api/jobs?source=Indeed&limit=3" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);(j.jobs||j).slice(0,3).forEach(x=>console.log(x.source, '|', x.title, '|', x.company, '|', x.salaryText||''))})"
```

(Repeat for `source=Naukri`.) Expected: rows carry `source: Indeed`/`Naukri`, salary where the board provided it.

- [ ] **Step 4: Regression — LinkedIn Apify path unchanged**

Repeat a LinkedIn-only scrape (`"sources":["LinkedIn"]`) and confirm jobs still arrive with `linkedin-` ids and `skipJobId` still logs (`[Apify] N fetched`).

- [ ] **Step 5: Apify-gate UI + message**

With the UI open (http://localhost:3000): the 6 new chips are visible; with the token present they're enabled with an "Apify" badge; temporarily disabling Apify in Settings shows them disabled with the tooltip "requires Apify API key — enable in Settings", and a forced search reports them under skipped sources with that reason.

- [ ] **Step 6: Settings chips**

Open Settings → Apify (enabled): the "Powered by your Apify API key" chip row shows all 7 sources with prices (LinkedIn $0.40 · Indeed $0.10 · Naukri $0.40 · Glassdoor $0.40 · StepStone $0.40 · Totaljobs $0.40 · Upwork $0.20).

- [ ] **Step 7: Commit any stragglers + summary**

```bash
git status --short
```

If anything is uncommitted, commit it with a fitting message. Then report to the user:
- What shipped (7 Apify sources, registry, endpoint, UI gate + badges + Settings chips).
- Live verification results (added counts per source).
- Reminder: not pushed — the user decides when to push.
