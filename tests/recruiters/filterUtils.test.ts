import { describe, it, expect } from 'vitest';
import { matchesSearch } from './filterUtils';

describe('matchesSearch', () => {
  const c = { name: 'Nicole', recruiterName: null, email: 'nicole@ioon.io', phone: null, company: 'IOON' };

  it('matches by name', () => expect(matchesSearch(c, 'nicole')).toBe(true));
  it('matches by email', () => expect(matchesSearch(c, 'ioon')).toBe(true));
  it('matches case-insensitively', () => expect(matchesSearch(c, 'NICOLE')).toBe(true));
  it('returns true for empty query', () => expect(matchesSearch(c, '')).toBe(true));
  it('rejects non-matches', () => expect(matchesSearch(c, 'zebra')).toBe(false));
});
