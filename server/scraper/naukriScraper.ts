import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, extractDescription, normalizeIsoDate } from './apifyBase.js';

// Naukri (India) via valig/naukri-jobs-scraper (~$0.40 per 1K, Apify-powered).
// Output shape (README): id, title, url, company.name, salary {currency,
// minimum, maximum, label} (INR), experience.text, description.full (HTML),
// createdDate (epoch ms), locations [{label}], wfhType ('0'|'2'|'3'),
// employmentType, applyCount, viewCount.

const JOB_AGE: Record<string, string> = { '24h': '1', '7d': '7', '30d': '30' };
const WFH: Record<string, string[]> = { remote: ['2'], hybrid: ['3'], onsite: ['0'] };

export class NaukriScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Naukri';
  readonly actorId = 'valig~naukri-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = location;
    }
    if (params.jobType && params.jobType !== 'all' && WFH[params.jobType]) {
      input.wfhType = WFH[params.jobType];
    }
    if (params.datePostedFilter && params.datePostedFilter !== 'all' && JOB_AGE[params.datePostedFilter]) {
      input.jobAge = JOB_AGE[params.datePostedFilter];
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || !id) return null;
    const now = new Date().toISOString();
    const salary = item.salary && typeof item.salary.minimum === 'number' && typeof item.salary.maximum === 'number'
      ? { text: item.salary.label || `${item.salary.minimum}-${item.salary.maximum} INR`, min: item.salary.minimum, max: item.salary.maximum }
      : undefined;

    const location = Array.isArray(item.locations) ? item.locations.map((l: any) => l.label).filter(Boolean).join(', ') : '';

    const rawDescription = extractDescription(item) || String(item.description?.full || item.description?.short || '');
    const cleanedDescription = cleanDescription(rawDescription);
    const employmentType = String(item.employmentType || '');
    const wfhMap: Record<string, string> = { '0': 'On-site', '2': 'Remote', '3': 'Hybrid' };
    const jobType = [employmentType, wfhMap[String(item.wfhType)]].filter(Boolean).join(' · ') || undefined;

    return {
      id: `naukri-${id}`,
      title,
      company: item.company?.name || 'Unknown Company',
      location,
      source: 'Naukri',
      description: cleanedDescription || 'Description not available',
      url: item.url || `https://www.naukri.com/`,
      postedDate: normalizeIsoDate(item.createdDate),
      ...(typeof item.createdDate === 'number' ? { postedDateParsed: new Date(item.createdDate).toISOString().slice(0, 10) } : {}),
      ...(salary?.text ? { salaryText: salary.text } : {}),
      ...(salary?.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary?.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(typeof item.applyCount === 'number' ? { applicantCount: item.applyCount } : {}),
      ...(item.experience?.text ? { experienceLevel: String(item.experience.text) } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
