import { describe, it, expect, vi, afterEach } from 'vitest';
import { followupDue, followupDaysLeft } from './followupUtils';

describe('followupUtils', () => {
  afterEach(() => vi.useRealTimers());
  it('due when past date and not followed up', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDue('2026-08-10T00:00:00Z', false)).toBe(true);
  });
  it('not due when followed up', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDue('2026-08-10T00:00:00Z', true)).toBe(false);
  });
  it('not due when future', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDue('2026-08-20T00:00:00Z', false)).toBe(false);
  });
  it('not due when no date', () => expect(followupDue(undefined, false)).toBe(false));
  it('days left computes', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDaysLeft('2026-08-15T00:00:00Z')).toBe(3);
    expect(followupDaysLeft('2026-08-10T00:00:00Z')).toBe(0);
  });
});
