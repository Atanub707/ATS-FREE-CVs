import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';
import * as cheerio from 'cheerio';

/**
 * Daijob — Japan's English-language job portal (8.7K+ jobs).
 * Server-rendered HTML with .job-card elements.
 */
export class DaijobScraper extends BaseScraper {
  readonly source = 'Daijob' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenIds = new Set<string>();

    console.log('[Daijob] Starting scrape, limit:', limit, 'keywords:', keywords);

    try {
      let page = 1;
      const maxPages = 3;

      while (jobs.length < limit && page <= maxPages) {
        const url = `https://www.daijob.com/en/jobs/search?keywords=${encodeURIComponent(keywords)}&page=${page}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[Daijob] HTTP ${response.status}`);
          break;
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const cards = $('.job-card').toArray();
        if (cards.length === 0) break;

        let foundOnPage = 0;
        for (const el of cards) {
          if (jobs.length >= limit) break;
          const $el = $(el);

          const title = $el.find('[class*=title]').first().text().replace(/\s+/g, ' ').trim() || '';
          if (!title) continue;

          const detailLink = $el.find('a[href*="/en/jobs/detail/"]').first().attr('href');
          const jobId = detailLink?.match(/detail\/(\d+)/)?.[1];
          if (!jobId || seenIds.has(jobId)) continue;
          seenIds.add(jobId);

          const company = $el.find('img[alt]').attr('alt') || 'Unknown Company';

          const bodyText = $el.find('.job-card__body').text().replace(/\s+/g, ' ').trim();
          const locationMatch = bodyText.match(/Location\s*([\s\S]*?)\s*Salary/i);
          const location = locationMatch?.[1]?.trim() || 'Japan';
          const salaryMatch = bodyText.match(/Salary\s*([\s\S]*?)(?:Japanese|$)/i);
          const salaryText = salaryMatch?.[1]?.trim() || undefined;

          foundOnPage++;
          jobs.push({
            id: `daijob-${jobId}`,
            title,
            company,
            location,
            source: 'Daijob',
            description: 'Description not available (view on Daijob)',
            url: `https://www.daijob.com/en/jobs/detail/${jobId}`,
            postedDate: new Date().toISOString(),
            postedDateParsed: new Date().toISOString().split('T')[0],
            salaryText,
            jobType: 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[Daijob] Page ${page}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        page++;
      }
    } catch (err: any) {
      console.warn('[Daijob] Error:', err?.message || err);
    }

    console.log('[Daijob] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
