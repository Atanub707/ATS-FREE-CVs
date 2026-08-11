import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription } from './apifyBase.js';

// Glassdoor via valig/glassdoor-jobs-scraper (~$0.40 per 1K, Apify-powered).
// Output shape (README): id, title, url, ageInDays, rating (company),
// employer.name, location.name, pay {min,max,currency,period}, description (HTML).

const DAYS_OLD: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };

export class GlassdoorScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Glassdoor';
  readonly actorId = 'valig~glassdoor-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && DAYS_OLD[params.datePostedFilter]) {
      input.daysOld = DAYS_OLD[params.datePostedFilter];
    }
    // NOTE: the actor's remoteWorkType=true filter returns ZERO results for
    // common keywords (verified live). Work-mode filtering is therefore left
    // to the factory's description-evidence guard (contradictsWanted), like
    // every other source without a reliable native work-mode filter.
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || id === undefined) return null;
    const now = new Date().toISOString();
    const salary = item.pay && typeof item.pay.min === 'number' && typeof item.pay.max === 'number'
      ? { text: `${item.pay.min}-${item.pay.max} ${item.pay.currency || ''}/${String(item.pay.period || 'ANNUAL').toLowerCase()}`, min: item.pay.min, max: item.pay.max }
      : undefined;

    const rating = typeof item.rating === 'number' ? `Company rating: ${item.rating.toFixed(1)}` : '';
    const rawDescription = extractDescription(item);
    const cleanedDescription = cleanDescription(rawDescription);
    const description = [cleanedDescription, rating].filter(Boolean).join('\n\n') || 'Description not available';

    return {
      id: `glassdoor-${id}`,
      title,
      company: item.employer?.name || 'Unknown Company',
      location: typeof item.location?.name === 'string' ? item.location.name : '',
      source: 'Glassdoor',
      description,
      url: item.url || `https://www.glassdoor.com/job-listing/j?jl=${id}`,
      ...(typeof item.ageInDays === 'number'
        ? { postedDate: new Date(Date.now() - item.ageInDays * 86400000).toISOString() }
        : {}),
      ...(typeof item.ageInDays === 'number'
        ? { postedDateParsed: new Date(Date.now() - item.ageInDays * 86400000).toISOString().slice(0, 10) }
        : {}),
      ...(salary?.text ? { salaryText: salary.text } : {}),
      ...(salary?.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary?.max !== undefined ? { salaryMax: salary.max } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
