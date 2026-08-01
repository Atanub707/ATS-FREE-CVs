import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';
import * as cheerio from 'cheerio';

const SIMPLYHIRED_SEARCH = 'https://www.simplyhired.com/search';

export class SimplyHiredScraper extends BaseScraper {
  readonly source = 'SimplyHired' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const location = params.location?.trim() || '';
    const limit = params.maxJobsPerSource || 10;
    const filter = params.datePostedFilter || 'all';

    const jobs: Job[] = [];
    const seenKeys = new Set<string>();

    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    let fdbParam = '';
    if (filter === '24h') { maxAgeMs = 24 * 60 * 60 * 1000; fdbParam = '1'; }
    else if (filter === '7d') { maxAgeMs = 7 * 24 * 60 * 60 * 1000; fdbParam = '7'; }
    else if (filter === '30d') { maxAgeMs = 30 * 24 * 60 * 60 * 1000; fdbParam = '30'; }

    try {
      const baseUrl = `${SIMPLYHIRED_SEARCH}?q=${encodeURIComponent(keywords)}${location ? `&l=${encodeURIComponent(location)}` : ''}${fdbParam ? `&fdb=${fdbParam}` : ''}`;
      let page = 0;
      const maxPages = 3;

      while (jobs.length < limit && page < maxPages) {
        const pageUrl = page === 0 ? baseUrl : `${baseUrl}&start=${page * 20}`;
        page++;
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          if (page === 1) console.warn(`SimplyHired returned ${response.status}`);
          break;
        }

        const html = await response.text();
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
        if (!match) break;

        const data = JSON.parse(match[1].replace(/&q;/g, '"'));
        const rawJobs: any[] = data?.props?.pageProps?.jobs || [];

        if (rawJobs.length === 0) break;

        for (const item of rawJobs) {
          if (jobs.length >= limit) break;
          const key = item.jobKey;
          if (!key || seenKeys.has(key)) continue;
          seenKeys.add(key);

          const postedDate = item.dateOnIndeed ? new Date(item.dateOnIndeed) : new Date();
          if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

          const salaryText = item.salaryInfo || undefined;
          const jobTypes = Array.isArray(item.jobTypes) ? item.jobTypes.join(' · ') : 'Full-time';
          const isRemote = Array.isArray(item.remoteAttributes) && item.remoteAttributes.length > 0;

          jobs.push({
            id: `simplyhired-${key}`,
            title: item.title || 'Unknown Position',
            company: item.company || 'Unknown Company',
            location: item.location || location || 'Remote',
            source: 'SimplyHired',
            description: item.snippet || '',
            url: item.botUrl ? `https://www.simplyhired.com${item.botUrl}` : '',
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            salaryText,
            jobType: isRemote ? `Full-time · Remote` : jobTypes,
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      console.log(`SimplyHired: ${jobs.length} jobs from ${fdbParam ? 'filtered' : 'unfiltered'} search`);

      // Fetch detail pages for descriptions
      let detailCount = 0;
      for (const job of jobs) {
        await this.delay(1000 + Math.random() * 2000);
        try {
          if (!job.url) continue;
          const detailRes = await fetch(job.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(10000),
          });
          if (!detailRes.ok) continue;

          const detailHtml = await detailRes.text();
          const $$ = cheerio.load(detailHtml);

          const jsonLd = $$('script[type="application/ld+json"]').toArray();
          for (const script of jsonLd) {
            try {
              const parsed = JSON.parse($$(script).text());
              const posting = parsed['@type'] === 'JobPosting' ? parsed : null;
              if (posting?.description) {
                job.description = posting.description
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/p>/gi, '\n')
                  .replace(/<\/li>/gi, '\n')
                  .replace(/<li[^>]*>/gi, '\n- ')
                  .replace(/<[^>]+>/g, '')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim() || job.description;
                if (posting.hiringOrganization?.name) job.company = posting.hiringOrganization.name;
                break;
              }
            } catch {}
          }
        } catch {}
        detailCount++;
        console.log(`  [SimplyHired detail ${detailCount}/${jobs.length}] ${job.title}`);
      }
    } catch (err: any) {
      console.warn('SimplyHired error:', err?.message);
    }

    return jobs;
  }
}
