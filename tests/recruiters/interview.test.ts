import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser, getDb } from '../../server/storage/fileStorage';
import { startInterview, askNextQuestion, scoreAnswer, buildScorecard, getRoleOptions, getJobsForRole } from '../../server/interview';

vi.mock('../../server/llm/llmAdapter', () => ({
  ask: vi.fn(async (prompt: string) => {
    if (prompt.includes('ACCURACY:')) return 'ACCURACY: 8\nDEPTH: 7\nSTRUCTURE: 9\nEXAMPLES: 6\nFEEDBACK: Solid answer with specifics.';
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

  it('scores answers with the rubric, tracks the source JD, and advances', async () => {
    const session = runWithUser('u1', () => startInterview({ role: 'DevOps Engineer' }));
    const q = await askNextQuestion(session);
    const { score, feedback, dims } = await scoreAnswer(session, q.question, q.jobTitle, q.company, 'I led an incident response last quarter. I wrote the runbook, coordinated the on-call team, and ran the postmortem with clear action items for the whole platform group.');
    // weighted: 8*.4 + 7*.25 + 9*.15 + 6*.2 = 7.5
    expect(dims).toEqual({ accuracy: 8, depth: 7, structure: 9, examples: 6 });
    expect(score).toBe(7.5);
    expect(feedback).toContain('Solid');
    expect(session.qIndex).toBe(1);
    expect(session.qa[0].jobTitle).toBe(q.jobTitle);
  });

  it('caps the score for one-line answers — no inflation', async () => {
    const session = runWithUser('u1', () => startInterview({ role: 'DevOps Engineer' }));
    const q = await askNextQuestion(session);
    const short = await scoreAnswer(session, q.question, q.jobTitle, q.company, 'I would use Terraform.');
    expect(short.score).toBeLessThanOrEqual(4);
    const mid = await scoreAnswer(session, q.question, q.jobTitle, q.company, 'I would design it carefully with proper planning and testing.');
    expect(mid.score).toBeLessThanOrEqual(6);
  });

  it('builds a scorecard with overall and verdict', async () => {
    const session = runWithUser('u1', () => startInterview({ role: 'DevOps Engineer' }));
    for (let i = 0; i < 2; i++) {
      const q = await askNextQuestion(session);
      await scoreAnswer(session, q.question, q.jobTitle, q.company, 'I have handled this exact scenario at scale before: I built the pipeline, measured the results, and improved uptime measurably while documenting everything for the team.');
    }
    const sc = await buildScorecard(session);
    expect(sc.perQuestion).toHaveLength(2);
    expect(sc.overall).toBe(7.5);
    expect(sc.verdict.length).toBeGreaterThan(10);
  });
});
