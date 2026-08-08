import { BaseScraper } from './baseScraper.js';
import { Job, ScraperParams } from '../../src/types.js';

/**
 * Cutshort — India's leading tech job platform.
 * Uses the free public JSON API (no auth, no key).
 * API only accepts predefined role slugs (e.g. remote-devops-jobs), not arbitrary keywords,
 * so user keywords are mapped to the closest matching slug.
 */

const ROLE_SLUGS: Record<string, string[]> = {
  'remote-devops-jobs': ['devops', 'sre', 'platform engineer', 'cloud engineer', 'infrastructure'],
  'remote-aws-jobs': ['aws', 'amazon web services'],
  'remote-python-jobs': ['python'],
  'remote-java-jobs': ['java', 'spring boot'],
  'remote-golang-jobs': ['golang', 'go developer', 'go lang'],
  'remote-nodejs-jobs': ['nodejs', 'node.js', 'node js', 'node developer', 'backend node'],
  'remote-reactjs-jobs': ['react', 'reactjs', 'react js', 'frontend react'],
  'remote-frontend-developer-jobs': ['frontend', 'front-end', 'ui developer', 'web developer'],
  'remote-web-development-jobs': ['web', 'website', 'wordpress'],
  'remote-wordpress-jobs': ['wordpress'],
  'remote-dotnet-jobs': ['dotnet', '.net', 'c#', 'csharp'],
  'remote-php-jobs': ['php', 'laravel'],
  'remote-laravel-jobs': ['laravel'],
  'remote-django-jobs': ['django'],
  'remote-ruby-and-rails-jobs': ['ruby', 'rails', 'ror'],
  'remote-javascript-jobs': ['javascript', 'js', 'typescript'],
  'remote-angular-jobs': ['angular'],
  'remote-flutter-jobs': ['flutter'],
  'remote-ios-developer-jobs': ['ios', 'swift', 'iphone'],
  'remote-android-developer-jobs': ['android', 'kotlin'],
  'remote-datascience-jobs': ['data science', 'datascience', 'ml engineer', 'machine learning engineer', 'data engineer'],
  'remote-machine-learning-ml-jobs': ['machine learning', 'ml', 'ai engineer', 'llm', 'ai'],
  'remote-data-analytics-jobs': ['data analytics', 'analytics', 'business intelligence', 'bi'],
  'remote-sql-jobs': ['sql', 'database', 'mysql', 'postgres'],
  'remote-cyber-security-jobs': ['security', 'cyber', 'infosec', 'penetration'],
  'remote-blockchain-jobs': ['blockchain', 'web3', 'crypto'],
  'remote-qa-software-testing-jobs': ['qa', 'testing', 'test engineer', 'quality assurance'],
  'remote-business-analysis-jobs': ['business analyst', 'ba'],
  'remote-powerbi-jobs': ['power bi', 'powerbi'],
  'remote-windows-azure-jobs': ['azure', 'windows'],
  'remote-startup-jobs': ['startup'],
  'remote-video-editing-jobs': ['video editing', 'video editor'],
};

// Software/backend/fullstack roles map to the closest slug; matching done client-side
const FALLBACK_SLUGS: Record<string, string> = {
  'software': 'remote-frontend-developer-jobs',
  'full stack': 'remote-frontend-developer-jobs',
  'fullstack': 'remote-frontend-developer-jobs',
  'backend': 'remote-nodejs-jobs',
  'back end': 'remote-nodejs-jobs',
  'developer': 'remote-frontend-developer-jobs',
  'engineer': 'remote-devops-jobs',
  'data': 'remote-datascience-jobs',
  'security': 'remote-cyber-security-jobs',
  'cyber': 'remote-cyber-security-jobs',
  'web': 'remote-web-development-jobs',
  'product': 'remote-business-analysis-jobs',
};

