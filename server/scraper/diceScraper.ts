import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class DiceScraper extends BaseScraper {
  readonly source = 'Dice' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const location = params.location?.trim() || '';
    const limit = params.maxJobsPerSource || 10;
    const filter = params.datePostedFilter || 'all';
    const jobs: Job[] = [];
    const seenIds = new Set<string>();

    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    if (filter === '24h') maxAgeMs = 24 * 60 * 60 * 1000;
    else if (filter === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    else if (filter === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    try {
      const url = `https://www.dice.com/jobs?q=${encodeURIComponent(keywords)}${location ? `&location=${encodeURIComponent(location)}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`Dice search returned ${response.status}`);
        return jobs;
      }

      const html = await response.text();

      // Extract job detail UUIDs
      const linkRegex = /href=\"\/job-detail\/([a-f0-9-]+)\"/g;
      const uuids: string[] = [];
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const id = match[1];
        if (!seenIds.has(id)) {
          seenIds.add(id);
          uuids.push(id);
        }
      }

      // Extract company names (in order)
      const companyRegex = /company-name[^>]*>([^<]+)/g;
      const companies: string[] = [];
      while ((match = companyRegex.exec(html)) !== null) {
        companies.push(match[1].trim().replace(/&amp;/g, '&'));
      }

      if (uuids.length === 0) {
        console.warn('Dice: no job UUIDs found on search page (possible rate limit)');
        return jobs;
      }
      console.log(`Dice: ${uuids.length} job UUIDs found`);

      const batchSize = 5;
      const toFetch = uuids.slice(0, limit);
      for (let batchStart = 0; batchStart < toFetch.length; batchStart += batchSize) {
        const batch = toFetch.slice(batchStart, batchStart + batchSize);
        const results = await Promise.allSettled(batch.map(async (uuid) => {
          const detailRes = await fetch(`https://www.dice.com/job-detail/${uuid}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(10000),
          });
          if (!detailRes.ok) return null;
          const detailHtml = await detailRes.text();
          const ldMatch = detailHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/);
          if (!ldMatch) return null;
          const ld = JSON.parse(ldMatch[1]);
          if (ld['@type'] !== 'JobPosting') return null;

          const idx = uuids.indexOf(uuid);
          return {
            title: ld.title || 'Unknown Position',
            company: ld.hiringOrganization?.name || companies[idx] || 'Unknown Company',
            location: ld.jobLocation?.address?.addressLocality || ld.jobLocation?.address?.addressRegion || location || 'Remote',
            postedDate: ld.datePosted ? new Date(ld.datePosted) : new Date(),
            salaryText: ld.baseSalary?.value?.value
              ? `$${ld.baseSalary.value.value.toLocaleString()} / ${ld.baseSalary.value.unitText || 'year'}`
              : ld.estimatedSalary?.value?.value
              ? `$${ld.estimatedSalary.value.value.toLocaleString()} / ${ld.estimatedSalary.value.unitText || 'year'}`
              : undefined,
            description: ld.description
              ? ld.description.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
                .replace(/<\/li>/gi, '\n').replace(/<li[^>]*>/gi, '\n- ')
                .replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
              : '',
            jobType: ld.employmentType || 'Full-time',
            uuid,
          };
        }));

        for (const r of results) {
          if (r.status !== 'fulfilled' || !r.value) continue;
          const d = r.value;
          if (d.postedDate.getTime() < Date.now() - maxAgeMs) continue;
          jobs.push({
            id: `dice-${d.uuid}`, title: d.title, company: d.company,
            location: d.location, source: 'Dice', description: d.description,
            url: `https://www.dice.com/job-detail/${d.uuid}`,
            postedDate: d.postedDate.toISOString(),
            postedDateParsed: d.postedDate.toISOString().split('T')[0],
            salaryText: d.salaryText, jobType: d.jobType,
            state: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        }
        console.log(`  [Dice batch] ${jobs.length} jobs so far`);
        if (batchStart + batchSize < toFetch.length) await this.delay(1000);
      }
    } catch (err: any) {
      console.warn('Dice error:', err?.message);
    }

    return jobs;
  }
}
