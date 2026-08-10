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
