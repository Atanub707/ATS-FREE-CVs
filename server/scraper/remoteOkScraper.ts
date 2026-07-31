import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

const JUNK_TITLES = new Set(['nunavut', 'other', 'full', 'free', 'candidate requirements', 'join our team', 'come and join us', 'skip content', 'why join us', 'current vacancies', 'all jobs', 'no open roles right now', 'widen the circle', 'we are', 'take the initiative', 'we don\'t currently have any open roles', 'i want all the money', 'job hunting indecision']);

export class RemoteOkScraper extends BaseScraper {
  readonly source = 'RemoteOK' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const limit = params.maxJobsPerSource || 10;
    const keywords = params.keywords.trim().toLowerCase();
    const terms = keywords ? keywords.split(/\s+/).filter(Boolean) : [];
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    console.log('[RemoteOK] Starting scrape, limit:', limit, 'keywords:', keywords);

    const response = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`RemoteOK API returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('RemoteOK API returned unexpected format: not an array');
    }

    const allJobs: any[] = data.slice(1);
    console.log('[RemoteOK] API returned', allJobs.length, 'jobs');

    for (const job of allJobs) {
      if (jobs.length >= limit) break;

      const position = (job.position || '').trim();
      if (!position || JUNK_TITLES.has(position.toLowerCase())) continue;

      if (terms.length > 0) {
        const tags: string[] = (job.tags || []).map((t: string) => t.toLowerCase());
        const positionLower = position.toLowerCase();
        const hit = terms.some((t) => positionLower.includes(t) || tags.some((tag) => tag.includes(t)));
        if (!hit) continue;
      }

      const company = (job.company || '').trim();
      const description = (job.description || '').trim();

      const jobUrl = job.url || job.apply_url || '';
      if (!jobUrl || seenUrls.has(jobUrl)) continue;
      seenUrls.add(jobUrl);

      const postedDate = job.date ? new Date(job.date) : new Date();

      const cleanDescription = description
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .trim();

      jobs.push({
        id: `remoteok-${job.id || Date.now()}-${jobs.length}`,
        title: position,
        company: company || 'Unknown',
        location: 'Remote',
        source: 'RemoteOK',
        description: cleanDescription || 'Description not available',
        url: jobUrl,
        postedDate: postedDate.toISOString(),
        postedDateParsed: postedDate.toISOString().split('T')[0],
        salaryMin: job.salary_min > 0 ? job.salary_min : undefined,
        salaryMax: job.salary_max > 0 ? job.salary_max : undefined,
        jobType: 'Full-time · Remote',
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    console.log('[RemoteOK] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
