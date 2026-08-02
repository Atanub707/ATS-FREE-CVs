import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

/**
 * MyCareersFuture — Singapore government official job portal.
 * Uses the free public REST API (no auth, no key).
 * https://api.mycareersfuture.gov.sg/v2/jobs
 */
export class MyCareersFutureScraper extends BaseScraper {
  readonly source = 'MyCareersFuture' as const;

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

    const jt = params.jobType || 'all';
    let employmentTypeParam = '';
    if (jt === 'remote') employmentTypeParam = '&employmentType=Remote';
    else if (jt === 'hybrid') employmentTypeParam = '&employmentType=Hybrid';
    else if (jt === 'onsite') employmentTypeParam = '&employmentType=Onsite';

    console.log('[MyCareersFuture] Starting scrape, limit:', limit, 'keywords:', keywords);

    try {
      let page = 1;
      const maxPages = 5;

      while (jobs.length < limit && page <= maxPages) {
        const url = `https://api.mycareersfuture.gov.sg/v2/jobs?searchText=${encodeURIComponent(keywords)}&limit=20&page=${page}${employmentTypeParam}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[MyCareersFuture] API error: ${response.status}`);
          break;
        }

        const data = await response.json();
        const allJobs: any[] = data.results || data.jobs || [];
        if (allJobs.length === 0) break;

        let foundOnPage = 0;
        for (const item of allJobs) {
          if (jobs.length >= limit) break;

          const uuid = item.uuid;
          if (!uuid || seenIds.has(uuid)) continue;

          const title = item.title || '';
          if (!title) continue;

          const company = item.hiringCompany?.name || item.postedCompany?.name || 'Unknown';
          const address = item.address || {};
          const location = address.formattedAddress
            || (address.city ? address.city : '')
            || (address.region ? address.region : '')
            || 'Singapore';

          const postedDateStr = item.metadata?.newPostingDate || item.metadata?.originalPostingDate || item.metadata?.createdAt;
          const postedDate = postedDateStr ? new Date(postedDateStr) : new Date();
          if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

          const employmentType = Array.isArray(item.employmentTypes)
            ? item.employmentTypes.map((e: any) => e.employmentType).filter(Boolean).join(' · ')
            : 'Full-time';

          const salary = item.salary;
          let salaryText: string | undefined;
          if (salary?.minimum && salary?.maximum) {
            const currency = 'SGD';
            salaryText = `SGD ${Number(salary.minimum).toLocaleString()} - ${Number(salary.maximum).toLocaleString()} / ${salary.type?.salaryType || 'month'}`;
          }

          const jobUrl = item.metadata?.jobDetailsUrl
            || `https://www.mycareersfuture.gov.sg/job/${uuid}`;

          const cleanDescription = (item.description || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .trim();

          seenIds.add(uuid);
          foundOnPage++;

          jobs.push({
            id: `mcf-${uuid}`,
            title,
            company,
            location: location || 'Singapore',
            source: 'MyCareersFuture',
            description: cleanDescription || 'Description not available',
            url: jobUrl,
            postedDate: postedDate.toISOString(),
            postedDateParsed: postedDate.toISOString().split('T')[0],
            salaryText,
            jobType: employmentType,
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[MyCareersFuture] Page ${page}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        page++;
      }
    } catch (err: any) {
      console.warn('[MyCareersFuture] Error:', err?.message || err);
    }

    console.log('[MyCareersFuture] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
