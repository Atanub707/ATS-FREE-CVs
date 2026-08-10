import { Job, JobSource, ScraperParams } from '../../src/types.js';
import { ApifyBaseScraper, cleanDescription, normalizeIsoDate } from './apifyBase.js';

// Upwork (freelance) via valig/upwork-jobs-scraper (~$0.20 per 1K,
// Apify-powered). Output shape (README): id, title, url, jobType
// ("FIXED"|"HOURLY"), hourlyBudgetMin/Max, fixedPriceAmount {amount},
// totalApplicants, skills [{prefLabel}], client {country, totalSpent},
// description (plain text), publishTime (ISO), createTime.

export class UpworkScraper extends ApifyBaseScraper {
  readonly source: JobSource = 'Upwork';
  readonly actorId = 'valig~upwork-jobs-scraper';

  protected buildInput(params: ScraperParams): Record<string, any> {
    const input: Record<string, any> = {
      keywords: params.keywords.trim(),
      limit: Math.min(params.maxJobsPerSource || 25, 1000),
    };
    const location = params.location?.trim() || '';
    if (location && !/^(remote|anywhere|worldwide|open to remote)$/i.test(location)) {
      input.location = [location]; // Upwork's location filter is client-country array
    }
    return input;
  }

  protected mapItem(item: any): Job | null {
    const title = item.title;
    const id = item.id;
    if (!title || !id) return null;
    const now = new Date().toISOString();

    let salary: { text?: string; min?: number; max?: number } = {};
    if (String(item.jobType) === 'FIXED' && item.fixedPriceAmount?.amount != null) {
      const amount = parseFloat(String(item.fixedPriceAmount.amount));
      if (!isNaN(amount)) {
        salary = { text: `Fixed price: $${amount}`, min: amount, max: amount };
      }
    } else if (String(item.jobType) === 'HOURLY' && (item.hourlyBudgetMin != null || item.hourlyBudgetMax != null)) {
      const min = item.hourlyBudgetMin != null ? parseFloat(String(item.hourlyBudgetMin)) : NaN;
      const max = item.hourlyBudgetMax != null ? parseFloat(String(item.hourlyBudgetMax)) : NaN;
      salary = {
        text: `Hourly: $${isNaN(min) ? '?' : min}-$${isNaN(max) ? '?' : max}`,
        min: isNaN(min) ? undefined : min,
        max: isNaN(max) ? undefined : max,
      };
    }

    const jobType = String(item.jobType) === 'FIXED' ? 'Fixed-price' : String(item.jobType) === 'HOURLY' ? 'Hourly' : undefined;
    const location = item.client?.country ? `Remote · ${item.client.country}` : 'Remote';
    const contractorTier = typeof item.contractorTier === 'string'
      ? String(item.contractorTier).replace(/([a-z])([A-Z])/g, '$1 $2') // 'IntermediateLevel' → 'Intermediate Level'
      : undefined;

    return {
      id: `upwork-${id}`,
      title,
      company: 'Upwork Client',
      location,
      source: 'Upwork',
      description: cleanDescription(String(item.description || '')) || 'Description not available',
      url: item.url || `https://www.upwork.com/jobs/~${item.cipherText || ''}`,
      postedDate: normalizeIsoDate(item.publishTime || item.createTime),
      ...(item.publishTime || item.createTime ? { postedDateParsed: String(item.publishTime || item.createTime).slice(0, 10) } : {}),
      ...(salary.text ? { salaryText: salary.text } : {}),
      ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
      ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
      ...(jobType ? { jobType } : {}),
      ...(typeof item.totalApplicants === 'number' ? { applicantCount: item.totalApplicants } : {}),
      ...(contractorTier ? { experienceLevel: contractorTier } : {}),
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  }
}
