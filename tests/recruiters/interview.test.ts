import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser } from '../../server/storage/fileStorage';
import { startInterview, askNextQuestion, scoreAnswer, buildScorecard } from '../../server/interview';

vi.mock('../../server/llm/llmAdapter', () => ({
  ask: vi.fn(async (prompt: string) => {
    if (prompt.includes('SCORE:')) return 'SCORE: 8\nFEEDBACK: Solid answer with specifics.';
    if (prompt.includes('verdict')) return 'Strong candidate for the role. Good communication. Focus on AWS depth.';
    return 'Tell me about a time you handled a production incident.';
  }),
}));

describe('interview engine', () => {
  beforeEach(() => {
    setupTestDb();
    runWithUser('u1', () => {});
  });
  afterEach(() => teardownTestDb());

  it('starts a session and returns a question', async () => {
    const session = runWithUser('u1', () => startInterview('Senior DevOps Engineer'));
    expect(session.total).toBe(7);
    const q = await askNextQuestion(session);
    expect(q.length).toBeGreaterThan(10);
  });

  it('scores answers and advances', async () => {
    const session = runWithUser('u1', () => startInterview('Senior DevOps Engineer'));
    const q = await askNextQuestion(session);
    const { score, feedback } = await scoreAnswer(session, q, 'I led an incident response last quarter.');
    expect(score).toBe(8);
    expect(feedback).toContain('Solid');
    expect(session.qIndex).toBe(1);
    expect(session.qa).toHaveLength(1);
  });

  it('builds a scorecard with overall and verdict', async () => {
    const session = runWithUser('u1', () => startInterview('Senior DevOps Engineer'));
    for (let i = 0; i < 2; i++) {
      const q = await askNextQuestion(session);
      await scoreAnswer(session, q, 'My answer with specific results.');
    }
    const sc = await buildScorecard(session);
    expect(sc.perQuestion).toHaveLength(2);
    expect(sc.overall).toBe(8);
    expect(sc.verdict.length).toBeGreaterThan(10);
  });
});
