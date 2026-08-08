import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class ReedScraper extends BaseScraper {
  readonly source = 'Reed' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const location = params.location?.trim() || '';
    const limit = params.maxJobsPerSource || 10;
    const filter = params.datePostedFilter || 'all';

    const jobs: Job[] = [];
    const seenIds = new Set<string>();

    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    let dateParam = '';
    if (filter === '24h') { maxAgeMs = 24 * 60 * 60 * 1000; dateParam = '&dateCreatedOffSet=today'; }
    else if (filter === '7d') { maxAgeMs = 7 * 24 * 60 * 60 * 1000; dateParam = '&dateCreatedOffSet=lastSevenDays'; }
    else if (filter === '30d') { maxAgeMs = 30 * 24 * 60 * 60 * 1000; dateParam = '&dateCreatedOffSet=lastThirtyDays'; }

    try {
      const url = `https://www.reed.co.uk/jobs/${encodeURIComponent(keywords.toLowerCase().replace(/\s+/g, '-'))}-jobs?q=${encodeURIComponent(keywords)}${dateParam}${location ? `&location=${encodeURIComponent(location)}` : ''}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { console.warn(`Reed returned ${res.status}`); return jobs; }

      const html = await res.text();
      const nd = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([^<]+)<\/script>/);
      if (!nd) { console.warn('Reed: no __NEXT_DATA__'); return jobs; }

      const data = JSON.parse(nd[1]);
      const rawJobs = data?.props?.pageProps?.searchResults?.jobs || [];

      for (const item of rawJobs) {
        if (jobs.length >= limit) break;
        const detail = item.jobDetail || item;
        const jobId = detail.jobId;
        if (!jobId || seenIds.has(jobId)) continue;
        seenIds.add(jobId);

        const dateStr = detail.displayDate || detail.dateCreated;
        const postedDate = dateStr ? new Date(dateStr) : new Date();
        if (postedDate.getTime() < Date.now() - maxAgeMs) continue;

        const jobType = [detail.isFullTime ? 'Full-time' : '', detail.isPartTime ? 'Part-time' : '', detail.remoteWorkingOption].filter(Boolean).join(' · ') || 'Full-time';

        // Build URL from job title
        const slug = detail.jobTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'job';
        const jobUrl = `https://www.reed.co.uk/jobs/${slug}/${jobId}`;

        jobs.push({
          id: `reed-${jobId}`,
          title: detail.jobTitle || 'Unknown Position',
          company: detail.ouName || detail.employerName || 'Unknown Company',
          location: detail.displayLocationName || location || 'Remote',
          source: 'Reed',
          description: detail.jobDescriptionSnippet || '',
          url: jobUrl,
          postedDate: postedDate.toISOString(),
          postedDateParsed: postedDate.toISOString().split('T')[0],
          salaryText: detail.salaryFrom || detail.salaryTo
            ? `${detail.salaryCurrencyId === 1 ? '£' : '$'}${Number(detail.salaryFrom || 0).toLocaleString()} - ${detail.salaryCurrencyId === 1 ? '£' : '$'}${Number(detail.salaryTo || 0).toLocaleString()}`
            : detail.salaryDescription || undefined,
          jobType,
          state: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(`Reed: ${jobs.length} jobs`);

      // Fetch descriptions from detail pages
      for (let i = 0; i < jobs.length; i++) {
        await this.delay(1000 + Math.random() * 2000);
        try {
          const detailRes = await fetch(jobs[i].url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(10000),
          });
          if (!detailRes.ok) continue;
          const dh = await detailRes.text();
          const ld = dh.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
          if (ld) {
            try {
              const parsed = JSON.parse(ld[1]);
              const p = parsed['@type'] === 'JobPosting' ? parsed : null;
              if (p?.description) {
                jobs[i].description = p.description.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
              }
              if (p?.hiringOrganization?.name) jobs[i].company = p.hiringOrganization.name;
            } catch {}
          }
        } catch {}
        console.log(`  [Reed detail ${i + 1}/${jobs.length}] ${jobs[i].title}`);
      }
    } catch (err: any) {
      console.warn('Reed error:', err?.message);
    }
    return jobs;
  }
}
