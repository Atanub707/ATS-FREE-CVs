import { LinkedInScraper } from './linkedInScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class ScraperFactory {
  static async runScrape(params: ScraperParams): Promise<Job[]> {
    const linkedin = new LinkedInScraper();
    return await linkedin.scrape(params);
  }
}
