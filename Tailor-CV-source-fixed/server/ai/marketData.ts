import { getAllJobs } from '../storage/fileStorage.js';
import { Job } from '../../src/types.js';

export const STOPWORDS = new Set([
  'the','and','for','with','you','are','will','our','your','have','this','that','from',
  'they','their','what','why','not','can','all','any','but','out','who','which','into',
  'experience','years','year','work','job','role','team','must','able','including','etc',
  'strong','excellent','good','well','plus','min','new','candidate','should','per','within',
  'across','using','used','use','one','two','also','may','like','make','day','days',
  'week','weeks','month','months','required','requirements','requirement','knowledge','ability',
  'us','uk','india','remote','onsite','hybrid','fulltime','parttime','contract','salary',
]);

export function getMarketData(targetRole: string): { jobCount: number; topKeywords: string[]; sampleRequirements: string[] } {
  try {
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const roleWords = targetRole.toLowerCase().split(/[^a-z0-9+.#-]+/).filter((w) => w.length > 1);
    const roleMatchers = roleWords.filter((w) => w.length >= 3).map((w) => new RegExp('\\b' + escapeRegExp(w) + '\\b', 'i'));
    const all = getAllJobs();
    const sortKey = (j: Job): string => j.postedDateParsed || (j.createdAt ? new Date(j.createdAt).getTime().toString() : '');
    const matching = all
      .filter((j) => {
        const t = (j.title || '').toLowerCase();
        return roleMatchers.some((re) => re.test(t));
      })
      .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
      .slice(0, 20);

    if (matching.length === 0) {
      return { jobCount: 0, topKeywords: [], sampleRequirements: [] };
    }

    const freq = new Map<string, number>();
    const descPool = matching.map((j) => j.description || '').join(' ');
    const tokens = descPool.toLowerCase().split(/[^a-z0-9+.#-]+/);
    for (const t of tokens) {
      if (t.length < 3 || STOPWORDS.has(t)) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }

    const topKeywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k]) => k);

    if (topKeywords.length === 0) {
      return { jobCount: matching.length, topKeywords: [], sampleRequirements: [] };
    }

    const samples = matching
      .map((j) => (j.description || '').split(/(?<=\.)\s+|\n+/).map((s) => s.trim()).find((s) => s.toLowerCase().includes(topKeywords[0])))
      .filter(Boolean)
      .slice(0, 5) as string[];

    return { jobCount: matching.length, topKeywords, sampleRequirements: samples };
  } catch {
    return { jobCount: 0, topKeywords: [], sampleRequirements: [] };
  }
}
