import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

const GREENHOUSE = [
  'stripe', 'airbnb', 'shopify', 'gitlab', 'coinbase', 'dropbox', 'pinterest',
  'snapchat', 'doordash', 'reddit', 'cloudflare', 'godaddy', 'wayfair', 'etsy',
  'twilio', 'hubspot', 'databricks', 'robinhood', 'chime', 'brex', 'rippling',
  'deel', 'instacart', 'datadog', 'notion', 'linear', 'vercel', 'netlify',
  'segment', 'intercom', 'front', 'figma', 'asana', 'box', 'coda',
  'checkr', 'brex', 'ironclad', 'airtable', 'figma', 'retool', 'webflow',
  'angelist', 'brex', 'chime', 'deel', 'gem', 'gusto', 'hopin',
];

const LEVER = [
  'box', 'asana', 'notion', 'linear', 'vercel', 'netlify', 'segment',
  'coda', 'intercom', 'front', 'figma', 'confluent', 'mongodb', 'amplitude',
  'medallia', 'genesys', 'autodesk', 'zendesk', 'splunk', 'docusign',
  'okta', 'cloudflare', 'datadog', 'newrelic', 'sumologic', 'pagerduty',
];

async function fetchGreenhouse(company: string, keyword: string, limit: number): Promise<Job[]> {
  const jobs: Job[] = [];
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/departments`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return jobs;
    const data = await res.json();
    if (!data.departments) return jobs;

    for (const dept of data.departments) {
      if (!dept.jobs) continue;
      for (const j of dept.jobs) {
        if (jobs.length >= limit) break;
        if (!j.title?.toLowerCase().includes(keyword)) continue;
        const jobId = j.id || j.internal_job_id;
        if (!jobId) continue;

        jobs.push({
          id: `gh-${company}-${jobId}`, title: j.title,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location: j.location?.name || 'Remote', source: 'Greenhouse',
          description: '', url: j.absolute_url || `https://boards.greenhouse.io/${company}/jobs/${jobId}`,
          postedDate: j.updated_at ? new Date(j.updated_at).toISOString() : new Date().toISOString(),
          postedDateParsed: j.updated_at ? new Date(j.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          jobType: 'Full-time', state: 'pending',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch {}
  return jobs;
}

async function fetchLever(company: string, keyword: string, limit: number): Promise<Job[]> {
  const jobs: Job[] = [];
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return jobs;
    const data = await res.json();
    if (!Array.isArray(data)) return jobs;

    for (const p of data) {
      if (jobs.length >= limit) break;
      if (!p.text?.toLowerCase().includes(keyword)) continue;
      jobs.push({
        id: `lever-${company}-${p.id}`, title: p.text,
        company: company.charAt(0).toUpperCase() + company.slice(1),
        location: p.categories?.location || 'Remote', source: 'Lever',
        description: p.descriptionPlain || p.description || '',
        url: p.hostedUrl || `https://jobs.lever.co/${company}/${p.id}`,
        postedDate: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        postedDateParsed: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        jobType: p.categories?.commitment || 'Full-time', state: 'pending',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
  } catch {}
  return jobs;
}

export class CompanyPortalScraper extends BaseScraper {
  readonly source = 'CompanyPortal' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keyword = params.keywords.trim().toLowerCase();
    const limit = params.maxJobsPerSource || 10;
    const level = params.experienceLevel || 'all';
    const sources = params.sources || [];
    if (!keyword) return [];

    const levelFilters: Record<string, (title: string) => boolean> = {
      all: () => true,
      entry: (t) => /junior|jr\.?|entry|graduate|new\s*grad|associate/i.test(t),
      mid: (t) => !/junior|jr\.?|entry|graduate|new\s*grad|senior|sr\.?|lead|staff|principal|architect|head|director|vp|vice\s*president/i.test(t),
      senior: (t) => /senior|sr\.?|staff|principal/i.test(t) && !/junior|jr\.?|entry/i.test(t),
      lead: (t) => /lead|head|director|vp|vice\s*president|principal|architect|manager/i.test(t) && !/junior|jr\.?|entry/i.test(t),
    };
    const levelFilter = levelFilters[level] || levelFilters.all;

    const useGh = sources.includes('Greenhouse') || sources.includes('Lever');
    const useLv = sources.includes('Lever');

    console.log(`Greenhouse & Lever: searching "${keyword}" (${level})${useGh ? ' Greenhouse' : ''}${useLv ? ' + Lever' : ''}...`);

    const allJobs: Job[] = [];
    if (useGh || (!useGh && !useLv)) {
      const ghResults = await Promise.allSettled(GREENHOUSE.map(c => fetchGreenhouse(c, keyword, limit * 3)));
      for (const r of ghResults) if (r.status === 'fulfilled') allJobs.push(...r.value);
    }
    if (useLv) {
      const lvResults = await Promise.allSettled(LEVER.map(c => fetchLever(c, keyword, limit * 3)));
      for (const r of lvResults) if (r.status === 'fulfilled') allJobs.push(...r.value);
    }

    const filtered = allJobs.filter(j => levelFilter(j.title));
    filtered.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());

    console.log(`  Found ${filtered.length} "${keyword}" (${level}) jobs`);
    return filtered.slice(0, limit);
  }
}
