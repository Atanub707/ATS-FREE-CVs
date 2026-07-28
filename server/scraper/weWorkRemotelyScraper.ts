import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

const CATEGORIES = [
  'remote-full-stack-programming-jobs',
  'remote-front-end-programming-jobs',
  'remote-back-end-programming-jobs',
  'remote-devops-sysadmin-jobs',
  'remote-design-jobs',
  'remote-product-jobs',
];

export class WeWorkRemotelyScraper extends BaseScraper {
  readonly source = 'WeWorkRemotely' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim().toLowerCase();
    const terms = keywords.split(/\s+/).filter(Boolean);
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    for (const category of CATEGORIES) {
      if (jobs.length >= limit) break;
      try {
        const response = await fetch(`https://weworkremotely.com/categories/${category}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.warn(`WeWorkRemotely HTTP ${response.status} for ${category}`);
          continue;
        }

        const html = await response.text();

        const listingRegex = /<li[^>]*class="[^"]*new-listing-container[^"]*"[^>]*>[\s\S]*?<\/li>/g;
        const listingBlocks = html.match(listingRegex);

        if (!listingBlocks) continue;

        for (const block of listingBlocks) {
          if (jobs.length >= limit) break;

          const titleMatch = block.match(/new-listing__header__title__text[^>]*>([^<]+)</);
          const title = titleMatch ? titleMatch[1].trim() : '';
          if (!title) continue;

          const hrefMatch = block.match(/href="(\/remote-jobs\/[^"]+)"/);
          const href = hrefMatch ? hrefMatch[1] : '';
          if (!href || seenUrls.has(href)) continue;

          const companyMatch = block.match(/company\/([^"']+)/);
          const company = companyMatch ? decodeURIComponent(companyMatch[1].replace(/\+/g, ' ')).replace(/-/g, ' ') : 'Unknown';

          const locationMatch = block.match(/new-listing__header__location[^>]*>([^<]+)</);
          const location = locationMatch ? locationMatch[1].trim() : 'Remote';

          const budgetMatch = block.match(/new-listing__header__budget[^>]*>([^<]+)</);
          const salaryText = budgetMatch ? budgetMatch[1].trim() : '';

          if (terms.length > 0) {
            const searchText = `${title} ${company} ${location}`.toLowerCase();
            const matchedTerms = terms.filter(t => searchText.includes(t));
            const matchRatio = matchedTerms.length / terms.length;
            if (matchRatio < 0.5) continue;
          }

          seenUrls.add(href);

          jobs.push({
            id: `wwr-${jobs.length}-${Date.now()}`,
            title,
            company,
            location: location || 'Remote',
            source: 'WeWorkRemotely',
            description: 'Description not available (view on We Work Remotely)',
            url: `https://weworkremotely.com${href}`,
            postedDate: new Date().toISOString(),
            postedDateParsed: new Date().toISOString().split('T')[0],
            salaryText: salaryText || undefined,
            jobType: 'Full-time · Remote',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`WeWorkRemotely error for ${category}:`, err?.message || err);
      }
    }

    return jobs;
  }
}
