import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LinkedInPostsScraper, discoverPostUrls, setScraperPause, isJobPosting } from '../../server/scraper/linkedInPostsScraper';

const realFetch = globalThis.fetch;

const GNRSS_ITEM = (title: string) =>
  `<rss><channel><item><title>${title}</title><link>https://news.google.com/rss/articles/token1</link><pubDate>${new Date().toISOString()}</pubDate></item></channel></rss>`;

function mockConfig(overrides: Record<string, any> = {}) {
  vi.mocked(loadConfig).mockReturnValue({
    apify: { token: 'apify_api_test', enabled: true, referralUrl: '' },
    linkedin: { liAt: '' },
    ...overrides,
  } as any);
}

vi.mock('../../server/config', () => ({
  loadConfig: vi.fn(),
}));

import { loadConfig } from '../../server/config';

const FAKE_ITEMS = [
  {
    linkedinUrl: 'https://www.linkedin.com/posts/activity-7123456789012345678-ABCD',
    content: 'We are hiring a #DevSecOps engineer! Join our team. #Kubernetes #CICD apply here',
    author: { name: 'ACME Recruiting', linkedinUrl: 'https://www.linkedin.com/in/acme' },
    postedAt: { timestamp: Date.now() - 2 * 3600000, date: new Date(Date.now() - 2 * 3600000).toISOString() },
    job: { title: 'DevSecOps Engineer', linkedinUrl: 'https://www.linkedin.com/jobs/view/123', location: 'Remote', subtitle: 'Job by ACME Recruiting' },
  },
  {
    linkedinUrl: 'https://www.linkedin.com/posts/activity-7123456789012345678-EFGH',
    content: 'Opening for a #CloudSecurity engineer with AWS + Terraform. Remote friendly.',
    author: { name: 'Beta Security' },
    postedAt: { timestamp: Date.now() - 5 * 3600000 },
  },
];

