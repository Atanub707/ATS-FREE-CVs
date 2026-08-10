import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate, parseSalary } from './apifyBase.js';

// Totaljobs (UK) via valig/totaljobs-jobs-scraper (~$0.40 per 1K,
// Apify-powered). Output shape (README): id, title, url, datePosted (ISO),
// location (string), company.name, workType ("Permanent"), salary (STRING
// like "£65000.00 - £70000 per annum"), description (HTML).

const POSTED_WITHIN: Record<string, string> = { '24h': '1', '7d': '7', '30d': '14' };

export class TotaljobsScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Totaljobs';
  readonly actorId = 'valig~totaljobs-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && POSTED_WITHIN[params.datePostedFilter]) {
      input.postedWithin = POSTED_WITHIN[params.datePostedFilter];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || id === undefined) return null;
    const now = new Date().toISOString();
    const salary = parseSalary(item.salary);
    const cleanedDescription = cleanDescription(extractDescription(item));

    return {
      id: `totaljobs-${id}`,
      title,
      company: item.company?.name || 'Unknown Company',
      location: typeof item.location === 'string' ? item.location : '',
      source: 'Totaljobs',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.totaljobs.com/job/${id}`,
      postedDate: normalizeIsoDate(item.datePosted),
      ...(item.datePosted ? { postedDateParsed: String(item.datePosted).slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(item.workType ? { jobType: String(item.workType) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
