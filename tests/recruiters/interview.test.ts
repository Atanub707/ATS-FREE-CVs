import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser, getDb } from '../../server/storage/fileStorage';
import { startInterview, askNextQuestion, scoreAnswer, buildScorecard, getRoleOptions, getJobsForRole } from '../../server/interview';

vi.mock('../../server/llm/llmAdapter', () => ({
  ask: vi.fn(async (prompt: string) => {
    if (prompt.includes('SCORE:')) return 'SCORE: 8\nFEEDBACK: Solid answer with specifics.';
    if (prompt.includes('verdict')) return 'Strong candidate for the role. Good communication. Focus on AWS depth.';
    return 'Tell me about a time you handled a production incident.';
  }),
}));

function seedJob(id: string, title: string, company: string, description: string) {
  getDb().prepare('INSERT INTO jobs (id, user_id, data) VALUES (?, ?, ?)').run(
    id,
    'u1',
    JSON.stringify({ id, title, company, description, createdAt: new Date().toISOString() })
  );
}

describe('interview engine (JD-grounded)', () => {
  beforeEach(() => {
    setupTestDb();
    runWithUser('u1', () => {
      seedJob('j1', 'Senior DevOps Engineer', 'ACME', 'We need Kubernetes, Terraform and GitLab CI experience. You will own the platform.'.repeat(3));
      seedJob('j2', 'DevOps Engineer', 'BETA', 'Requirements: Helm, Prometheus and Grafana for our observability stack.'.repeat(3));
      seedJob('j3', 'SRE', 'GAMMA', 'Incident response, on-call and reliability engineering at scale.'.repeat(3));
    });
  });
  afterEach(() => teardownTestDb());

  it('aggregates roles from dashboard titles', () => {
    const roles = runWithUser('u1', () => getRoleOptions());
    expect(roles).toHaveLength(2);
    expect(roles[0].label).toContain('DevOps');
    expect(roles[0].count).toBe(2);
    expect(roles[1].label).toContain('Sre');
  });

  it('finds real jobs with descriptions for a role', () => {
    const jobs = runWithUser('u1', () => getJobsForRole('DevOps Engineer'));
    expect(jobs).toHaveLength(2);
    expect(jobs[0].description.length).toBeGreaterThan(50);
  });

  it('starts a session and asks a question grounded in a real JD', async () => {
    const session = runWithUser('u1', () => startInterview({ role: 'DevOps Engineer', experienceYears: '4+ years' }));
    expect(session.total).toBe(7);
    expect(session.jobs.length).toBeGreaterThan(0);
    const q = await askNextQuestion(session);
    expect(q.question.length).toBeGreaterThan(10);
    expect(q.jobTitle).toContain('DevOps');
    const asked = vi.mocked((await import('../../server/llm/llmAdapter')).ask).mock.calls[0][0];
    expect(asked).toContain('Description excerpt');
    expect(asked).toContain('Kubernetes');
  });

  it('scores answers, tracks the source JD, and advances', async () => {
    const session = runWithUser('u1', () => startInterview({ role: 'DevOps Engineer' }));
    const q = await askNextQuestion(session);
    const { score, feedback } = await scoreAnswer(session, q.question, q.jobTitle, q.company, 'I led an incident response last quarter.');
    expect(score).toBe(8);
    expect(feedback).toContain('Solid');
    expect(session.qIndex).toBe(1);
    expect(session.qa[0].jobTitle).toBe(q.jobTitle);
  });

  it('builds a scorecard with overall and verdict', async () => {
    const session = runWithUser('u1', () => startInterview({ role: 'DevOps Engineer' }));
    for (let i = 0; i < 2; i++) {
      const q = await askNextQuestion(session);
      await scoreAnswer(session, q.question, q.jobTitle, q.company, 'My answer with specific results.');
    }
    const sc = await buildScorecard(session);
    expect(sc.perQuestion).toHaveLength(2);
    expect(sc.overall).toBe(8);
    expect(sc.verdict.length).toBeGreaterThan(10);
  });
});
