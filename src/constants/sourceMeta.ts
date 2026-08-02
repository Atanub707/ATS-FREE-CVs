import { JobSource } from '../types';

export interface SourceMeta {
  flag: string;
  country: string;
  region: 'global' | 'us' | 'uk' | 'eu' | 'asia' | 'apac';
}

export const SOURCE_METADATA: Record<JobSource, SourceMeta> = {
  LinkedIn: { flag: '🌐', country: 'Global', region: 'global' },
  Glassdoor: { flag: '🌐', country: 'Global', region: 'global' },
  Arbeitnow: { flag: '🌍', country: 'Europe', region: 'eu' },
  SimplyHired: { flag: '🇺🇸', country: 'USA', region: 'us' },
  Dice: { flag: '🇺🇸', country: 'USA', region: 'us' },
  Reed: { flag: '🇬🇧', country: 'UK', region: 'uk' },
  Greenhouse: { flag: '🌍', country: 'Global (company boards)', region: 'global' },
  Lever: { flag: '🌍', country: 'Global (company boards)', region: 'global' },
  RemoteOK: { flag: '🌍', country: 'Global remote', region: 'global' },
  WeWorkRemotely: { flag: '🌍', country: 'Global remote', region: 'global' },
  MyCareersFuture: { flag: '🇸🇬', country: 'Singapore', region: 'asia' },
  Custom: { flag: '🌐', country: 'Custom', region: 'global' },
};

export function getSourceFlag(source: string): string {
  return SOURCE_METADATA[source as JobSource]?.flag || '🌐';
}

export function getSourceCountry(source: string): string {
  return SOURCE_METADATA[source as JobSource]?.country || 'Global';
}
