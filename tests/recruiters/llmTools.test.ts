import { describe, it, expect, vi } from 'vitest';
import { buildToolLoop } from '../../server/llm/tools';

describe('tool loop', () => {
  it('executes tools the model asks for and returns the final reply', async () => {
    const tools = [{ name: 'search_jobs', description: 'x', inputSchema: {} }];
    const calls: string[] = [];
    const fakeAsk = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ name: 'search_jobs', args: { role: 'DevOps' } }] })
      .mockResolvedValueOnce({ reply: 'Here are 5 jobs…' });
    const loop = buildToolLoop(fakeAsk as any);
    const out = await loop({
      messages: [{ role: 'user', content: 'remote jobs' }],
      tools,
      toolExecutor: async (name) => {
        calls.push(name);
        return { jobs: [] };
      },
      maxRounds: 3,
    });
    expect(calls).toEqual(['search_jobs']);
    expect(out.reply).toContain('5 jobs');
    expect(fakeAsk).toHaveBeenCalledTimes(2);
  });

  it('stops after maxRounds', async () => {
    const tools = [{ name: 'search_jobs', description: 'x', inputSchema: {} }];
    const fakeAsk = vi.fn().mockResolvedValue({ toolCalls: [{ name: 'search_jobs', args: {} }] });
    const loop = buildToolLoop(fakeAsk as any);
    const out = await loop({ messages: [], tools, toolExecutor: async () => ({}), maxRounds: 2 });
    expect(fakeAsk).toHaveBeenCalledTimes(2);
    expect(typeof out.reply).toBe('string');
  });

  it('surfaces tool errors back to the model instead of crashing', async () => {
    const tools = [{ name: 'broken', description: 'x', inputSchema: {} }];
    const fakeAsk = vi
      .fn()
      .mockResolvedValueOnce({ toolCalls: [{ name: 'broken', args: {} }] })
      .mockResolvedValueOnce({ reply: 'Sorry, that failed.' });
    const loop = buildToolLoop(fakeAsk as any);
    const out = await loop({ messages: [], tools, toolExecutor: async () => { throw new Error('boom'); }, maxRounds: 3 });
    expect(out.reply).toBe('Sorry, that failed.');
  });
});
