import { JobSource } from '../types';

export interface SourceMeta {
  id: JobSource;
  label: string;
  flag: string;
  country: string;
  region: 'global' | 'us' | 'uk' | 'eu' | 'asia' | 'apac';
  apifyActorId?: string; // REST form (valig~name) — present ⇔ Apify-powered
  needsApify?: boolean; // true = works ONLY with an Apify API key
  builtInFallback?: boolean; // LinkedIn only: Apify → built-in free scraper
  pricePer1K?: string; // displayed in Settings
}

export const SOURCES: Record<JobSource, SourceMeta> = {
  // ── Apify-powered (Valig) ──
  LinkedIn: { id: 'LinkedIn', label: 'LinkedIn', flag: '🌐', country: 'Global', region: 'global', apifyActorId: 'valig~linkedin-jobs-scraper', builtInFallback: true, pricePer1K: '$0.40' },
  Indeed: { id: 'Indeed', label: 'Indeed', flag: '🇺🇸', country: 'Global', region: 'global', apifyActorId: 'valig~indeed-jobs-scraper', needsApify: true, pricePer1K: '$0.10' },
  Naukri: { id: 'Naukri', label: 'Naukri', flag: '🇮🇳', country: 'India', region: 'asia', apifyActorId: 'valig~naukri-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  Glassdoor: { id: 'Glassdoor', label: 'Glassdoor', flag: '🌐', country: 'Global', region: 'global', apifyActorId: 'valig~glassdoor-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  StepStone: { id: 'StepStone', label: 'StepStone', flag: '🇩🇪', country: 'Germany', region: 'eu', apifyActorId: 'valig~stepstone-jobs-scraper', needsApify: true, pricePer1K: '$0.40' },
  Upwork: { id: 'Upwork', label: 'Upwork', flag: '🌐', country: 'Global freelance', region: 'global', apifyActorId: 'valig~upwork-jobs-scraper', needsApify: true, pricePer1K: '$0.20' },

  // ── Built-in free scrapers ──
  Arbeitnow: { id: 'Arbeitnow', label: 'Arbeitnow', flag: '🌍', country: 'Europe', region: 'eu' },
  SimplyHired: { id: 'SimplyHired', label: 'SimplyHired', flag: '🇺🇸', country: 'USA', region: 'us' },
  Dice: { id: 'Dice', label: 'Dice', flag: '🇺🇸', country: 'USA', region: 'us' },
  Reed: { id: 'Reed', label: 'Reed', flag: '🇬🇧', country: 'UK', region: 'uk' },
  RemoteOK: { id: 'RemoteOK', label: 'RemoteOK', flag: '🌍', country: 'Global remote', region: 'global' },
  WeWorkRemotely: { id: 'WeWorkRemotely', label: 'WeWorkRemotely', flag: '🌍', country: 'Global remote', region: 'global' },
  MyCareersFuture: { id: 'MyCareersFuture', label: 'MyCareersFuture', flag: '🇸🇬', country: 'Singapore', region: 'asia' },
  Cutshort: { id: 'Cutshort', label: 'Cutshort', flag: '🇮🇳', country: 'India', region: 'asia' },
  Gupy: { id: 'Gupy', label: 'Gupy', flag: '🇧🇷', country: 'Brazil', region: 'apac' },
  JobsCh: { id: 'JobsCh', label: 'JobsCh', flag: '🇨🇭', country: 'Switzerland', region: 'eu' },
  Daijob: { id: 'Daijob', label: 'Daijob', flag: '🇯🇵', country: 'Japan', region: 'asia' },
  MyJobMag: { id: 'MyJobMag', label: 'MyJobMag', flag: '🇳🇬', country: 'Nigeria', region: 'apac' },
  Custom: { id: 'Custom', label: 'Custom', flag: '🌐', country: 'Custom', region: 'global' },
};

export const APIFY_SOURCES: SourceMeta[] = Object.values(SOURCES).filter((s) => s.apifyActorId);

export function getSourceFlag(source: string): string {
  return SOURCES[source as JobSource]?.flag || '🌐';
}

export function getSourceCountry(source: string): string {
  return SOURCES[source as JobSource]?.country || 'Global';
}

export function getSourceMeta(source: JobSource): SourceMeta | undefined {
  return SOURCES[source];
}
