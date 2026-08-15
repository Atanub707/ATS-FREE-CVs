import { getAllJobs, getMasterCv, getCandidateProfile } from '../storage/fileStorage.js';

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
};
