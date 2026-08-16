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
    url: 'https://www.linkedin.com/posts/acme-hiring-devsecops-engineer-activity-7123456789012345678-ABCD',
    text: 'We are hiring a #DevSecOps engineer! Join our team. #Kubernetes #CICD apply here',
    name: 'ACME Recruiting',
    date: new Date(Date.now() - 2 * 3600000).toISOString(),
    externalUrl: 'https://acme.com/careers',
  },
  {
    url: 'https://www.linkedin.com/posts/beta-security-activity-7123456789012345678-EFGH',
    text: 'Opening for a #CloudSecurity engineer with AWS + Terraform. Remote friendly.',
    name: 'Beta Security',
    date: new Date(Date.now() - 5 * 3600000).toISOString(),
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

  it('uses the Apify actor path when the token is configured (no cookie needed)', async () => {
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
    } as any);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toContain('We are hiring');
    expect(jobs[0].company).toBe('ACME Recruiting');
    expect(jobs[0].hashtags).toContain('#DevSecOps');
    expect(jobs[0].applyUrl).toBe('https://acme.com/careers');
    expect(jobs[0].url).toContain('linkedin.com/posts');
    expect(jobs[0].source).toBe('LinkedInPosts');
    // Actor URL used:
    const call = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(call).toContain('run-sync-get-dataset-items');
    expect(call).toContain('harvestapi/linkedin-post-search');
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
  });
});
