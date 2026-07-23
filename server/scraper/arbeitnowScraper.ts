import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class ArbeitnowScraper extends BaseScraper {
  readonly source = 'Arbeitnow' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim().toLowerCase();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    const url = 'https://www.arbeitnow.com/api/job-board-api';

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(`Arbeitnow API error: ${response.status}`);
        return jobs;
      }

      const data = await response.json();
      const allJobs: any[] = data.data || [];

      for (const job of allJobs) {
        if (jobs.length >= limit) break;

        const title = job.title || '';
        const description = job.description || '';
        const company = job.company_name || 'Unknown';

        const match = !keywords || title.toLowerCase().includes(keywords) || description.toLowerCase().includes(keywords);
        if (!match) continue;

        const jobUrl = job.url || '';
        if (!jobUrl || seenUrls.has(jobUrl)) continue;
        seenUrls.add(jobUrl);

        const cleanDescription = description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

        jobs.push({
          id: `arbeitnow-${job.slug || Date.now()}-${jobs.length}`,
          title: title || 'Unknown Position',
          company,
          location: job.location || 'Remote',
          source: 'Arbeitnow',
          description: cleanDescription || 'Description not available',
          url: jobUrl,
          postedDate: job.created_at ? new Date(job.created_at).toISOString() : new Date().toISOString(),
          postedDateParsed: job.created_at ? new Date(job.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          jobType: job.remote ? 'Full-time · Remote' : 'Full-time',
          state: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn('Arbeitnow fetch error:', err?.message || err);
    }

    return jobs;
  }
}
