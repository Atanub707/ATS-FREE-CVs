import { getAllJobs, getMasterCv, getCandidateProfile, saveNewJobs, saveMasterCv } from '../storage/fileStorage.js';
import { ScraperFactory } from '../scraper/scraperFactory.js';
import { generatePdfBuffer } from '../builder/docxGenerator.js';

const CV_TEMPLATES = ['harvard', 'jake', 'atanu', 'atanu-pro'];

const CV_PDF_TTL = 10 * 60 * 1000;
const cvPdfStore = new Map<string, { buf: Buffer; expiry: number }>();

export function getCvPdf(token: string): Buffer | null {
  const e = cvPdfStore.get(token);
  if (!e) return null;
  if (Date.now() > e.expiry) {
    cvPdfStore.delete(token);
    return null;
  }
  return e.buf;
}

function masterCvToTailoredCvShape(m: any): any {
  return {
    candidateName: m.fullName,
    contactInfo: {
      email: m.email,
      phone: m.phone,
      location: m.location,
      linkedin: m.linkedin,
      github: m.github,
      website: m.website,
    },
    targetRole: m.experiences?.[0]?.title || '',
    professionalSummary: m.summary,
    coreCompetencies: (m.skills || []).flatMap((s: any) => s.items || []),
    workExperience: (m.experiences || []).map((e: any) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      dates: e.dates,
      highlights: e.responsibilities,
    })),
    education: (m.education || []).map((e: any) => ({
      degree: e.degree,
      institution: e.institution,
      dates: e.dates,
      details: e.details || '',
    })),
    technicalSkills: (m.skills || []).map((s: any) => ({
      category: s.category,
      skills: s.items,
    })),
    projects: m.projects || [],
    certifications: (m.certifications || []).map((c: any) =>
      typeof c === 'string' ? c : `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`
    ),
  };
}

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
      "Scrape NEW jobs from the user's configured sources and store them in their job list (they appear on the dashboard). Use when the user asks to scrape/find/search for new jobs. Filters: role/keywords (required), location (optional), sources (optional array e.g. ['LinkedIn'] or ['Indeed','Naukri']), maxJobsPerSource (default 15), under10Applicants (true/false).",
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
  {
    name: 'analyze_skill_gaps',
    description:
      "Analyze the most common missing keywords across the user's scored jobs. Use when the user asks what to add to their CV, what skills are missing, or how to improve their profile. Returns the top gaps with how many jobs mention each.",
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'apply_gaps_to_cv',
    description:
      "Add the given keywords to the user's Master CV skills (as a new 'Market Skills' category). Use ONLY after the user explicitly confirms they want the listed gaps added to their CV. Returns the new skills list.",
    inputSchema: {
      type: 'object',
      properties: { keywords: { type: 'array', items: { type: 'string' } } },
      required: ['keywords'],
    },
  },
  {
    name: 'generate_cv',
    description:
      "Generate a downloadable PDF of the user's CV (using their current template — the existing 4 templates only). Optional changes: summary (new professional summary text) and skillsAdd (list of keywords to add). Returns a token the UI turns into a Download PDF button. Use when the user asks to create/download/export their CV.",
    inputSchema: {
      type: 'object',
      properties: {
        changes: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            skillsAdd: { type: 'array', items: { type: 'string' } },
          },
        },
      },
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
  async analyze_skill_gaps(args) {
    const limit = Math.min(25, Math.max(1, Number(args?.limit) || 15));
    const scored = getAllJobs().filter((j: any) => j.gapAnalysis && Array.isArray(j.gapAnalysis.missingKeywords) && j.gapAnalysis.missingKeywords.length > 0);
    const counts = new Map<string, number>();
    for (const j of scored) {
      const uniq = new Set((j.gapAnalysis.missingKeywords as string[]).map((k: string) => k.toLowerCase().trim()).filter(Boolean));
      uniq.forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
    }
    const total = scored.length;
    const gaps = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count, ofTotal: total, pct: total ? Math.round((count / total) * 100) : 0 }));
    return { totalScored: total, gaps, note: total ? `Based on ${total} scored jobs.` : 'No scored jobs yet — ask the user to score some jobs first.' };
  },
  async apply_gaps_to_cv(args) {
    const keywords = (Array.isArray(args?.keywords) ? args.keywords : [])
      .map((k: any) => String(k).trim())
      .filter(Boolean)
      .filter((k: string) => k.length <= 60);
    if (!keywords.length) return { error: 'No valid keywords provided.' };
    const cv = getMasterCv() as any;
    const skills: { category: string; items: string[] }[] = (cv.skills || []).map((s: any) => ({ ...s, items: [...(s.items || [])] }));
    const existing = new Set(skills.flatMap((s) => s.items.map((i: string) => i.toLowerCase().trim())));
    const added = keywords.filter((k: string) => !existing.has(k.toLowerCase().trim()));
    if (!added.length) return { error: 'All of those keywords are already in your CV.' };
    const market = skills.find((s) => s.category?.toLowerCase().includes('market'));
    if (market) market.items = [...market.items, ...added];
    else skills.push({ category: 'Market Skills', items: added });
    const newCv = { ...cv, skills };
    saveMasterCv(newCv as any);
    return { added, skills: skills.flatMap((s) => s.items) };
  },
  async generate_cv(args) {
    const cv = getMasterCv() as any;
    const template = (CV_TEMPLATES.includes(cv.templateId || '') ? cv.templateId : 'harvard') as string;
    const changes = args?.changes || {};

    const summary = typeof changes.summary === 'string' && changes.summary.trim()
      ? changes.summary.trim()
      : cv.summary;

    const skills = (cv.skills || []).map((s: any) => ({ ...s, items: [...(s.items || [])] }));
    const addSkills = (Array.isArray(changes.skillsAdd) ? changes.skillsAdd : [])
      .map(String).filter(Boolean).filter((k: string) => k.length <= 60);
    if (addSkills.length) {
      const existing = new Set(skills.flatMap((s) => s.items.map((i: string) => i.toLowerCase().trim())));
      const fresh = addSkills.filter((k: string) => !existing.has(k.toLowerCase().trim()));
      if (fresh.length) {
        const market = skills.find((s) => s.category?.toLowerCase().includes('market'));
        if (market) market.items = [...market.items, ...fresh];
        else skills.push({ category: 'Market Skills', items: fresh });
      }
    }

    const working = { ...cv, summary, skills };
    const pdf = await generatePdfBuffer(masterCvToTailoredCvShape(working), template);
    const token = crypto.randomUUID();
    cvPdfStore.set(token, { buf: Buffer.from(pdf), expiry: Date.now() + CV_PDF_TTL });
    return { token, template, filename: 'Tailor-CV.pdf' };
  },
};
