import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';
import * as cheerio from 'cheerio';

export class LinkedInScraper extends BaseScraper {
  readonly source = 'LinkedIn' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const location = params.location?.trim() || 'Remote';
    const limit = params.maxJobsPerSource || 15;
    const filter = params.datePostedFilter || 'all';

    let tprParam = '';
    let maxAgeMs = Number.MAX_SAFE_INTEGER;
    let fwtParam = '&f_WT=2';
    const jt = params.jobType || 'remote';
    if (jt === 'remote') fwtParam = '&f_WT=2';
    else if (jt === 'onsite') fwtParam = '&f_WT=1';
    else if (jt === 'hybrid') fwtParam = '&f_WT=3';
    else fwtParam = '';

    if (filter === '24h') {
      tprParam = '&f_TPR=r86400';
      maxAgeMs = 24 * 60 * 60 * 1000;
    } else if (filter === '7d') {
      tprParam = '&f_TPR=r604800';
      maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    } else if (filter === '30d') {
      tprParam = '&f_TPR=r2592000';
      maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    }

    const scrapedJobs: Job[] = [];
    const seenJobIds = new Set<string>();
    const now = new Date();

    const fetchJobs = async (tpr: string) => {
      let start = 0;
      let pageAttempts = 0;
      const maxAttempts = Math.min(15, Math.ceil(limit / 5) + 4);

      while (scrapedJobs.length < limit && start < 350 && pageAttempts < maxAttempts) {
        pageAttempts++;
        const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
          keywords
        )}&location=${encodeURIComponent(location)}${fwtParam}${tpr}${params.under10Applicants ? '&f_AL=true' : ''}&start=${start}`;

        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) break;

        const html = await response.text();
        const $ = cheerio.load(html);

        const cardElements = $('div.base-search-card, li div.job-search-card, div.base-card').toArray();
        if (cardElements.length === 0) break;

        for (let i = 0; i < cardElements.length && scrapedJobs.length < limit; i++) {
          const el = cardElements[i];
          const $el = $(el);

          const rawTitle =
            $el.find('.base-search-card__title').text() ||
            $el.find('.job-search-card__title').text() ||
            '';
          const titleLines = rawTitle.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
          const title = titleLines[0] ? titleLines[0].replace(/\s+/g, ' ') : '';

          const rawCompany =
            $el.find('.base-search-card__subtitle').text() ||
            $el.find('.job-search-card__subtitle').text() ||
            '';
          const companyLines = rawCompany.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
          const company = companyLines[0] ? companyLines[0].replace(/\s+/g, ' ') : '';

          const rawLoc =
            $el.find('.job-search-card__location').text() ||
            $el.find('.base-search-card__metadata').text() ||
            '';
          const locLines = rawLoc.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
          const jobLoc = locLines[0] ? locLines[0].replace(/\s+/g, ' ') : location;

          let rawLink =
            $el.find('a.base-card__full-link').attr('href') ||
            $el.find('a').attr('href') ||
            '';

          try {
            rawLink = decodeURIComponent(rawLink);
          } catch {
            // ignore decode error
          }
          rawLink = rawLink.replace(/[\r\n\t]+/g, '').trim();

          const urn = $el.attr('data-entity-urn') || $el.attr('data-job-id') || '';
          const urnMatch = urn.match(/\d+/);
          const linkMatch =
            rawLink.match(/view\/[^/?#]+-(\d+)/) ||
            rawLink.match(/-(\d{8,})/) ||
            rawLink.match(/(\d{7,})/);

          let jobId = '';
          if (urnMatch && urnMatch[0] && urnMatch[0] !== 'undefined') {
            jobId = urnMatch[0];
          } else if (linkMatch && linkMatch[1] && linkMatch[1] !== 'undefined') {
            jobId = linkMatch[1];
          }

          if (!jobId || seenJobIds.has(jobId)) {
            continue;
          }
          seenJobIds.add(jobId);

          const cleanLink = `https://www.linkedin.com/jobs/view/${jobId}`;

          const timeText = $el.find('time').text().trim().toLowerCase();
          const dateAttr = $el.find('time').attr('datetime');

