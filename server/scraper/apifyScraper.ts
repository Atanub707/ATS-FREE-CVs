import { Job, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';
import { LinkedInScraper } from './linkedInScraper.js';

// Optional LinkedIn source via Apify's cloud scraper
// (apimaestro/linkedin-jobs-scraper-api — returns a reliable per-job
// work_type: Remote / Hybrid / On-site, which valig's actor did not).
// Used when the user enables it in Settings with an Apify API token.
// Falls back to the built-in free LinkedIn scraper on any failure.

const ACTOR_ID = 'apimaestro~linkedin-jobs-scraper-api'; // REST API uses ~ (not /)
const RUN_SYNC_URL = (token: string) =>
  `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

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
  if (count === undefined) return {}; // no parseable applicant info
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
  const title = item.job_title || item.title;
  const id = item.job_id || item.id;
  if (!title || !id) return null;
  const now = new Date().toISOString();
  const applicants = parseApplicants(item.applicant_count !== undefined ? String(item.applicant_count) : item.applicationsCount);
  const salary = parseSalary(item.salary);
  // posted_at_epoch is MILLISECONDS from this actor (13 digits); fall back
  // to posted_at ("YYYY-MM-DD HH:MM:SS") parsed as UTC.
  const epoch = Number(item.posted_at_epoch);
  let rawPosted: Date | null = null;
  if (!isNaN(epoch) && epoch > 0) {
    rawPosted = new Date(epoch > 1e12 ? epoch : epoch * 1000);
  } else if (item.posted_at) {
    rawPosted = new Date(String(item.posted_at).replace(' ', 'T') + 'Z');
  }
  const postedDate = rawPosted && !isNaN(rawPosted.getTime()) ? rawPosted.toISOString() : now;
  // The actor's posted_at strings are timezone-ambiguous and can land in
  // the FUTURE when parsed as UTC. Never show future dates — clamp to the
  // scrape time (2h tolerance for genuinely live postings).
  const finalPosted = new Date(postedDate).getTime() > Date.now() + 2 * 60 * 60 * 1000 ? now : postedDate;

  // Work mode: the actor's per-job work_type field is the authoritative
  // signal; job_insights often carries it too. Description evidence only
  // as a last resort — never guessed from the search filter.
  const insightsText = (item.job_insights || []).join(' ').toLowerCase();
  const explicitWork = String(item.work_type || '').toLowerCase();
  const combined = `${explicitWork} ${insightsText}`;
  let jobType = 'Full-time';
  let workModeVerified = false; // label came from the actor's structured data
  if (combined.includes('hybrid')) { jobType = 'Full-time · Hybrid'; workModeVerified = true; }
  else if (combined.includes('remote')) { jobType = 'Full-time · Remote'; workModeVerified = true; }
  else if (combined.includes('onsite') || combined.includes('on-site')) { jobType = 'Full-time · On-site'; workModeVerified = true; }
  else {
    const d = cleanDescription(item.description).toLowerCase();
    if (/\bhybrid\b|hybrid (work|role|model)/.test(d) && !/no hybrid|not hybrid|non-hybrid/.test(d)) jobType = 'Full-time · Hybrid';
    else if (/on-?site|onsite|in office|in-?office|office-?based|from office|in-person|at our office|at the office/.test(d) && !/no on-?site|not on-?site/.test(d)) jobType = 'Full-time · On-site';
    else if (/\bremote\b|100% (remote|tele|virtual)|wfh|work from home|remote-first|fully remote|work from anywhere|anywhere|telecommute/.test(d)) jobType = 'Full-time · Remote';
  }

  return {
    id: `linkedin-${id}`,
    title,
    company: item.company || item.companyName || 'Unknown Company',
    location: item.location || '',
    source: 'LinkedIn',
    description: cleanDescription(item.description) || 'Description not available',
    url: item.job_url || item.url || `https://www.linkedin.com/jobs/view/${id}`,
    postedDate: finalPosted,
    postedDateParsed: finalPosted.slice(0, 10),
    salaryText: salary.text || 'Salary not mentioned',
    ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
    ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
    jobType,
    ...(applicants.count !== undefined ? { applicantCount: applicants.count } : {}),
    ...(applicants.caption ? { applicantCaption: applicants.caption } : {}),
    ...(applicants.lowCompetition ? { lowCompetition: true } : {}),
    ...(workModeVerified ? { workModeVerified: true } : {}),
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
        keyword: params.keywords.trim(),
        limit: Math.min(params.maxJobsPerSource || 25, 1000),
      };
      const location = params.location?.trim() || '';
      if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
        input.location = location;
      }
      // Ask the actor itself for the requested work type (it returns
      // per-job work_type labels; its own filter is loose, so the
      // post-filter below is the exact guarantee).
      if (params.jobType && params.jobType !== 'all') {
        input.work_type = params.jobType === 'onsite' ? 'On-site' : params.jobType.charAt(0).toUpperCase() + params.jobType.slice(1);
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

      // Relevance: the FIRST significant keyword word must appear in the
      // title or company ("devops" must not return "Recruiter" or
      // "Co-Founder" just because the description mentions it).
      const terms = params.keywords.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      const primaryTerm = terms[0];
      if (primaryTerm) {
        const before = jobs.length;
        const relevant = jobs.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(primaryTerm));
        if (relevant.length > 0) {
          console.log(`[Apify] ${before} fetched, ${jobs.length - relevant.length} irrelevant (missing "${primaryTerm}" in title/company)`);
          return relevant;
        }
      }

      // Same work-mode guarantee as the built-in scraper: a remote request
      // must never return jobs explicitly labeled Hybrid/On-site (the
      // actor's work_type makes these labels reliable). Unknowns pass.
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
