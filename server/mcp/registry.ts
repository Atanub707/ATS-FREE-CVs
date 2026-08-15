import { getAllJobs, getMasterCv, getCandidateProfile, saveNewJobs } from '../storage/fileStorage.js';
import { ScraperFactory } from '../scraper/scraperFactory.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export const CHAT_TOOLS: ToolDef[] = [
  {
    name: 'search_jobs',
    description:
      "Search the user's scraped jobs. Filters: role (title/company substring), location, source (e.g. LinkedIn, Indeed, or all), workMode (remote/onsite/hybrid/all), limit (1-25, default 10).",
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string' },
        location: { type: 'string' },
        source: { type: 'string' },
        workMode: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_job',
    description: 'Get full details of one job by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'score_job',
    description: 'Get the AI match score details for a job (score, matched skills, missing skills, recommendations).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'get_cv_summary',
    description: "Get the candidate's CV summary + job preferences (skills, years of experience, locations, notice period).",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'scrape_jobs',
    description:
      "Scrape NEW jobs from the user's configured sources and store them in their job list (they appear on the dashboard). Use when the user asks to scrape/find/search for new jobs. Filters: role/keywords (required), location, sources (optional array e.g. ['LinkedIn'] or ['Indeed','Naukri']), maxJobsPerSource (default 15), under10Applicants (true/false).",
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string' },
        location: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        maxJobsPerSource: { type: 'number' },
        under10Applicants: { type: 'boolean' },
      },
      required: ['role'],
    },
  },
];

function normalizeWorkMode(job: any, wanted?: string): boolean {
  if (!wanted || wanted === 'all') return true;
  const loc = (job.location || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  if (wanted === 'remote') return loc.includes('remote') || desc.includes('remote');
  if (wanted === 'hybrid') return loc.includes('hybrid') || desc.includes('hybrid');
  if (wanted === 'onsite') return !loc.includes('remote') && !desc.includes('remote');
  return true;
}

export const TOOL_EXECUTORS: Record<string, (args: any) => Promise<any>> = {
  async search_jobs(args) {
    const q = String(args?.role || '').toLowerCase().trim();
    const loc = String(args?.location || '').toLowerCase().trim();
    const src = String(args?.source || '').trim();
    const limit = Math.min(25, Math.max(1, Number(args?.limit) || 10));
    const jobs = getAllJobs().filter((j: any) => {
      if (src && src !== 'all' && (j.source || '') !== src) return false;
      if (q && !((j.title || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q))) return false;
      if (loc && !(j.location || '').toLowerCase().includes(loc)) return false;
      return normalizeWorkMode(j, args?.workMode);
    });
    return {
      jobs: jobs.slice(0, limit).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        source: j.source,
        url: j.url,
        postedDate: j.postedDate,
        applicantCount: j.applicantCount,
      })),
    };
  },
  async get_job(args) {
    const j = getAllJobs().find((x: any) => x.id === args?.id);
    if (!j) return { error: 'Job not found.' };
    return {
      job: {
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        source: j.source,
        url: j.url,
        description: (j.description || '').slice(0, 1500),
        postedDate: j.postedDate,
      },
    };
  },
  async score_job(args) {
    const j = getAllJobs().find((x: any) => x.id === args?.id);
    if (!j) return { error: 'Job not found.' };
    const g = j.gapAnalysis;
    return {
      score: g?.matchScore ?? null,
      matched: g?.matchingSkills || g?.matchedKeywords || [],
      missing: g?.missingSkills || g?.missingKeywords || [],
      recommendations: g?.keyRecommendations || [],
    };
  },
  async get_cv_summary() {
    const cv = getMasterCv();
    const profile = getCandidateProfile();
    return {
      fullName: cv.fullName,
      summary: (cv.summary || '').slice(0, 600),
      skills: (cv.skills || []).flatMap((s: any) => s.items || []).slice(0, 40),
      yearsExperience: profile.yearsExperience,
      locations: profile.preferredLocations,
      noticePeriod: profile.noticePeriod,
    };
  },
  async scrape_jobs(args) {
    const role = String(args?.role || '').trim();
    if (!role) return { error: 'A role/keywords parameter is required to scrape.' };

    // skipJobId: tell the Apify actor to skip LinkedIn jobs we already have
    // (avoids re-fetching and re-paying for duplicates).
    let jobIds: string[] = [];
    try {
      const existing = getAllJobs().filter((j: any) => j.source === 'LinkedIn' && j.id.startsWith('linkedin-'));
      jobIds = existing
        .map((j: any) => j.id.replace(/^linkedin-/, ''))
        .filter((id: string) => /^\d+$/.test(id))
        .slice(0, 1000);
    } catch { jobIds = []; }

    const wantUnder10 = args?.under10Applicants === true;

    const scrapedJobsRaw = await ScraperFactory.runScrape({
      keywords: role,
      location: String(args?.location || 'Remote'),
      sources: Array.isArray(args?.sources) ? args.sources : undefined,
      datePostedFilter: 'all',
      jobType: 'all',
      maxJobsPerSource: args?.maxJobsPerSource ? Number(args.maxJobsPerSource) : 15,
      under10Applicants: wantUnder10,
      jobIds,
    } as any);

    const scrapedJobs = wantUnder10
      ? scrapedJobsRaw.filter((j: any) => j.lowCompetition === true || (j.applicantCount !== undefined && j.applicantCount <= 10))
      : scrapedJobsRaw;

    const { added } = saveNewJobs(scrapedJobs);

    return {
      addedCount: added.length,
      scrapedTotal: scrapedJobs.length,
      skippedDuplicates: scrapedJobsRaw.length - scrapedJobs.length,
      jobs: added.slice(0, 20).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        source: j.source,
        url: j.url,
      })),
    };
  },
};
