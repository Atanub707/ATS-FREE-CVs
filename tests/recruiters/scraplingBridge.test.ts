import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scraplingSearch, sidecarPostsToJobs, type SidecarPost } from '../../server/scraper/scraplingBridge';

describe('scraplingBridge', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    delete process.env.SCRAPLING_SIDECAR_URL;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('calls the sidecar with keywords + limit and returns its posts', async () => {
    const payload = {
      ok: true,
      debug: { queriesTried: 1, linksFound: 3, postsFound: 2, enginesUsed: 1 },
      posts: [
        {
          title: 'DevOps Engineer needed at Acme — apply today!',
          description: 'We are hiring a DevOps Engineer for our cloud team.',
          author: 'Acme',
          url: 'https://www.linkedin.com/posts/acme_devops-engineer',
          postedDate: new Date().toISOString(),
          hashtags: ['#hiring'],
          replacesUrl: 'https://news.google.com/rss/articles/token-1',
        },
      ],
    };
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const result = await scraplingSearch('DevOps Engineer', 20);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('http://localhost:5001/search');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ keywords: 'DevOps Engineer', limit: 20 });
    expect(result.ok).toBe(true);
    expect(result.posts).toHaveLength(1);
    expect(result.debug?.enginesUsed).toBe(1);
  });

  it('reports a 502-style error when the sidecar is unreachable', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('fetch failed: connection refused'));

    const result = await scraplingSearch('DevOps Engineer', 20);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Scrapling sidecar unreachable/);
    expect(result.error).toMatch(/connection refused/);
    expect(result.error).toMatch(/Try the Free engine instead/);
  });

  it('propagates the sidecar detail on a non-200 status', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'keywords is required' }),
    });

    const result = await scraplingSearch('', 20);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/500/);
    expect(result.error).toMatch(/keywords is required/);
  });

  it('maps sidecar posts into the Job shape with linkedinpost ids and replacesUrl', () => {
    const posts: SidecarPost[] = [
      {
        title: 'DevOps Engineer needed at Acme — apply today!',
        description: 'We are hiring a DevOps Engineer for our cloud team.',
        author: 'Acme',
        url: 'https://www.linkedin.com/posts/acme_devops?utm_source=news',
        postedDate: '2026-08-18T10:00:00.000Z',
        applyUrl: 'https://acme.com/careers/devops',
        hashtags: ['#hiring', '#devops'],
        replacesUrl: 'https://news.google.com/rss/articles/token-1',
      },
    ];

    const jobs = sidecarPostsToJobs(posts);

    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(job.id).toMatch(/^linkedinpost-/);
    expect(job.id).toHaveLength(33); // 'linkedinpost-' (13) + 20-char hash
    expect(job.title).toBe('DevOps Engineer needed at Acme — apply today!');
    expect(job.company).toBe('Acme');
    expect(job.source).toBe('LinkedInPosts');
    expect(job.jobType).toBe('Post');
    expect(job.state).toBe('pending');
    expect(job.url).toBe('https://www.linkedin.com/posts/acme_devops');
    expect(job.postedDateParsed).toBe('2026-08-18');
    expect(job.applyUrl).toBe('https://acme.com/careers/devops');
    expect(job.hashtags).toEqual(['#hiring', '#devops']);
    expect(job.recruiterName).toBe('Acme');
    expect(job.replacesUrl).toBe('https://news.google.com/rss/articles/token-1');
    expect(job.createdAt).toBeDefined();
    expect(job.updatedAt).toBeDefined();
  });

  it('drops non-LinkedIn urls and dedupes by url', () => {
    const posts: SidecarPost[] = [
      { title: 'a', description: 'x', author: '', url: 'https://www.linkedin.com/posts/a' },
      { title: 'b', description: 'x', author: '', url: 'https://www.linkedin.com/posts/a?x=1' },
      { title: 'c', description: 'x', author: '', url: 'https://evil.example/post' },
      { title: 'd', description: 'x', author: '', url: '' },
    ];

    const jobs = sidecarPostsToJobs(posts);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('a');
  });

  it('caps title and description lengths', () => {
    const posts: SidecarPost[] = [
      {
        title: 'x'.repeat(500),
        description: 'y'.repeat(5000),
        author: 'Acme',
        url: 'https://www.linkedin.com/posts/acme_long',
      },
    ];

    const jobs = sidecarPostsToJobs(posts);

    expect(jobs[0].title).toHaveLength(110);
    expect(jobs[0].description).toHaveLength(3000);
  });
});
