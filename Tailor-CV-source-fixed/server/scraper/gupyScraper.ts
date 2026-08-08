import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

/**
 * Gupy — Brazil's largest tech recruiting portal (78K+ jobs).
 * Free public JSON API (no auth, no key).
 * https://employability-portal.gupy.io/api/v1/jobs?jobName=X&limit=N&offset=N
 */
export class GupyScraper extends BaseScraper {
  readonly source = 'Gupy' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const limit = params.maxJobsPerSource || 10;
    const filter = params.datePostedFilter || 'all';
    const jobs: Job[] = [];
    const seenIds = new Set<string>();

    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    if (filter === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
    else if (filter === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    else if (filter === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    console.log('[Gupy] Starting scrape, limit:', limit, 'keywords:', keywords);

    try {
      let offset = 0;
      const maxOffsets = 3;

      while (jobs.length < limit && offset < maxOffsets) {
        const url = `https://employability-portal.gupy.io/api/v1/jobs?jobName=${encodeURIComponent(keywords)}&limit=20&offset=${offset}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[Gupy] API error: ${response.status}`);
          break;
        }

        const data = await response.json();
        const rawJobs: any[] = data.data || [];
        if (rawJobs.length === 0) break;

        let foundOnPage = 0;
        for (const item of rawJobs) {
          if (jobs.length >= limit) break;

          const id = item.id;
          if (!id || seenIds.has(id)) continue;

          const title = item.name || '';
          if (!title) continue;

          const postedDate = item.publishedDate ? new Date(item.publishedDate) : new Date();
          if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

          const company = item.careerPageName || 'Unknown';
          const location = [item.city, item.state].filter(Boolean).join(', ') || 'Brazil';
          const workplace = item.workplaceType === 'remote' ? 'Remote' : item.workplaceType === 'hybrid' ? 'Hybrid' : 'On-site';
          const jobType = item.type === 'internship' ? `Internship · ${workplace}` : `Full-time · ${workplace}`;

          seenIds.add(id);
          foundOnPage++;

          jobs.push({
            id: `gupy-${id}`,
            title,
            company,
            location,
            source: 'Gupy',
            description: item.description || 'Description not available',
            url: item.jobUrl || item.careerPageUrl || '',
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            jobType,
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[Gupy] Offset ${offset}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        offset += 20;
      }
    } catch (err: any) {
      console.warn('[Gupy] Error:', err?.message || err);
    }

    console.log('[Gupy] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
