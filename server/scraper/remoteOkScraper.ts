import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class RemoteOkScraper extends BaseScraper {
  readonly source = 'RemoteOK' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim().toLowerCase();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    const filter = params.datePostedFilter || 'all';
    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    if (filter === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
    else if (filter === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    else if (filter === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    try {
      const response = await fetch('https://remoteok.com/api', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`RemoteOK API error: ${response.status}`);
        return jobs;
      }

      const data = await response.json();
      const allJobs: any[] = data.slice(1);
      if (allJobs.length === 0) return jobs;

      for (const job of allJobs) {
        if (jobs.length >= limit) break;

        const position = (job.position || '').trim();
        const company = (job.company || '').trim();
        const description = (job.description || '').trim();
        const tags: string[] = job.tags || [];

        const searchText = `${position} ${company} ${description} ${tags.join(' ')}`.toLowerCase();
        const match = !keywords || searchText.includes(keywords);
        if (!match) continue;

        const jobUrl = job.url || job.apply_url || '';
        if (!jobUrl || seenUrls.has(jobUrl)) continue;
        seenUrls.add(jobUrl);

        const postedDate = job.date ? new Date(job.date) : new Date();
        if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

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
          title: position || 'Unknown Position',
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
    } catch (err: any) {
      console.warn('RemoteOK fetch error:', err?.message || err);
    }

    return jobs;
  }
}
