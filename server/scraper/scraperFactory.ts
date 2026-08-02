import { LinkedInScraper } from './linkedInScraper.js';
import { ArbeitnowScraper } from './arbeitnowScraper.js';
import { SimplyHiredScraper } from './simplyHiredScraper.js';
import { DiceScraper } from './diceScraper.js';
import { ReedScraper } from './reedScraper.js';
import { RemoteOkScraper } from './remoteOkScraper.js';
import { WeWorkRemotelyScraper } from './weWorkRemotelyScraper.js';
import { MyCareersFutureScraper } from './myCareersFutureScraper.js';
import { CutshortScraper } from './cutshortScraper.js';
import { GupyScraper } from './gupyScraper.js';
import { JobsChScraper } from './jobsChScraper.js';
import { DaijobScraper } from './daijobScraper.js';
import { MyJobMagScraper } from './myJobMagScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

export class ScraperFactory {
  static async runScrape(params: ScraperParams): Promise<Job[]> {
    const sources = params.sources || ['LinkedIn'];
    const allJobs: Job[] = [];

    for (const source of sources) {
      try {
        let jobs: Job[] = [];
        if (source === 'LinkedIn') {
          jobs = await new LinkedInScraper().scrape(params);
        } else if (source === 'Arbeitnow') {
          jobs = await new ArbeitnowScraper().scrape(params);
        } else if (source === 'SimplyHired') {
          jobs = await new SimplyHiredScraper().scrape(params);
        } else if (source === 'Dice') {
          jobs = await new DiceScraper().scrape(params);
        } else if (source === 'Reed') {
          jobs = await new ReedScraper().scrape(params);
        } else if (source === 'RemoteOK') {
          jobs = await new RemoteOkScraper().scrape(params);
        } else if (source === 'WeWorkRemotely') {
          jobs = await new WeWorkRemotelyScraper().scrape(params);
        } else if (source === 'MyCareersFuture') {
          jobs = await new MyCareersFutureScraper().scrape(params);
        } else if (source === 'Cutshort') {
          jobs = await new CutshortScraper().scrape(params);
        } else if (source === 'Gupy') {
          jobs = await new GupyScraper().scrape(params);
        } else if (source === 'JobsCh') {
          jobs = await new JobsChScraper().scrape(params);
        } else if (source === 'Daijob') {
          jobs = await new DaijobScraper().scrape(params);
        } else if (source === 'MyJobMag') {
          jobs = await new MyJobMagScraper().scrape(params);
        } else {
          console.warn(`[ScraperFactory] Unknown source: ${source}, skipping`);
          continue;
        }
        allJobs.push(...jobs);
        console.log(`[ScraperFactory] ${source}: ${jobs.length} jobs`);
      } catch (err: any) {
        // Isolate failures: one broken source must not abort the rest
        console.warn(`[ScraperFactory] ${source} failed: ${err?.message || err}`);
      }
    }

    return allJobs;
  }
}
