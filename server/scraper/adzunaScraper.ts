import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

const ADZUNA_COUNTRIES: Record<string, string> = {
  'us': 'United States',
  'gb': 'United Kingdom',
  'in': 'India',
  'ca': 'Canada',
  'au': 'Australia',
  'de': 'Germany',
  'fr': 'France',
  'nl': 'Netherlands',
  'br': 'Brazil',
  'pl': 'Poland',
  'ru': 'Russia',
  'za': 'South Africa',
  'ae': 'United Arab Emirates',
  'at': 'Austria',
  'be': 'Belgium',
  'ch': 'Switzerland',
  'cz': 'Czech Republic',
  'dk': 'Denmark',
  'es': 'Spain',
  'ie': 'Ireland',
  'it': 'Italy',
  'lu': 'Luxembourg',
  'no': 'Norway',
  'nz': 'New Zealand',
  'se': 'Sweden',
};

function detectCountry(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('india') || loc.includes('mumbai') || loc.includes('bangalore') || loc.includes('delhi') || loc.includes('kolkata') || loc.includes('chennai') || loc.includes('hyderabad') || loc.includes('pune')) return 'in';
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich') || loc.includes('hamburg') || loc.includes('frankfurt')) return 'de';
  if (loc.includes('uk') || loc.includes('london') || loc.includes('manchester') || loc.includes('birmingham') || loc.includes('united kingdom')) return 'gb';
  if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') || loc.includes('montreal')) return 'ca';
  if (loc.includes('australia') || loc.includes('sydney') || loc.includes('melbourne')) return 'au';
  if (loc.includes('france') || loc.includes('paris')) return 'fr';
  if (loc.includes('netherlands') || loc.includes('amsterdam')) return 'nl';
  if (loc.includes('brazil') || loc.includes('sao paulo')) return 'br';
  if (loc.includes('uae') || loc.includes('dubai') || loc.includes('united arab emirates')) return 'ae';
  if (loc.includes('singapore')) return 'sg';
  return 'gb'; // default to UK
}

export class AdzunaScraper extends BaseScraper {
  readonly source = 'Adzuna' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const location = params.location?.trim() || 'Remote';
    const limit = params.maxJobsPerSource || 10;

    const appId = params.adzunaAppId || '';
    const apiKey = params.adzunaApiKey || '';

    if (!appId || !apiKey) {
      console.warn('Adzuna API credentials not configured. Skipping Adzuna scrape.');
      return [];
    }

    const country = detectCountry(location);
    const jobs: Job[] = [];
    const seenUrls = new Set<string>();

    const maxPages = Math.min(5, Math.ceil(limit / 20));

    for (let page = 1; page <= maxPages && jobs.length < limit; page++) {
      await this.delay(3000 + Math.random() * 5000);

      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${appId}&app_key=${apiKey}&results_per_page=20&what=${encodeURIComponent(keywords)}&where=${encodeURIComponent(location)}&content-type=application/json&sort_by=date`;

      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.warn(`Adzuna API error: ${response.status}`);
          break;
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) break;

        for (const ad of results) {
          if (jobs.length >= limit) break;

          const redirectUrl = ad.redirect_url || '';
          if (!redirectUrl || seenUrls.has(redirectUrl)) continue;
          seenUrls.add(redirectUrl);

          const title = ad.title || 'Unknown Title';
          const company = ad.company?.display_name || 'Unknown Company';
          const jobLoc = ad.location?.display_name || location;
          const description = ad.description || '';
          const salaryMin = ad.salary_min;
          const salaryMax = ad.salary_max;
          const postedDate = ad.created || new Date().toISOString();

          let salaryText: string | undefined;
          if (salaryMin || salaryMax) {
            const min = salaryMin ? `$${Number(salaryMin).toLocaleString()}` : '';
            const max = salaryMax ? `$${Number(salaryMax).toLocaleString()}` : '';
            salaryText = min && max ? `${min} - ${max} / year` : min || max || undefined;
          }

          jobs.push({
            id: `adzuna-${ad.id || Date.now()}-${jobs.length}`,
            title,
            company,
            location: jobLoc,
            source: 'Adzuna',
            description,
            url: redirectUrl,
            postedDate: new Date(postedDate).toISOString(),
            postedDateParsed: new Date(postedDate).toISOString().split('T')[0],
            salaryMin: salaryMin ? Number(salaryMin) : undefined,
            salaryMax: salaryMax ? Number(salaryMax) : undefined,
            salaryText,
            jobType: ad.contract_type === 'permanent' ? 'Full-time' : ad.contract_type || 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`Adzuna fetch error on page ${page}:`, err?.message || err);
        break;
      }
    }

    return jobs;
  }
}
