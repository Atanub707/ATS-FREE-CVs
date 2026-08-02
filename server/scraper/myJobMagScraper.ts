import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';
import * as cheerio from 'cheerio';

/**
 * MyJobMag — Nigeria's largest job portal (29K+ jobs).
 * Server-rendered HTML with li.job-list-li cards.
 */
export class MyJobMagScraper extends BaseScraper {
  readonly source = 'MyJobMag' as const;

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

    console.log('[MyJobMag] Starting scrape, limit:', limit, 'keywords:', keywords);

    try {
      let page = 1;
      const maxPages = 3;

      while (jobs.length < limit && page <= maxPages) {
        const url = page === 1
          ? `https://www.myjobmag.com/search/jobs?q=${encodeURIComponent(keywords)}`
          : `https://www.myjobmag.com/search/jobs?q=${encodeURIComponent(keywords)}&page=${page}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[MyJobMag] HTTP ${response.status}`);
          break;
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const cards = $('li.job-list-li').toArray();
        if (cards.length === 0) break;

        let foundOnPage = 0;
        for (const el of cards) {
          if (jobs.length >= limit) break;
          const $el = $(el);

          const linkEl = $el.find('h2 a').first();
          const fullTitle = linkEl.text().replace(/\s+/g, ' ').trim();
          if (!fullTitle) continue;

          const href = linkEl.attr('href') || '';
          const companyMatch = fullTitle.match(/at\s+(.+)$/);
          const title = fullTitle.replace(/\s+at\s+.+$/, '').trim();
          const company = companyMatch?.[1]?.trim() || 'Unknown Company';

          if (seenIds.has(href)) continue;
          seenIds.add(href);

          const dateText = $el.find('.job-date, #job-date, .listing-date').first().text().trim();
          const postedDate = parseDate(dateText);

          if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

          const desc = $el.find('[class*=desc]').first().text().replace(/\s+/g, ' ').trim();

          // Unique slug from the href path (e.g. /job/devops-engineer-acme-limited)
          const slug = href.replace(/^\/job\//, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');

          foundOnPage++;
          jobs.push({
            id: `myjobmag-${slug || Buffer.from(href).toString('base64').slice(-14)}`,
            title,
            company,
            location: 'Nigeria',
            source: 'MyJobMag',
            description: desc || 'Description not available',
            url: `https://www.myjobmag.com${href}`,
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            jobType: 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[MyJobMag] Page ${page}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        page++;
      }
    } catch (err: any) {
      console.warn('[MyJobMag] Error:', err?.message || err);
    }

    console.log('[MyJobMag] Returning', jobs.length, 'jobs');
    return jobs;
  }
}

function parseDate(text: string): Date {
  const t = text.toLowerCase();
  const now = new Date();
  if (!t) return now;
  const dayMatch = t.match(/(\d+)\s*(day|days)/);
  if (dayMatch) return new Date(now.getTime() - parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000);
  const hourMatch = t.match(/(\d+)\s*(hour|hours|hrs)/);
  if (hourMatch) return new Date(now.getTime() - parseInt(hourMatch[1], 10) * 60 * 60 * 1000);
  const monthNames: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const m = t.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})?/);
  if (m && monthNames[m[2]] !== undefined) {
    const year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    return new Date(year, monthNames[m[2]], parseInt(m[1], 10));
  }
  return now;
}
