import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser, getDb } from '../../server/storage/fileStorage';
import { CHAT_TOOLS, TOOL_EXECUTORS } from '../../server/mcp/registry';

function seedJob(id: string, data: Record<string, any>) {
  getDb().prepare('INSERT INTO jobs (id, user_id, data) VALUES (?, ?, ?)').run(
    id,
    'u1',
    JSON.stringify({ id, state: 'pending', createdAt: new Date().toISOString(), ...data })
  );
}

describe('MCP tool registry', () => {
  beforeEach(() => {
    setupTestDb();
    runWithUser('u1', () => {
      seedJob('j1', { title: 'DevOps Engineer', company: 'ACME', location: 'Remote', source: 'LinkedIn', url: 'https://x/j1', description: 'Kubernetes terraform ci cd', gapAnalysis: { matchScore: 82, matchingSkills: ['Kubernetes'], matchedKeywords: ['Kubernetes'], missingKeywords: ['Terraform'] } });
      seedJob('j2', { title: 'SRE', company: 'BETA', location: 'Berlin', source: 'Indeed', url: 'https://x/j2', description: 'linux' });
    });
  });
  afterEach(() => teardownTestDb());

  it('exposes the five chat tools', () => {
    expect(CHAT_TOOLS.map((t) => t.name)).toEqual(['search_jobs', 'get_job', 'score_job', 'get_cv_summary', 'scrape_jobs']);
  });

  it('search_jobs filters by source and role and caps at limit', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['search_jobs']({ role: 'DevOps', source: 'LinkedIn', limit: 5 }));
    expect(out.jobs).toHaveLength(1);
    expect(out.jobs[0].company).toBe('ACME');
  });

  it('search_jobs returns all when no filters', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['search_jobs']({}));
    expect(out.jobs).toHaveLength(2);
  });

  it('search_jobs filters by workMode remote', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['search_jobs']({ workMode: 'remote' }));
    expect(out.jobs.map((j: any) => j.id)).toEqual(['j1']);
  });

  it('get_job returns details or error', async () => {
    const ok = await runWithUser('u1', () => TOOL_EXECUTORS['get_job']({ id: 'j1' }));
    expect(ok.job.title).toBe('DevOps Engineer');
    const missing = await runWithUser('u1', () => TOOL_EXECUTORS['get_job']({ id: 'nope' }));
    expect(missing.error).toBeTruthy();
  });

  it('score_job returns stored analysis', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['score_job']({ id: 'j1' }));
    expect(out.score).toBe(82);
    expect(out.matched).toEqual(['Kubernetes']);
  });

  it('get_cv_summary returns profile fields', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['get_cv_summary']({}));
    expect(typeof out.fullName).toBe('string');
    expect(Array.isArray(out.skills)).toBe(true);
  });

  it('scrape_jobs runs the scraper and stores new jobs in the list', async () => {
    const { ScraperFactory } = await import('../../server/scraper/scraperFactory');
    const spy = vi.spyOn(ScraperFactory, 'runScrape').mockResolvedValue([
      { id: 'linkedin-999', title: 'DevOps Engineer', company: 'NEWCO', location: 'Remote', source: 'LinkedIn', url: 'https://x/999' },
    ] as any);
    try {
      const out = await runWithUser('u1', () => TOOL_EXECUTORS['scrape_jobs']({ role: 'DevOps', location: 'Remote' }));
      expect(out.addedCount).toBe(1);
      expect(out.jobs[0].company).toBe('NEWCO');
      const stored = getDb().prepare('SELECT data FROM jobs WHERE id = ?').get('linkedin-999');
      expect(stored).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('scrape_jobs rejects a missing role', async () => {
    const out = await runWithUser('u1', () => TOOL_EXECUTORS['scrape_jobs']({}));
    expect(out.error).toBeTruthy();
  });
});
