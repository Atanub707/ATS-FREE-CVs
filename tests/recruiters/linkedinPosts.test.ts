import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LinkedInPostsScraper } from '../../server/scraper/linkedInPostsScraper';

const realFetch = globalThis.fetch;

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
});
