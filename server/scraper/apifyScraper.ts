import { Job, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';
import { LinkedInScraper } from './linkedInScraper.js';
import { classifyFromText, contradictsWanted } from './workMode.js';

// Optional LinkedIn source via Apify's cloud scraper
// (valig/linkedin-jobs-scraper — ~$0.28–0.40 per 1K jobs, free $5/month
// credit covers ~12K jobs; most complete output + LinkedIn's NATIVE
// work-type filter (f_WT) applied server-side).
// Used when the user enables it in Settings with an Apify API token.
// Falls back to the built-in free LinkedIn scraper on any failure.

const ACTOR_ID = 'valig~linkedin-jobs-scraper'; // REST API uses ~ (not /)
const RUN_SYNC_URL = (token: string) =>
  `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

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

function cleanDescription(raw: string | undefined): string {
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

function parseApplicants(caption: string | undefined): { count?: number; caption?: string; lowCompetition?: boolean } {
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

function parseSalary(text: string | undefined): { text?: string; min?: number; max?: number } {
  if (!text) return {};
  const nums = text.match(/([\d,.]+)/g) || [];
  const parsed = nums.map((n) => parseInt(n.replace(/,/g, ''), 10)).filter((n) => !isNaN(n));
  return {
    text,
    min: parsed.length > 0 ? Math.min(...parsed) : undefined,
    max: parsed.length > 1 ? Math.max(...parsed) : undefined,
  };
}

// The valig actor's documented fields are `descriptionHtml`/`description`,
// but Apify actors change their output schema without warning (a version
// bump can silently rename a field), and different LinkedIn actors on the
// marketplace don't agree on naming. Rather than trusting exactly two
// field names, check every plausible variant so a schema drift degrades
// gracefully instead of silently producing empty descriptions for every
// job. If NONE of these are present, that's a real signal worth logging.
const DESCRIPTION_FIELDS = [
  'descriptionHtml',
  'description',
  'descriptionText',
  'jobDescription',
  'fullDescription',
  'jobDescriptionHtml',
  'descriptionPlain',
];

function extractDescription(item: any): string {
  for (const field of DESCRIPTION_FIELDS) {
    const val = item?.[field];
    if (typeof val === 'string' && val.trim().length > 0) return val;
  }
  // Nested shapes seen on some marketplace actors, e.g. { details: { description } }
  const nested = item?.details?.description || item?.jobDetails?.description;
  if (typeof nested === 'string' && nested.trim().length > 0) return nested;
  return '';
}

function mapItem(item: any): Job | null {
  const title = item.title;
  const id = item.id;
  if (!title || !id) return null;
  const now = new Date().toISOString();
  const applicants = parseApplicants(item.applicationsCount);
  const salary = parseSalary(item.salary);
  const rawDescription = extractDescription(item);
  if (!rawDescription) {
    // Surface this loudly instead of quietly falling back — if this ever
    // fires, the actor's output schema has changed and DESCRIPTION_FIELDS
    // above needs a new entry. Log the actual keys so it's a 10-second fix.
    console.warn(`[Apify] No description field matched for job "${title}" (id=${id}). Actual item keys: ${Object.keys(item || {}).join(', ')}`);
  }

  // valig's postedDate is ISO or YYYY-MM-DD; postedTimeAgo is relative and
  // often has hour precision ("23 hours ago") — prefer it when the date is
  // date-only, else use noon (least-biased point) for date-only values.
  let rawPosted: Date | null = null;
  const rawDate = item.postedDate ? String(item.postedDate) : '';
  const dateOnly = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) {
    const rel = String(item.postedTimeAgo || '').match(/(\d+)\s*(min|hour|day)s?\s*ago/i);
    if (rel) {
      const n = parseInt(rel[1], 10);
      const unit = rel[2].toLowerCase();
      const ms = unit === 'min' ? n * 60000 : unit === 'hour' ? n * 3600000 : n * 86400000;
      rawPosted = new Date(Date.now() - ms);
    } else {
      rawPosted = new Date(`${dateOnly[1]}T12:00:00Z`);
    }
  } else if (rawDate) {
    rawPosted = new Date(rawDate);
  }
  const postedDate = rawPosted && !isNaN(rawPosted.getTime()) ? rawPosted.toISOString() : '';
  // Never show future dates (timezone-ambiguous sources) and NEVER fake a
  // posting time with the scrape time — empty means unknown, hidden in UI.
  const finalPosted = postedDate && new Date(postedDate).getTime() > Date.now() + 2 * 60 * 60 * 1000 ? '' : postedDate;

  // valig has NO per-job work-type output field (its 'workType' is job
  // function). The work-type guarantee comes from LinkedIn's native f_WT
  // search filter; label from description evidence only — never guess.
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
    state: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export class ApifyLinkedInScraper {
  readonly source = 'LinkedIn' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const config = loadConfig();
    const token = config.apify.token?.trim();
    if (!token || config.apify.enabled !== true) {
      return [];
    }

    try {
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
        // LinkedIn's NATIVE work-type filter — applied by LinkedIn itself.
        input.remote = REMOTE_PARAMS[params.jobType];
      }

      const response = await fetch(RUN_SYNC_URL(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(240000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.warn(`[Apify] Actor returned ${response.status}: ${body.slice(0, 200)}`);
        throw new Error(`Apify actor error ${response.status}`);
      }

      const items = await response.json();
      if (!Array.isArray(items) || items.length === 0) {
        console.log('[Apify] Actor returned no jobs');
        return [];
      }

      let result = items
        .map(mapItem)
        .filter((j): j is Job => j !== null);

      // Relevance: the FIRST significant keyword word must appear in the
      // title or company ("devops" must not return "Recruiter").
      const terms = params.keywords.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      const primaryTerm = terms[0];
      if (primaryTerm) {
        const before = result.length;
        const relevant = result.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(primaryTerm));
        if (relevant.length > 0) {
          console.log(`[Apify] ${before} fetched, ${before - relevant.length} irrelevant (missing "${primaryTerm}" in title/company)`);
          result = relevant;
        }
      }

      // Work-mode contradiction filter: a remote request must never return
      // jobs whose description explicitly says Hybrid/On-site. Unknowns pass
      // (LinkedIn's own f_WT filter already guaranteed the type).
      if (params.jobType && params.jobType !== 'all') {
        const wanted = params.jobType as 'remote' | 'hybrid' | 'onsite';
        const filtered = result.filter((j) => !contradictsWanted(j.jobType, wanted));
        console.log(`[Apify] ${result.length} relevant, kept ${filtered.length} for ${wanted} search`);
        result = filtered;
      }

      console.log(`[Apify] Got ${result.length} LinkedIn jobs via Apify`);
      return result;
    } catch (err: any) {
      // Fall back to the built-in free scraper so the search still works.
      console.warn(`[Apify] Failed, falling back to built-in LinkedIn scraper: ${err?.message || err}`);
      return new LinkedInScraper().scrape(params);
    }
  }
}
