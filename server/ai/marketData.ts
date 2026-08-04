import { getAllJobs } from '../storage/fileStorage.js';

const STOPWORDS = new Set([
  'the','and','for','with','you','are','will','our','your','have','this','that','from',
  'they','their','what','why','not','can','all','any','but','out','who','which','into',
  'experience','years','year','work','job','role','team','must','able','including','etc',
  'strong','excellent','good','well','plus','min','new','candidate','should','per','within',
  'across','using','used','use','one','two','well','also','may','like','make','day','days',
  'week','weeks','month','months','required','requirements','requirement','knowledge','ability',
  'etc','us','uk','india','remote','onsite','hybrid','fulltime','parttime','contract','salary',
]);

export function getMarketData(targetRole: string): { jobCount: number; topKeywords: string[]; sampleRequirements: string[] } {
  try {
    const roleWords = targetRole.toLowerCase().split(/[^a-z0-9+.#-]+/).filter((w) => w.length > 1);
    const all = getAllJobs();
    const matching = all
      .filter((j) => {
        const t = (j.title || '').toLowerCase();
        return roleWords.some((w) => t.includes(w));
      })
      .sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || ''))
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

    const samples = matching
      .map((j) => (j.description || '').split(/(?<=\.)\s+/).find((s) => s.toLowerCase().includes(topKeywords[0] || '')))
      .filter(Boolean)
      .slice(0, 5) as string[];

    return { jobCount: matching.length, topKeywords, sampleRequirements: samples };
  } catch {
    return { jobCount: 0, topKeywords: [], sampleRequirements: [] };
  }
}
