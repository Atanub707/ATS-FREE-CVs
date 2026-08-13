import { describe, it, expect } from 'vitest';
import { rankLocations } from '../../src/lib/locations';

const db = {
  countries: [
    { name: 'India', isoCode: 'IN' },
    { name: 'United States', isoCode: 'US' },
    { name: 'Singapore', isoCode: 'SG' },
    { name: 'Germany', isoCode: 'DE' },
  ],
  states: [
    { name: 'Karnataka', isoCode: 'KA', countryCode: 'IN' },
    { name: 'California', isoCode: 'CA', countryCode: 'US' },
    { name: 'Bavaria', isoCode: 'BY', countryCode: 'DE' },
  ],
  cities: [
    { name: 'Bengaluru', countryCode: 'IN', stateCode: 'KA' },
    { name: 'Mumbai', countryCode: 'IN', stateCode: 'MH' },
    { name: 'Kolkata', countryCode: 'IN', stateCode: 'WB' },
    { name: 'Chennai', countryCode: 'IN', stateCode: 'TN' },
    { name: 'San Francisco', countryCode: 'US', stateCode: 'CA' },
    { name: 'Munich', countryCode: 'DE', stateCode: 'BY' },
  ],
};

describe('rankLocations', () => {
  it('matches countries by prefix', () => {
    const r = rankLocations('ind', db, 10);
    expect(r[0]).toMatchObject({ value: 'India', type: 'country' });
  });

  it('matches cities with a state + country label', () => {
    const r = rankLocations('bengaluru', db, 10);
    expect(r[0].label).toBe('Bengaluru, Karnataka, India');
    expect(r[0].value).toBe('Bengaluru');
    expect(r[0].type).toBe('city');
  });

  it('matches city by substring', () => {
    const r = rankLocations('fran', db, 10);
    expect(r.some((x) => x.value === 'San Francisco')).toBe(true);
  });

  it('expands aliases (bangalore → bengaluru)', () => {
    const r = rankLocations('bangalore', db, 10);
    expect(r.some((x) => x.value === 'Bengaluru')).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(rankLocations('', db, 10)).toEqual([]);
    expect(rankLocations('   ', db, 10)).toEqual([]);
  });

  it('dedupes identical labels and respects the limit', () => {
    const big = { ...db, cities: [...db.cities, ...db.cities] };
    const r = rankLocations('bengaluru', big, 10);
    expect(r.filter((x) => x.value === 'Bengaluru')).toHaveLength(1);
    const capped = rankLocations('a', db, 3);
    expect(capped.length).toBeLessThanOrEqual(3);
  });

  it('ranks prefix matches above substring matches', () => {
    const d = {
      ...db,
      countries: db.countries,
      cities: [
        ...db.cities,
        { name: 'Benguela', countryCode: 'AO', stateCode: 'BGU' },
        { name: 'Kolkwitz', countryCode: 'DE', stateCode: 'BB' },
      ],
    };
    const r = rankLocations('beng', d, 10);
    expect(r[0].value).toBe('Bengaluru');
    const k = rankLocations('kolk', d, 10);
    expect(k[0].value).toBe('Kolkata');
    const i = rankLocations('ind', d, 10);
    expect(i[0].value).toBe('India');
  });
});
