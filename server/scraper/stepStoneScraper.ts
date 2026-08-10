import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, normalizeIsoDate } from './apifyBase.js';

// StepStone (Germany) via valig/stepstone-jobs-scraper (~$0.40 per 1K,
// Apify-powered). Output shape (README): id, title, url, datePosted (ISO+tz),
// workFromHome ('1' partial/'2' full), location.location (string),
// company.name, salary {min,max,period,currencyIso} (EUR), textSections
// [{name, content HTML}], textSnippet.

const AG: Record<string, string> = { '24h': 'age_1', '7d': 'age_7' };
const WFH: Record<string, string> = { remote: '2', hybrid: '1' };

export class StepStoneScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'StepStone';
  readonly actorId = 'valig~stepstone-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && AG[params.datePostedFilter]) {
      input.ag = AG[params.datePostedFilter];
    }
    if (params.jobType && params.jobType !== 'all' && WFH[params.jobType]) {
      input.wfh = WFH[params.jobType];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || id === undefined) return null;
    const now = new Date().toISOString();
    const salary = item.salary && typeof item.salary.min === 'number' && typeof item.salary.max === 'number'
      ? { text: `${item.salary.min}-${item.salary.max} ${item.salary.currencyIso || 'EUR'}/${String(item.salary.period || 'year')}`, min: item.salary.min, max: item.salary.max }
      : undefined;

    const sections = Array.isArray(item.textSections) ? item.textSections.map((s: any) => s?.content || '').filter(Boolean) : [];
    const rawDescription = [String(item.textSnippet || ''), ...sections].join('\n\n');
    const cleanedDescription = cleanDescription(rawDescription);
    const wfhMap: Record<string, string> = { '1': 'Hybrid', '2': 'Remote' };
    const jobType = wfhMap[String(item.workFromHome)] || undefined;

    return {
      id: `stepstone-${id}`,
      title,
      company: item.company?.name || 'Unknown Company',
      location: typeof item.location?.location === 'string' ? item.location.location : '',
      source: 'StepStone',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.stepstone.de/stellenangebote--${id}.html`,
      postedDate: normalizeIsoDate(item.datePosted),
      ...(item.datePosted ? { postedDateParsed: String(item.datePosted).slice(0, 10) } : {}),
      ...(salary?.text ? { salaryText: salary.text } : {}),
      ...(salary?.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary?.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(item.company?.url ? { companyUrl: String(item.company.url) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