describe('LinkedInPostsScraper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('uses the Apify actor path when the Apify engine is selected', async () => {
    mockConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => FAKE_ITEMS,
    } as any);

    const jobs = await new LinkedInPostsScraper().scrape({
      keywords: 'DevSecOps',
      location: '',
      sources: [],
      datePostedFilter: '24h',
      jobType: 'all',
      maxJobsPerSource: 5,
      engine: 'apify',
    } as any);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toContain('We are hiring');
    expect(jobs[0].company).toBe('ACME Recruiting');
    expect(jobs[0].hashtags).toContain('#DevSecOps');
    expect(jobs[0].applyUrl).toBe('https://www.linkedin.com/jobs/view/123');
    expect(jobs[0].url).toContain('linkedin.com/posts');
    expect(jobs[0].location).toBe('Remote');
    expect(jobs[0].source).toBe('LinkedInPosts');
    // Actor URL (tilde format) + verified input schema:
    const call = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(call).toContain('run-sync-get-dataset-items');
    expect(call).toContain('harvestapi~linkedin-post-search');
    const body = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(Array.isArray(body.searchQueries)).toBe(true);
    expect(body.searchQueries[0]).toBe('DevSecOps');
  });

  it('does NOT call the Apify actor when the free engine is selected (default)', async () => {
    mockConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html></html>',
    } as any);

    const jobs = await new LinkedInPostsScraper().scrape({
      keywords: 'DevSecOps',
      location: '',
      sources: [],
      datePostedFilter: '24h',
      jobType: 'all',
      maxJobsPerSource: 5,
    } as any);

    expect(jobs).toEqual([]);
    const calls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('api.apify.com'))).toBe(false);
  }, 30000);

  it('filters out non-job posts ("not valid" material); keeps job posts of any age on Apify', async () => {
    mockConfig();
    const now = Date.now();
    const mixed = [
      {
        linkedinUrl: 'https://www.linkedin.com/posts/activity-999-JOB',
        content: 'We are hiring a #DevOps engineer! Apply now: https://jobs.example.com/apply',
        author: { name: 'ACME' },
        postedAt: { timestamp: now - 2 * 3600000 },
        job: { title: 'DevOps Engineer', linkedinUrl: 'https://www.linkedin.com/jobs/view/555' },
      },
      {
        linkedinUrl: 'https://www.linkedin.com/posts/activity-999-NEWS',
        content: 'Excited to share our Q3 results with our community!',
        author: { name: 'ACME' },
        postedAt: { timestamp: now - 1 * 3600000 },
      },
      {
        linkedinUrl: 'https://www.linkedin.com/posts/activity-999-OLD',
        content: 'We are hiring a #DevOps engineer, apply now.',
        author: { name: 'ACME' },
        postedAt: { timestamp: now - 30 * 3600000 },
      },
    ];
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mixed,
    } as any);

    const jobs = await new LinkedInPostsScraper().scrape({
      keywords: 'DevSecOps',
      location: '',
      sources: [],
      datePostedFilter: '24h',
      jobType: 'all',
      maxJobsPerSource: 5,
      engine: 'apify',
    } as any);

    // The user pays for the full fetch, so the 30h-old JOB posting is kept.
    expect(jobs).toHaveLength(2); // job posts kept regardless of age; news post dropped
    expect(jobs.map((j) => j.url)).not.toContain('activity-999-NEWS');
    expect(jobs.some((j) => j.url.includes('activity-999-OLD'))).toBe(true);
  });

  it('falls back to engines gracefully when no Apify token is configured', async () => {
    mockConfig({ apify: { token: '', enabled: false } });
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html></html>',
    } as any);

    const jobs = await new LinkedInPostsScraper().scrape({
      keywords: 'DevOps',
      location: '',
      sources: [],
      datePostedFilter: '24h',
      jobType: 'all',
      maxJobsPerSource: 3,
    } as any);

    expect(jobs).toEqual([]);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThan(0);
  }, 30000);

  it('calls Google News RSS for EVERY query (not just the first engine slot)', async () => {
    setScraperPause(0);
    vi.mocked(globalThis.fetch).mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('news.google.com')) {
        return { ok: true, status: 200, text: async () => GNRSS_ITEM('We are hiring a Frontend Engineer! Apply now') } as any;
      }
      return { ok: true, status: 200, text: async () => '<html></html>' } as any;
    });

    const res = await discoverPostUrls('Frontend Engineer', 20);

    const gnrssCalls = vi.mocked(globalThis.fetch).mock.calls.filter((c) => String(c[0]).includes('news.google.com')).length;
    expect(gnrssCalls).toBe(res.queriesTried);
    expect(gnrssCalls).toBeGreaterThan(1);
    expect(res.candidates.length).toBeGreaterThan(1);
  }, 30000);

  it('falls back to other engines only when GNRSS returns empty, and skips engines that failed once', async () => {
    setScraperPause(0);
    const calls: string[] = [];
    vi.mocked(globalThis.fetch).mockImplementation(async (input: any) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('news.google.com')) return { ok: true, status: 200, text: async () => '<rss><channel></channel></rss>' } as any;
      if (url.includes('html.duckduckgo.com') && !url.includes('r.jina.ai')) {
        // Direct DDG: fails once, must be skipped afterwards.
        return { ok: true, status: 200, text: async () => '<html>nothing</html>' } as any;
      }
      return { ok: true, status: 200, text: async () => '<html>nothing</html>' } as any;
    });

    await discoverPostUrls('QA Engineer', 20);

    // Direct DDG (no jina proxy) is called at most once — after it returns
    // empty it is marked broken and skipped for the rest of the run.
    const ddgDirect = calls.filter((u) => u.includes('html.duckduckgo.com') && !u.includes('r.jina.ai')).length;
    expect(ddgDirect).toBeLessThanOrEqual(1);
  }, 30000);

  it('stops discovery early once raw material exceeds ~2x the target limit', async () => {
    setScraperPause(0);
    const items = Array.from({ length: 60 }, (_, i) => `We are hiring Engineer #${i} now — apply`);
    vi.mocked(globalThis.fetch).mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('news.google.com')) {
        const rss = items.map((t, i) => `<item><title>${t}</title><link>https://www.linkedin.com/posts/company-${i}</link><pubDate>${new Date().toISOString()}</pubDate></item>`).join('');
        return { ok: true, status: 200, text: async () => `<rss><channel>${rss}</channel></rss>` } as any;
      }
      return { ok: true, status: 200, text: async () => '<html></html>' } as any;
    });

    const res = await discoverPostUrls('DevOps Engineer', 20);

    expect(res.queriesTried).toBe(1);
    expect(res.candidates.length).toBeGreaterThanOrEqual(40);
  }, 30000);

  it('isJobPosting keeps any-role hiring posts, drops non-job content', () => {
    expect(isJobPosting('We are hiring a Data Engineer! Join our team', false)).toBe(true);
    expect(isJobPosting('Excited to share our Q3 results with our community', false)).toBe(false);
  });
});
