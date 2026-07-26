import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class ArbeitnowScraper extends BaseScraper {
  readonly source = 'Arbeitnow' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const keywordsLower = keywords.toLowerCase();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    const filter = params.datePostedFilter || 'all';
    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    if (filter === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
    else if (filter === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    else if (filter === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    const baseUrl = 'https://www.arbeitnow.com/api/job-board-api';
    const maxPages = 5;

    for (let page = 1; page <= maxPages && jobs.length < limit; page++) {
      try {
        const url = `${baseUrl}?page=${page}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.warn(`Arbeitnow API error: ${response.status} on page ${page}`);
          break;
        }

        const data = await response.json();
        const allJobs: any[] = data.data || [];
        if (allJobs.length === 0) break;

        let found = 0;

        for (let i = 0; i < allJobs.length && jobs.length < limit; i++) {
          const job = allJobs[i];
          const title = job.title || '';
          const description = job.description || '';
          const company = job.company_name || 'Unknown';

          const match = !keywordsLower || title.toLowerCase().includes(keywordsLower) || description.toLowerCase().includes(keywordsLower);
          if (!match) continue;

          const jobUrl = job.url || '';
          if (!jobUrl || seenUrls.has(jobUrl)) continue;
          seenUrls.add(jobUrl);

          const postedDate = job.created_at ? new Date(job.created_at * 1000) : new Date();
          if (postedDate.getTime() < Date.now() - maxAgeMs) continue;
          found++;

          const cleanDescription = description
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n')
            .replace(/<li[^>]*>/gi, '\n- ')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .trim();

          jobs.push({
            id: `arbeitnow-${job.slug || Date.now()}-${jobs.length}`,
            title: title || 'Unknown Position',
            company,
            location: job.location || 'Remote',
            source: 'Arbeitnow',
            description: cleanDescription || 'Description not available',
            url: jobUrl,
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            jobType: job.remote ? 'Full-time · Remote' : 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (found === 0) break;
      } catch (err: any) {
        console.warn(`Arbeitnow fetch error on page ${page}:`, err?.message || err);
        break;
      }
    }

    return jobs;
  }
}
