import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate, parseSalary } from './apifyBase.js';

// Indeed via valig/indeed-jobs-scraper (~$0.10 per 1K jobs, Apify-powered).
// Output shape (README): url, title, datePublished (ISO), location object,
// employer.name, baseSalary {min,max,unitOfWork,currencyCode},
// description {text, html}, jobTypes {code: label}.

const DATE_DAYS: Record<string, string> = { '24h': '1', '7d': '7', '30d': '14' };

// The Valig Indeed actor needs an ISO country code for location searches
// (it searches that country's Indeed subdomain). Map known cities of the
// markets this app serves; unmatched locations are left out (the actor
// then defaults to its own behavior, and keyword-only searches are fine).
const CITY_COUNTRIES: Record<string, string> = {
  // India
  bangalore: 'in', bengaluru: 'in', mumbai: 'in', delhi: 'in', 'new delhi': 'in', hyderabad: 'in',
  pune: 'in', chennai: 'in', kolkata: 'in', gurgaon: 'in', gurugram: 'in',
  noida: 'in', ahmedabad: 'in',
  // USA
  'new york': 'us', 'new york city': 'us', 'san francisco': 'us', 'los angeles': 'us',
  seattle: 'us', austin: 'us', chicago: 'us', boston: 'us', 'san jose': 'us',
  'washington dc': 'us', dallas: 'us',
  // UK
  london: 'gb', manchester: 'gb', birmingham: 'gb', edinburgh: 'gb', glasgow: 'gb',
  // Germany
  berlin: 'de', munich: 'de', hamburg: 'de', frankfurt: 'de', cologne: 'de', leipzig: 'de',
  // Rest of supported markets
  singapore: 'sg', tokyo: 'jp', 'sao paulo': 'br', zurich: 'ch', lagos: 'ng',
};

function locationCountry(location: string): string | undefined {
  const key = location.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(',')[0].trim();
  return CITY_COUNTRIES[key] ?? CITY_COUNTRIES[location.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
}

export class IndeedScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Indeed';
  readonly actorId = 'valig~indeed-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      title: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
      const country = locationCountry(location);
      if (country) {
        input.country = country;
      }
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && DATE_DAYS[params.datePostedFilter]) {
      input.datePosted = DATE_DAYS[params.datePostedFilter];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.key || item.refNum;
    if (!title || !id) return null;
    const now = new Date().toISOString();
    const salary = item.baseSalary
      ? {
          text: `${item.baseSalary.min}-${item.baseSalary.max} ${item.baseSalary.currencyCode || ''}/${String(item.baseSalary.unitOfWork || 'YEAR').toLowerCase()}`,
          min: typeof item.baseSalary.min === 'number' ? item.baseSalary.min : undefined,
          max: typeof item.baseSalary.max === 'number' ? item.baseSalary.max : undefined,
        }
      : parseSalary(undefined);

    const loc = item.location || {};
    const location = [loc.city, loc.admin1Code, loc.countryName].filter(Boolean).join(', ');

    const jobTypeValues = Object.values(item.jobTypes || {}) as string[];
    const jobType = jobTypeValues.length > 0 ? jobTypeValues.join(', ') : undefined;

    const rawDescription = extractDescription(item) || String(item.description?.text || '');
    const cleanedDescription = cleanDescription(rawDescription);

    return {
      id: `indeed-${id}`,
      title,
      company: item.employer?.name || 'Unknown Company',
      location,
      source: 'Indeed',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.indeed.com/viewjob?jk=${id}`,
      postedDate: normalizeIsoDate(item.datePublished),
      ...(item.datePublished ? { postedDateParsed: String(item.datePublished).slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(item.employer?.companyPageUrl ? { companyUrl: String(item.employer.companyPageUrl) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
