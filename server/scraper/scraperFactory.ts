import { LinkedInScraper } from './linkedInScraper.js';
import { AdzunaScraper } from './adzunaScraper.js';
import { Job, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';

export class ScraperFactory {
  static async runScrape(params: ScraperParams): Promise<Job[]> {
    const config = loadConfig();
    const sources = params.sources || ['LinkedIn'];
    const allJobs: Job[] = [];

    const enrichedParams: ScraperParams = {
      ...params,
      adzunaAppId: params.adzunaAppId || config.scraper.adzunaAppId,
      adzunaApiKey: params.adzunaApiKey || config.scraper.adzunaApiKey,
    };

    for (const source of sources) {
      if (source === 'LinkedIn') {
        const linkedin = new LinkedInScraper();
        const jobs = await linkedin.scrape(enrichedParams);
        allJobs.push(...jobs);
      }
      if (source === 'Adzuna') {
        const adzuna = new AdzunaScraper();
        const jobs = await adzuna.scrape(enrichedParams);
        allJobs.push(...jobs);
      }
    }

    return allJobs;
  }
}
