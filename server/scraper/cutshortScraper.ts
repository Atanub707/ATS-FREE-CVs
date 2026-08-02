import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

/**
 * Cutshort — India's leading tech job platform.
 * Uses the free public JSON API (no auth, no key).
 * https://cutshort.io/backend-api/webpage/jobs/{role-slug}?page=N
 */
export class CutshortScraper extends BaseScraper {
  readonly source = 'Cutshort' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenIds = new Set<string>();

    const slug = keywords.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'devops';

    console.log('[Cutshort] Starting scrape, limit:', limit, 'keywords:', keywords, 'slug:', slug);

    try {
      let page = 1;
      const maxPages = 3;

      while (jobs.length < limit && page <= maxPages) {
        const url = `https://cutshort.io/backend-api/webpage/jobs/${slug}-jobs?page=${page}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[Cutshort] API error: ${response.status}`);
          break;
        }

        const data = await response.json();
        const rawJobs: any[] = data?.data?.pageData?.jobs || [];
        if (rawJobs.length === 0) break;

        let foundOnPage = 0;
        for (const item of rawJobs) {
          if (jobs.length >= limit) break;

          const id = item._id;
          if (!id || seenIds.has(id)) continue;

          const title = item.headline || '';
          if (!title) continue;

          const company = item.companyDetails?.name || 'Unknown';
          const salary = item.salaryRange;
          let salaryText: string | undefined;
          if (salary?.min && salary?.max) {
            const curr = salary.currency === 'INR' ? '₹' : salary.currency + ' ';
            salaryText = `${curr}${(salary.min / 100000).toFixed(1)}L - ${curr}${(salary.max / 100000).toFixed(1)}L / yr`;
          }

          const expRange = item.expRange || '';
          const remoteType = item.remoteType || '';
          const jobTypeParts = [remoteType === 'remote_okay' ? 'Remote' : remoteType === 'remote_not_okay' ? 'On-site' : ''].filter(Boolean);

          seenIds.add(id);
          foundOnPage++;

          jobs.push({
            id: `cutshort-${id}`,
            title,
            company,
            location: item.locationsText || 'India',
            source: 'Cutshort',
            description: item.sanitizedComment || 'Description not available',
            url: item.publicUrl || `https://cutshort.io/job/${title.replace(/\s+/g, '-')}`,
            postedDate: new Date().toISOString(),
            postedDateParsed: new Date().toISOString().split('T')[0],
            salaryText,
            jobType: jobTypeParts.length > 0 ? jobTypeParts.join(' · ') : 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[Cutshort] Page ${page}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        page++;
      }
    } catch (err: any) {
      console.warn('[Cutshort] Error:', err?.message || err);
    }

    console.log('[Cutshort] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
