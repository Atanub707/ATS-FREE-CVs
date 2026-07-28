import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class RemoteOkScraper extends BaseScraper {
  readonly source = 'RemoteOK' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim().toLowerCase();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    const terms = keywords ? keywords.split(/\s+/).filter(Boolean) : [];

    try {
      const response = await fetch('https://remoteok.com/api', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`RemoteOK API error: ${response.status}`);
        return jobs;
      }

      const data = await response.json();
      const allJobs: any[] = data.slice(1);
      if (allJobs.length === 0) return jobs;

      for (const job of allJobs) {
        if (jobs.length >= limit) break;

        const position = (job.position || '').trim();
        const company = (job.company || '').trim();
        const description = (job.description || '').trim();
        const tags: string[] = job.tags || [];

        if (!position || position === 'No positions currently available') continue;

        const searchText = `${position} ${company} ${description} ${tags.join(' ')}`.toLowerCase();

        let match = terms.length === 0;
        if (terms.length === 1) {
          match = searchText.includes(terms[0]);
        } else if (terms.length > 1) {
          const matchedTerms = terms.filter(t => searchText.includes(t));
          match = matchedTerms.length >= Math.ceil(terms.length * 0.5);
        }
        if (!match) continue;

        const jobUrl = job.url || job.apply_url || '';
        if (!jobUrl || seenUrls.has(jobUrl)) continue;
        seenUrls.add(jobUrl);

        const postedDate = job.date ? new Date(job.date) : new Date();

        const cleanDescription = description
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n[ \t]+/g, '\n')
          .trim();

        jobs.push({
          id: `remoteok-${job.id || Date.now()}-${jobs.length}`,
          title: position,
          company: company || 'Unknown',
          location: 'Remote',
          source: 'RemoteOK',
          description: cleanDescription || 'Description not available',
          url: jobUrl,
          postedDate: postedDate.toISOString(),
          postedDateParsed: postedDate.toISOString().split('T')[0],
          salaryMin: job.salary_min > 0 ? job.salary_min : undefined,
          salaryMax: job.salary_max > 0 ? job.salary_max : undefined,
          jobType: 'Full-time · Remote',
          state: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn('RemoteOK fetch error:', err?.message || err);
    }

    return jobs;
  }
}
