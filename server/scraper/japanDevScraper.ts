import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class JapanDevScraper extends BaseScraper {
  readonly source = 'JapanDev' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const limit = params.maxJobsPerSource || 10;
    const filter = params.datePostedFilter || 'all';

    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    if (filter === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
    else if (filter === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    else if (filter === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    try {
      const url = `https://japan-dev.com/jobs?query=${encodeURIComponent(keywords)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { console.warn(`JapanDev returned ${res.status}`); return jobs; }

      const html = await res.text();

      // Extract job detail paths from HTML
      const linkRegex = /href="(\/jobs\/[^"]+)"/g;
      const paths: string[] = [];
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const path = match[1];
        if (path.startsWith('/jobs/') && !path.includes('_nuxt') && !path.includes('/jobs-in-japan')) {
          if (!seenUrls.has(path)) {
            seenUrls.add(path);
            paths.push(path);
          }
        }
      }

      console.log(`JapanDev: ${paths.length} job links found`);

      for (let i = 0; i < paths.length && jobs.length < limit; i++) {
        const fullUrl = `https://japan-dev.com${paths[i]}`;

        // Try to extract basic info from URL path (fallback)
        const pathParts = paths[i].replace('/jobs/', '').split('/');
        const urlCompany = pathParts[0]?.replace(/-/g, ' ') || 'Unknown Company';
        const urlTitlePart = pathParts[1] || '';
        const urlTitle = urlTitlePart
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/ /g, ' ')
          || 'Unknown Position';

        // Fetch detail page
        await this.delay(1000 + Math.random() * 2000);
        try {
          const detailRes = await fetch(fullUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(15000),
          });
          if (!detailRes.ok) continue;

          const dh = await detailRes.text();

          let title = urlTitle;
          let company = urlCompany;
          let description = '';
          let postedDate = new Date();

          // Extract JobPosting JSON-LD from all ld+json script tags
          const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/g;
          let ldMatch;
          while ((ldMatch = ldRegex.exec(dh)) !== null) {
            try {
              const parsed = JSON.parse(ldMatch[1]);
              const items = Array.isArray(parsed) ? parsed : [parsed];
              for (const item of items) {
                if (item['@type'] === 'JobPosting') {
                  title = item.title?.replace(/\\u002F/g, '/') || title;
                  company = item.hiringOrganization?.name || company;
                  if (item.description) {
                    description = item.description
                      .replace(/<br\s*\/?>/gi, '\n')
                      .replace(/<\/p>/gi, '\n')
                      .replace(/<\/li>/gi, '\n')
                      .replace(/<li[^>]*>/gi, '\n- ')
                      .replace(/<[^>]+>/g, '')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim();
                  }
                  if (item.datePosted) postedDate = new Date(item.datePosted);
                  break;
                }
              }
            } catch {}
          }

          jobs.push({
            id: `japandev-${Buffer.from(paths[i]).toString('base64').slice(0, 20)}`,
            title,
            company,
            location: 'Japan',
            source: 'JapanDev',
            description,
            url: fullUrl,
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            jobType: 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch {
          continue;
        }
        console.log(`  [JapanDev ${i + 1}/${Math.min(paths.length, limit)}] ${jobs[jobs.length - 1]?.title || '?'}`);
      }
    } catch (err: any) {
      console.warn('JapanDev error:', err?.message);
    }
    return jobs;
  }
}
