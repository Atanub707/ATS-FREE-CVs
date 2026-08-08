import { Job, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';
import { LinkedInScraper } from './linkedInScraper.js';

// Optional LinkedIn source via Apify's cloud scraper (valig/linkedin-jobs-scraper,
// ~$0.28–0.40 per 1K jobs, covered by the free $5/month credit).
// Used when the user enables it in Settings and provides an Apify API token.
// Falls back to the built-in free LinkedIn scraper on any failure.

const ACTOR_ID = 'valig~linkedin-jobs-scraper'; // REST API uses ~ (not /) between username and actor name
const RUN_SYNC_URL = (token: string) =>
  `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

const DATE_PARAMS: Record<string, string> = {
  '24h': 'r86400',
  '7d': 'r604800',
  '30d': 'r2592000',
};

const REMOTE_PARAMS: Record<string, string[]> = {
  remote: ['2'],
  hybrid: ['3'],
  onsite: ['1'],
};

const LEVEL_PARAMS: Record<string, string[]> = {
  entry: ['2'],
  mid: ['3'],
  senior: ['4'],
  lead: ['5'],
};

function cleanDescription(item: any): string {
  const raw = item.descriptionHtml || item.description || '';
  return raw
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
  const clean = caption.trim();
  const firstMatch = clean.match(/be among the first\s+([\d,.]+)\s+applicants?/i);
  const overMatch = clean.match(/over\s+([\d,.]+)\s+applicants?/i);
  const numMatch = clean.match(/([\d,.]+)\s*applicants?/i);
  let count: number | undefined;
  if (firstMatch) count = parseInt(firstMatch[1].replace(/,/g, ''), 10);
  else if (overMatch) count = parseInt(overMatch[1].replace(/,/g, ''), 10);
  else if (numMatch) count = parseInt(numMatch[1].replace(/,/g, ''), 10);
  if (count !== undefined && isNaN(count)) count = undefined;
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

function mapItem(item: any): Job | null {
  if (!item?.title || !item?.id) return null;
  const now = new Date().toISOString();
  const applicants = parseApplicants(item.applicationsCount);
  const salary = parseSalary(item.salary);
  const postedDate = item.postedDate ? `${item.postedDate}T00:00:00.000Z` : now;

  // Work mode: prefer an explicit field if the actor provides one, else the
  // description evidence (same honesty rules as the built-in scraper —
  // never guess from the search filter).
  const explicitWork = String(item.workplaceType || item.remoteType || '').toLowerCase();
  let jobType = 'Full-time';
  if (explicitWork.includes('hybrid')) jobType = 'Full-time · Hybrid';
  else if (explicitWork.includes('remote')) jobType = 'Full-time · Remote';
  else if (explicitWork.includes('onsite') || explicitWork.includes('on-site')) jobType = 'Full-time · On-site';
  else {
    const d = cleanDescription(item).toLowerCase();
    if (/\bhybrid\b|hybrid (work|role|model)/.test(d) && !/no hybrid|not hybrid|non-hybrid/.test(d)) jobType = 'Full-time · Hybrid';
    else if (/on-?site|onsite|in office|in-?office|office-?based|from office|in-person|at our office|at the office/.test(d) && !/no on-?site|not on-?site/.test(d)) jobType = 'Full-time · On-site';
    else if (/\bremote\b|100% (remote|tele|virtual)|wfh|work from home|remote-first|fully remote|work from anywhere|anywhere|telecommute/.test(d)) jobType = 'Full-time · Remote';
  }

  return {
    id: `linkedin-${item.id}`,
    title: item.title,
    company: item.companyName || 'Unknown Company',
    location: item.location || '',
    source: 'LinkedIn',
    description: cleanDescription(item) || 'Description not available',
    url: item.url || `https://www.linkedin.com/jobs/view/${item.id}`,
    postedDate,
    postedDateParsed: item.postedDate || postedDate.slice(0, 10),
    salaryText: salary.text || 'Salary not mentioned',
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
        input.remote = REMOTE_PARAMS[params.jobType];
      }
      if (params.experienceLevel && params.experienceLevel !== 'all' && LEVEL_PARAMS[params.experienceLevel]) {
        input.experienceLevel = LEVEL_PARAMS[params.experienceLevel];
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

      const jobs = items
        .map(mapItem)
        .filter((j): j is Job => j !== null);

      // Same work-mode guarantee as the built-in scraper: a remote request
      // must never return jobs explicitly labeled Hybrid/On-site (Apify's
      // workplaceType makes these labels reliable). Unknowns pass — the
      // source search filter is the guarantee.
      if (params.jobType && params.jobType !== 'all') {
        const wanted = params.jobType;
        const filtered = jobs.filter((j) => {
          const t = j.jobType || '';
          if (wanted === 'remote') return !t.includes('Hybrid') && !t.includes('On-site');
          if (wanted === 'onsite') return !t.includes('Remote') && !t.includes('Hybrid');
          if (wanted === 'hybrid') return !t.includes('Remote') && !t.includes('On-site');
          return true;
        });
        console.log(`[Apify] ${jobs.length} fetched, kept ${filtered.length} for ${wanted} search`);
        return filtered;
      }

      console.log(`[Apify] Got ${jobs.length} LinkedIn jobs via Apify`);
      return jobs;
    } catch (err: any) {
      // Fall back to the built-in free scraper so the search still works.
      console.warn(`[Apify] Failed, falling back to built-in LinkedIn scraper: ${err?.message || err}`);
      return new LinkedInScraper().scrape(params);
    }
  }
}
