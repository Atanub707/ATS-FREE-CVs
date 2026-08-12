import { describe, it, expect } from 'vitest';
import { isEmailFormatValid } from './emailUtils';

describe('isEmailFormatValid', () => {
  it('accepts normal addresses', () => {
    expect(isEmailFormatValid('nicole@ioon.io')).toBe(true);
    expect(isEmailFormatValid('a.b+c@example.co.uk')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isEmailFormatValid('not-an-email')).toBe(false);
    expect(isEmailFormatValid('a@b')).toBe(false);
    expect(isEmailFormatValid('@x.com')).toBe(false);
    expect(isEmailFormatValid('a@.com')).toBe(false);
  });
});
