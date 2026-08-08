import { LinkedInScraper } from './linkedInScraper.js';
import { ApifyLinkedInScraper } from './apifyScraper.js';
import { isCrawlingAllowed } from './robotsGuard.js';
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
import { loadConfig } from '../config.js';
import { contradictsWanted } from './workMode.js';

export class ScraperFactory {
  // Populated by the last runScrape: sources skipped by the robots.txt guard.
  static lastSkippedSources: { source: string; reason: string }[] = [];
  static async runScrape(params: ScraperParams): Promise<Job[]> {
    const sources = params.sources || ['LinkedIn'];
    const allJobs: Job[] = [];
    ScraperFactory.lastSkippedSources = [];

    // Good-faith crawler check: resolve robots.txt once per domain (parallel,
    // cached 1h) and skip sources whose sites disallow crawling. Honor the
    // user's setting — robots.txt respect can be disabled in Settings.
    const SOURCE_DOMAINS: Record<string, string> = {
      LinkedIn: 'www.linkedin.com',
      Arbeitnow: 'arbeitnow.com',
      SimplyHired: 'www.simplyhired.com',
      Dice: 'www.dice.com',
      Reed: 'www.reed.co.uk',
      RemoteOK: 'remoteok.com',
      WeWorkRemotely: 'weworkremotely.com',
      MyCareersFuture: 'www.mycareersfuture.gov.sg',
      Cutshort: 'cutshort.io',
      Gupy: 'portal.gupy.io',
      JobsCh: 'jobs.ch',
      Daijob: 'daijob.com',
      MyJobMag: 'myjobmag.com',
    };
    let robotsAllowed = new Map<string, boolean>();
    const respectRobotsTxt = loadConfig().scraper.respectRobotsTxt !== false;
    if (respectRobotsTxt) {
      const domains = [...new Set(sources.map((s) => SOURCE_DOMAINS[s]).filter(Boolean))];
      const robotsResults = await Promise.all(
        domains.map(async (d) => [d, await isCrawlingAllowed(d)] as const)
      );
      robotsAllowed = new Map<string, boolean>(robotsResults);
    }

    for (const source of sources) {
      const domain = SOURCE_DOMAINS[source];
      if (respectRobotsTxt && domain && robotsAllowed.get(domain) === false) {
        console.warn(`[ScraperFactory] ${source}: skipped — robots.txt disallows crawling (${domain}/robots.txt)`);
        ScraperFactory.lastSkippedSources.push({ source, reason: `robots.txt disallows automated access (${domain})` });
        continue;
      }
      try {
        let jobs: Job[] = [];
        if (source === 'LinkedIn') {
          // Apify (optional, user-enabled) first — reliable + accurate work
          // mode; falls back to the built-in free scraper on any failure.
          const apify = new ApifyLinkedInScraper();
          const apifyConfig = loadConfig().apify;
          if (apifyConfig.enabled && apifyConfig.token?.trim()) {
            jobs = await apify.scrape(params);
            if (jobs.length === 0) {
              jobs = await new LinkedInScraper().scrape(params);
            }
          } else {
            jobs = await new LinkedInScraper().scrape(params);
          }
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

    // Work-mode guarantee across ALL sources: a remote request must never
    // ADD jobs explicitly labeled Hybrid/On-site (and vice versa). Applied
    // after every scraper so multi-source searches stay exact too.
    if (params.jobType && params.jobType !== 'all') {
      const wanted = params.jobType as 'remote' | 'hybrid' | 'onsite';
      const before = allJobs.length;
      const filtered = allJobs.filter((j) => !contradictsWanted(j.jobType, wanted));
      if (filtered.length !== before) {
        console.log(`[ScraperFactory] Work-mode guard: ${before - filtered.length} jobs dropped (contradict ${wanted} search)`);
      }
      return filtered;
    }

    return allJobs;
  }
}
