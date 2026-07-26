import { LinkedInScraper } from './linkedInScraper.js';
import { ArbeitnowScraper } from './arbeitnowScraper.js';
import { SimplyHiredScraper } from './simplyHiredScraper.js';
import { DiceScraper } from './diceScraper.js';
import { ReedScraper } from './reedScraper.js';
import { CompanyPortalScraper } from './companyPortalScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class ScraperFactory {
  static async runScrape(params: ScraperParams): Promise<Job[]> {
    const sources = params.sources || ['LinkedIn'];
    const allJobs: Job[] = [];

    for (const source of sources) {
      if (source === 'LinkedIn') {
        const linkedin = new LinkedInScraper();
        const jobs = await linkedin.scrape(params);
        allJobs.push(...jobs);
      }
      if (source === 'Arbeitnow') {
        const arbeitnow = new ArbeitnowScraper();
        const jobs = await arbeitnow.scrape(params);
        allJobs.push(...jobs);
      }
      if (source === 'SimplyHired') {
        const sh = new SimplyHiredScraper();
        const jobs = await sh.scrape(params);
        allJobs.push(...jobs);
      }
      if (source === 'Dice') {
        const dice = new DiceScraper();
        const jobs = await dice.scrape(params);
        allJobs.push(...jobs);
      }
      if (source === 'Reed') {
        const reed = new ReedScraper();
        const jobs = await reed.scrape(params);
        allJobs.push(...jobs);
      }
      if (source === 'Greenhouse' || source === 'Lever') {
        const cp = new CompanyPortalScraper();
        const jobs = await cp.scrape(params);
        allJobs.push(...jobs);
      }
    }

    return allJobs;
  }
}