          // LinkedIn's guest API returns BOTH a relative label ("13 hours
          // ago") and a date-only datetime attribute ("2026-08-04"). The
          // date-only attr parses to midnight UTC, which would make every
          // job look the same age. Parse the relative text first — it is
          // the accurate posting time.
          let postedDateObj = new Date();
          const relMatch = timeText.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/);
          if (relMatch) {
            const n = parseInt(relMatch[1], 10);
            const unit = relMatch[2];
            if (unit === 'minute') postedDateObj = new Date(now.getTime() - n * 60 * 1000);
            else if (unit === 'hour') postedDateObj = new Date(now.getTime() - n * 60 * 60 * 1000);
            else if (unit === 'day') postedDateObj = new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
            else if (unit === 'week') postedDateObj = new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
            else postedDateObj = new Date(now.getTime() - n * 30 * 24 * 60 * 60 * 1000);
          } else if (timeText.includes('just now') || timeText.includes('minutes')) {
            postedDateObj = new Date(now.getTime() - 5 * 60 * 1000);
          } else if (timeText.includes('month')) {
            const numMatch = timeText.match(/\d+/);
            const months = numMatch ? parseInt(numMatch[0], 10) : 1;
            postedDateObj = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
          } else if (timeText.includes('year')) {
            const numMatch = timeText.match(/\d+/);
            const years = numMatch ? parseInt(numMatch[0], 10) : 1;
            postedDateObj = new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
          } else if (dateAttr && dateAttr.length > 10) {
            // Full ISO timestamp (rare) — parse precisely
            const parsed = new Date(dateAttr);
            if (!isNaN(parsed.getTime())) postedDateObj = parsed;
          } else if (dateAttr) {
            // Date-only attr: use it but at the end of that day, not midnight,
            // so "today" postings don't look older than they are.
            const parsed = new Date(dateAttr + 'T23:59:59');
            if (!isNaN(parsed.getTime()) && parsed <= now) postedDateObj = parsed;
          } else {
            // No time info at all — stagger fallback so jobs don't all
            // share one fabricated timestamp.
            postedDateObj = new Date(now.getTime() - (scrapedJobs.length + 1) * 3 * 60 * 60 * 1000);
          }

          // Deterministic date filter: LinkedIn's f_TPR param is unreliable
          // on the guest API, so enforce the window on the parsed date.
          if (maxAgeMs < Number.MAX_SAFE_INTEGER && (now.getTime() - postedDateObj.getTime()) > maxAgeMs) {
            continue;
          }

          if (title && company) {
            scrapedJobs.push({
              id: `linkedin-${jobId}`,
              title,
              company,
              location: jobLoc,
              source: 'LinkedIn',
              description: '',
              url: cleanLink,
              postedDate: postedDateObj.toISOString(),
              postedDateParsed: postedDateObj.toISOString().split('T')[0],
              jobType: 'Full-time · Remote',
              state: 'pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        start += cardElements.length;
      }
    };

    try {
      await fetchJobs(tprParam);
    } catch (err) {
      console.warn('LinkedIn live fetch notice:', err);
    }

    // Fetch real descriptions and salaries from each job detail page
    let detailFetched = 0;
    for (const job of scrapedJobs) {
      const jobId = job.id.replace('linkedin-', '');
      try {
        await this.delay(800 + Math.random() * 1200);
        const detail = await this.fetchJobDetail(jobId);
        job.description = detail.description || 'Description not available';
        if (detail.workType) {
          job.jobType = `Full-time · ${detail.workType}`;
        } else if (detail.description) {
          const d = detail.description.toLowerCase();
          if (d.includes('hybrid') && !d.includes('no hybrid') && !d.includes('not hybrid')) {
            job.jobType = 'Full-time · Hybrid';
          } else if ((d.includes('on-site') || d.includes('onsite')) && !d.includes('no on-site')) {
            job.jobType = 'Full-time · On-site';
          }
        }
        if (detail.salaryText) {
          job.salaryText = detail.salaryText;
          job.salaryMin = detail.salaryMin;
          job.salaryMax = detail.salaryMax;
        } else {
          job.salaryText = 'Salary not mentioned';
        }
        if (detail.applicantCount !== undefined) {
          job.applicantCount = detail.applicantCount;
        }
        if (detail.lowCompetition) {
          job.lowCompetition = true;
        }
        detailFetched++;
        console.log(`  [${detailFetched}/${scrapedJobs.length}] Fetched details for: ${job.title} @ ${job.company}`);
      } catch (err: any) {
        job.description = 'Description not available';
        job.salaryText = 'Salary not mentioned';
        console.warn(`  [${detailFetched + 1}/${scrapedJobs.length}] Failed to fetch details for job ${jobId}: ${err?.message || 'Unknown error'}`);
      }
    }

    const postFilter = params.jobType === 'remote' || !params.jobType;
    // Post-filter: remove non-matching work type jobs when remote selected
    const remoteJobs = postFilter
      ? scrapedJobs.filter((j) => !j.jobType.includes('Hybrid') && !j.jobType.includes('On-site'))
      : scrapedJobs;

    console.log(`[LinkedIn] Scraped ${scrapedJobs.length}, filtered to ${remoteJobs.length} ${jt} jobs`);
    return remoteJobs;
  }

  private async fetchJobDetail(jobId: string): Promise<{
    description: string;
    workType?: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryText?: string;
    applicantCount?: number;
    lowCompetition?: boolean;
  }> {
    const url = `https://www.linkedin.com/jobs/view/${jobId}`;
    const response = await fetch(url, {
      headers: this.getStealthHeaders(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for job detail page`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Applicant count from the "N applicants" metadata caption.
    // LinkedIn shows "Be among the first N applicants" for low-competition
    // jobs — that means FEWER than N applied, so it's a low-competition
    // signal, not an exact count. Parse both forms.
    let applicantCount: number | undefined;
    let lowCompetition = false;
    const applicantCaption = $('.num-applicants__caption').first().text().trim();
    if (applicantCaption) {
      const lowMatch = applicantCaption.match(/be among the first\s+([\d,.]+)\s+applicants?/i);
      const numMatch = applicantCaption.match(/([\d,.]+)\s*applicants?/i);
      if (lowMatch) {
        lowCompetition = true;
        const parsed = parseInt(lowMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed)) applicantCount = parsed;
      } else if (numMatch) {
        const parsed = parseInt(numMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsed)) applicantCount = parsed;
      }
    }

    // Try JSON-LD first (most reliable structured data)
    const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
    for (const script of jsonLdScripts) {
      try {
        const rawJson = $(script).text();
        const data = JSON.parse(rawJson);
        const posting = data['@type'] === 'JobPosting' ? data : null;

        if (posting) {
          const description = posting.description || '';
          const cleanDescription = description
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<li[^>]*>/gi, '\n- ')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n[ \t]+/g, '\n')
          .replace(/^[ \t]*Show more[ \t]*$/gim, '')
          .replace(/^[ \t]*Show less[ \t]*$/gim, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

          let salaryMin: number | undefined;
          let salaryMax: number | undefined;
          let salaryText: string | undefined;

          const salary = posting.baseSalary || posting.estimatedSalary;
          if (salary?.value) {
            const val = salary.value;
            const minVal = val.minValue || val.value;
            const maxVal = val.maxValue || val.value;
            if (minVal !== undefined && maxVal !== undefined) {
              salaryMin = Number(minVal);
              salaryMax = Number(maxVal);
              const currency = salary.currency || 'USD';
              salaryText = `${currency === 'USD' ? '$' : currency + ' '}${Number(salaryMin).toLocaleString()} - ${currency === 'USD' ? '$' : ''}${Number(salaryMax).toLocaleString()} / year`;
            }
          }

          let workType: string | undefined;
          const empType = posting.employmentType || '';
          const locType = (posting.jobLocationType || '').toLowerCase();
          if (locType.includes('telecommute') || locType.includes('remote')) {
            workType = 'Remote';
          } else if (empType.toLowerCase().includes('remote')) {
            workType = 'Remote';
          }

          return {
            description: cleanDescription || 'Description not available',
            workType,
            salaryMin,
            salaryMax,
            salaryText,
            applicantCount,
            lowCompetition,
          };
        }
      } catch {
        // Skip invalid JSON
      }
    }

    // Fallback: extract description from HTML elements
    const descSelectors = [
      '.show-more-less-html',
      '.description',
      'article.description',
      'div[data-description]',
      '.jobs-description',
    ];
    for (const selector of descSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        const rawHtml = el.html() || '';
        const text = rawHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/h[1-6]>/gi, '\n')
          .replace(/<li[^>]*>/gi, '\n- ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n[ \t]+/g, '\n')
          .trim();
        if (text) {
          return {
            description: text,
            applicantCount,
            lowCompetition,
          };
        }
      }
    }

    // Try meta description tag as last resort
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) {
      return {
        description: metaDesc.trim(),
        applicantCount,
        lowCompetition,
      };
    }

    throw new Error('No description found on job detail page');
  }
}
