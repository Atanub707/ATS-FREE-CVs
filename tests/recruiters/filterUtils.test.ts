import { describe, it, expect } from 'vitest';
import { matchesSearch, filterByType, sortContacts, typeCounts } from './filterUtils';

describe('matchesSearch', () => {
  const c = { name: 'Nicole', recruiterName: null, email: 'nicole@ioon.io', phone: null, company: 'IOON' };

  it('matches by name', () => expect(matchesSearch(c, 'nicole')).toBe(true));
  it('matches by email', () => expect(matchesSearch(c, 'ioon')).toBe(true));
  it('matches case-insensitively', () => expect(matchesSearch(c, 'NICOLE')).toBe(true));
  it('returns true for empty query', () => expect(matchesSearch(c, '')).toBe(true));
  it('rejects non-matches', () => expect(matchesSearch(c, 'zebra')).toBe(false));
});

describe('filterByType', () => {
  const c = { type: 'recruit', company: 'X', jobCount: 1 };
  it('all passes everything', () => expect(filterByType(c, 'all')).toBe(true));
  it('matches type', () => expect(filterByType(c, 'recruit')).toBe(true));
  it('rejects other types', () => expect(filterByType(c, 'hr')).toBe(false));
});

describe('sortContacts', () => {
  const a = { name: 'Zoe', company: 'Alpha', type: 'recruit', jobCount: 1, lastSeen: '2026-08-01', lastEmailSent: undefined };
  const b = { name: 'Ann', company: 'Beta', type: 'recruit', jobCount: 5, lastSeen: '2026-08-03', lastEmailSent: '2026-08-02' };
  it('sorts by name', () => expect(sortContacts([a, b], 'name').map((x) => x.name)).toEqual(['Ann', 'Zoe']));
  it('sorts by job count desc', () => expect(sortContacts([a, b], 'job_count').map((x) => x.jobCount)).toEqual([5, 1]));
  it('sorts by last seen desc by default', () => expect(sortContacts([a, b], 'last_seen').map((x) => x.name)).toEqual(['Ann', 'Zoe']));
});

describe('typeCounts', () => {
  it('counts per type', () => {
    const list = [{ type: 'recruit', company: 'X', jobCount: 1 }, { type: 'recruit', company: 'Y', jobCount: 1 }, { type: 'hr', company: 'Z', jobCount: 1 }];
    expect(typeCounts(list)).toEqual({ recruit: 2, hr: 1 });
  });
});
