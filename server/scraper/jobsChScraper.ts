import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

/**
 * Jobs.ch — Switzerland's largest job portal.
 * Embedded JSON-LD in search page HTML (CollectionPage + ItemList of JobPosting).
 */
export class JobsChScraper extends BaseScraper {
  readonly source = 'JobsCh' as const;

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

    console.log('[JobsCh] Starting scrape, limit:', limit, 'keywords:', keywords);

    try {
      let page = 1;
      const maxPages = 3;

      while (jobs.length < limit && page <= maxPages) {
        const url = page === 1
          ? `https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(keywords)}`
          : `https://www.jobs.ch/en/vacancies/?term=${encodeURIComponent(keywords)}&load_more=${page}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[JobsCh] HTTP ${response.status}`);
          break;
        }

        const html = await response.text();
        const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
        if (!ldMatch) break;

        const ldArray = JSON.parse(ldMatch[1].replace(/&quot;/g, '"'));
        const itemList = Array.isArray(ldArray) ? ldArray.find((b: any) => b['@type'] === 'ItemList') : null;
        const elements = itemList?.itemListElement || [];
        if (elements.length === 0) break;

        let foundOnPage = 0;
        for (const el of elements) {
          if (jobs.length >= limit) break;
          const job = el.item;
          if (!job?.title) continue;

          const url = job.url || '';
          if (seenIds.has(url)) continue;
          seenIds.add(url);

          // Extract unique UUID from detail URL: /detail/{uuid}/
          const uuidMatch = url.match(/\/detail\/([a-f0-9-]+)/i);
          const jobKey = uuidMatch?.[1] || Buffer.from(url).toString('base64').slice(-16);

          const postedDate = job.datePosted ? new Date(job.datePosted) : new Date();
          if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

          const company = job.hiringOrganization?.name || 'Unknown';
          const address = job.jobLocation?.address || {};
          const location = [address.addressLocality, address.addressRegion, address.addressCountry === 'CH' ? 'Switzerland' : address.addressCountry]
            .filter(Boolean).join(', ') || 'Switzerland';

          const cleanDescription = (job.description || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .trim();

          foundOnPage++;
          jobs.push({
            id: `jobsch-${jobKey}`,
            title: job.title,
            company,
            location,
            source: 'JobsCh',
            description: cleanDescription || 'Description not available',
            url,
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            jobType: job.employmentType || 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[JobsCh] Page ${page}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        page++;
      }
    } catch (err: any) {
      console.warn('[JobsCh] Error:', err?.message || err);
    }

    console.log('[JobsCh] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
