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
        )}&location=${encodeURIComponent(location)}&f_WT=2${tpr}${params.under10Applicants ? '&f_AL=true' : ''}&start=${start}`;

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

          let postedDateObj = new Date();
          if (dateAttr) {
            const parsed = new Date(dateAttr);
            if (!isNaN(parsed.getTime())) {
              postedDateObj = parsed;
            }
          } else if (timeText) {
            if (timeText.includes('hour') || timeText.includes('minute') || timeText.includes('just now')) {
              postedDateObj = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            } else if (timeText.includes('day')) {
              const numMatch = timeText.match(/\d+/);
              const days = numMatch ? parseInt(numMatch[0], 10) : 1;
              postedDateObj = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            }
          } else {
            postedDateObj = new Date(now.getTime() - (scrapedJobs.length + 1) * 3 * 60 * 60 * 1000);
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
        if (detail.salaryText) {
          job.salaryText = detail.salaryText;
          job.salaryMin = detail.salaryMin;
          job.salaryMax = detail.salaryMax;
        } else {
          job.salaryText = 'Salary not mentioned';
        }
        detailFetched++;
        console.log(`  [${detailFetched}/${scrapedJobs.length}] Fetched details for: ${job.title} @ ${job.company}`);
      } catch (err: any) {
        job.description = 'Description not available';
        job.salaryText = 'Salary not mentioned';
        console.warn(`  [${detailFetched + 1}/${scrapedJobs.length}] Failed to fetch details for job ${jobId}: ${err?.message || 'Unknown error'}`);
      }
    }

    return scrapedJobs;
  }

  private async fetchJobDetail(jobId: string): Promise<{
    description: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryText?: string;
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

          return {
            description: cleanDescription || 'Description not available',
            salaryMin,
            salaryMax,
            salaryText,
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
          };
        }
      }
    }

    // Try meta description tag as last resort
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) {
      return {
        description: metaDesc.trim(),
      };
    }

    throw new Error('No description found on job detail page');
  }
}
