import { describe, it, expect } from 'vitest';
import { splitSentences } from '../../src/lib/speechChunk';

describe('splitSentences', () => {
  it('splits on sentence boundaries', () => {
    const out = splitSentences('Hello there. This is the second sentence! And a third?');
    expect(out).toEqual(['Hello there.', 'This is the second sentence!', 'And a third?']);
  });

  it('flattens newlines into spaces', () => {
    const out = splitSentences('Line one.\nLine two with  extra   spaces.');
    expect(out).toEqual(['Line one.', 'Line two with extra spaces.']);
  });

  it('returns empty for blank input', () => {
    expect(splitSentences('   ')).toEqual([]);
    expect(splitSentences('')).toEqual([]);
  });

  it('caps the number of chunks', () => {
    const long = Array.from({ length: 20 }, (_, i) => `Sentence ${i}.`).join(' ');
    expect(splitSentences(long, 5)).toHaveLength(5);
  });

  it('keeps sentences whole but hard-splits run-on parts over the chunk length', () => {
    const out = splitSentences('Short. '.repeat(3) + 'X'.repeat(300) + '.');
    expect(out).toEqual(['Short.', 'Short.', 'Short.', 'X'.repeat(280), 'X'.repeat(20) + '.']);
    expect(out.every((c) => c.length <= 280)).toBe(true);
  });
});