function resolveSlug(keywords: string): string {
  const kw = keywords.toLowerCase().trim();
  // Exact role term match first (e.g. 'devops' in 'DevOps Engineer')
  for (const [slug, terms] of Object.entries(ROLE_SLUGS)) {
    if (terms.some((t) => kw.includes(t))) return slug;
  }
  // Fallback by first word of keyword
  const firstWord = kw.split(/\s+/)[0];
  for (const [term, slug] of Object.entries(FALLBACK_SLUGS)) {
    if (firstWord.includes(term) || kw.includes(term)) return slug;
  }
  // Try direct slug format (e.g. user typed 'devops-jobs')
  const direct = kw.replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (direct.endsWith('-jobs') && direct.length < 40) return direct;
  // Fallback: devops (most common for this app)
  return 'remote-devops-jobs';
}

export class CutshortScraper extends BaseScraper {
  readonly source = 'Cutshort' as const;

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords.trim();
    const limit = params.maxJobsPerSource || 10;
    const jobs: Job[] = [];
    const seenIds = new Set<string>();

    const slug = resolveSlug(keywords);

    console.log('[Cutshort] Starting scrape, limit:', limit, 'keywords:', keywords, '-> slug:', slug);

    try {
      let page = 1;
      const maxPages = 3;

      while (jobs.length < limit && page <= maxPages) {
        const url = `https://cutshort.io/backend-api/webpage/jobs/${slug}?page=${page}`;

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          console.warn(`[Cutshort] API error: ${response.status} for slug ${slug}`);
          break;
        }

        const data = await response.json();
        const rawJobs: any[] = data?.data?.pageData?.jobs || [];
        if (rawJobs.length === 0) break;

        let foundOnPage = 0;
        for (const item of rawJobs) {
          if (jobs.length >= limit) break;

          const id = item._id;
          if (!id || seenIds.has(id)) continue;

          const title = item.headline || '';
          if (!title) continue;

          // Relevance check: keyword must appear in title, skills, or company
          const kw = keywords.toLowerCase();
          const searchable = `${title} ${(item.allSkills || []).join(' ')} ${item.companyDetails?.name || ''}`.toLowerCase();
          const terms = kw.split(/\s+/).filter((t) => t.length > 2);
          if (terms.length > 0 && !terms.some((t) => searchable.includes(t))) continue;

          const company = item.companyDetails?.name || 'Unknown';
          const salary = item.salaryRange;
          let salaryText: string | undefined;
          if (salary?.min && salary?.max) {
            const curr = salary.currency === 'INR' ? '₹' : salary.currency + ' ';
            salaryText = `${curr}${(salary.min / 100000).toFixed(1)}L - ${curr}${(salary.max / 100000).toFixed(1)}L / yr`;
          }

          const remoteType = item.remoteType || '';
          const titleLower = (title + ' ' + (item.locationsText || '')).toLowerCase();
          let workType = '';
          if (remoteType === 'remote_okay' || titleLower.includes('remote')) workType = 'Remote';
          else if (remoteType === 'remote_not_okay') workType = 'On-site';
          else if (titleLower.includes('hybrid')) workType = 'Hybrid';
          const jobTypeParts = [workType].filter(Boolean);

          // sanitizedComment still contains HTML — strip tags to plain text
          const cleanDescription = (item.sanitizedComment || '')
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

          seenIds.add(id);
          foundOnPage++;

          jobs.push({
            id: `cutshort-${id}`,
            title,
            company,
            location: item.locationsText || 'India',
            source: 'Cutshort',
            description: cleanDescription || 'Description not available',
            url: item.publicUrl || `https://cutshort.io/job/${title.replace(/\s+/g, '-')}`,
            postedDate: new Date().toISOString(),
            postedDateParsed: new Date().toISOString().split('T')[0],
            salaryText,
            jobType: jobTypeParts.length > 0 ? jobTypeParts.join(' · ') : 'Full-time',
            state: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        console.log(`[Cutshort] Page ${page}: ${foundOnPage} jobs (total so far: ${jobs.length})`);
        if (foundOnPage === 0) break;
        page++;
      }
    } catch (err: any) {
      console.warn('[Cutshort] Error:', err?.message || err);
    }

    console.log('[Cutshort] Returning', jobs.length, 'jobs');
    return jobs;
  }
}
