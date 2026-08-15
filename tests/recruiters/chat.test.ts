import { describe, it, expect } from 'vitest';
import { parseJobsBlock } from '../../server/llm/tools';

describe('parseJobsBlock', () => {
  it('extracts jobs and strips the JSON line', () => {
    const reply = 'Here are 5 remote jobs:\n{"__jobs":[{"id":"j1","reason":"great fit"},{"id":"j2","reason":"skills match"}]}';
    const out = parseJobsBlock(reply);
    expect(out.jobs).toHaveLength(2);
    expect(out.jobs[0].id).toBe('j1');
    expect(out.text).toContain('Here are 5 remote jobs');
    expect(out.text).not.toContain('__jobs');
  });

  it('returns empty jobs when no block', () => {
    const out = parseJobsBlock('No jobs found today.');
    expect(out.jobs).toEqual([]);
    expect(out.text).toBe('No jobs found today.');
  });

  it('survives malformed JSON', () => {
    const out = parseJobsBlock('{"__jobs":[broken}');
    expect(out.jobs).toEqual([]);
  });

  it('extracts the cv block and strips it', () => {
    const reply = 'Your CV is ready.\n{"__cv":{"token":"abc123","template":"harvard"}}';
    const out = parseJobsBlock(reply);
    expect(out.cv).toEqual({ token: 'abc123', template: 'harvard' });
    expect(out.text).toContain('Your CV is ready');
    expect(out.text).not.toContain('__cv');
  });

  it('keeps jobs and cv blocks separately', () => {
    const reply = 'Done.\n{"__jobs":[{"id":"j1"}]}\n{"__cv":{"token":"t1"}}';
    const out = parseJobsBlock(reply);
    expect(out.jobs).toHaveLength(1);
    expect(out.cv?.token).toBe('t1');
  });
});
