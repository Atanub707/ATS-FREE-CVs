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
  RemoteOK: { flag: '🌍', country: 'Global remote', region: 'global' },
  WeWorkRemotely: { flag: '🌍', country: 'Global remote', region: 'global' },
  MyCareersFuture: { flag: '🇸🇬', country: 'Singapore', region: 'asia' },
  Cutshort: { flag: '🇮🇳', country: 'India', region: 'asia' },
  Gupy: { flag: '🇧🇷', country: 'Brazil', region: 'apac' },
  JobsCh: { flag: '🇨🇭', country: 'Switzerland', region: 'eu' },
  Daijob: { flag: '🇯🇵', country: 'Japan', region: 'asia' },
  MyJobMag: { flag: '🇳🇬', country: 'Nigeria', region: 'apac' },
  Custom: { flag: '🌐', country: 'Custom', region: 'global' },
};

export function getSourceFlag(source: string): string {
  return SOURCE_METADATA[source as JobSource]?.flag || '🌐';
}

export function getSourceCountry(source: string): string {
  return SOURCE_METADATA[source as JobSource]?.country || 'Global';
}
