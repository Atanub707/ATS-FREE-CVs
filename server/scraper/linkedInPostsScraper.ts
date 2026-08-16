import { Job, ScraperParams } from '../../src/types.js';

// ═══════════════════════════════════════════════════════════════════════════
//  LinkedIn Posts scraper (built-in, free)
//
//  Recruiters post jobs as LinkedIn posts (social-media style: hashtags +
//  hiring phrases + links) — NOT formal listings. This scraper:
//    1. Expands the searched role into posting-style variants and builds a
//       set of OPTIMIZED queries: hashtag queries, hiring-keyword queries,
//       tech combos, remote-first modifiers (1–3 tags/keywords per query).
//    2. Discovers recent posts via search engines (Google → DuckDuckGo → Bing)
//       scoped to site:linkedin.com/posts + "past 24 hours".
//    3. Fetches each post page (publicly viewable WITHOUT login), extracts
//       author, text, hashtags, date and external apply link.
//
//  Strategy + research: docs/linkedin-posts-research.md
//  NOTE: search engines rate-limit datacenter IPs — like the other built-in
//  scrapers, this works reliably from residential IPs (the user's machine).
// ═══════════════════════════════════════════════════════════════════════════

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function getHtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html,application/xhtml+xml', ...extraHeaders },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      /* retry once */
    }
  }
  return null;
}

function extractLinkedInPostUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/https:\/\/www\.linkedin\.com\/(?:posts\/[a-zA-Z0-9_-]+|feed\/update\/urn:li:activity:[0-9]+|company\/[a-zA-Z0-9._-]+\/posts\/[a-zA-Z0-9_-]+)/g)) {
    urls.add(m[0]);
  }
  // Decode Google-redirect hrefs (`/url?q=...`) when present.
  for (const m of html.matchAll(/href="\/url\?q=([^"&]+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (u.includes('linkedin.com/posts/')) urls.add(u.split('#')[0]);
    } catch { /* skip */ }
  }
  return [...urls];
}

const dateRangeParam = (): string => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return `${f(yesterday)}..${f(now)}`;
};

// ── Query strategy (from docs/linkedin-posts-research.md) ───────────────────

// Common hiring-intent phrases seen in recruiter job posts.
const HIRING_WORDS = ['hiring', 'we are hiring', "we're hiring", 'looking for', 'openings', 'job opening', 'opportunity', 'apply', 'open position', 'now hiring'];

// Role posting variants: "DevSecOps" → the ways recruiters tag/name it in posts.
const ROLE_VARIANTS: Record<string, string[]> = {
  devsecops: ['DevSecOps', 'DevSecOps Engineer', 'DevSecOps Jobs', 'Cloud DevSecOps', 'DevOps Security Engineer', 'Security Engineer', 'Application Security Engineer', 'Platform Security Engineer'],
  devops: ['DevOps', 'DevOps Engineer', 'DevOps Jobs', 'Cloud DevOps', 'DevOps Engineer Remote', 'Senior DevOps Engineer'],
  cloud: ['Cloud Engineer', 'Cloud Security Engineer', 'Cloud DevOps Engineer', 'Cloud Engineer Remote'],
  security: ['Security Engineer', 'Application Security Engineer', 'Cloud Security Engineer', 'Security Automation'],
  sre: ['SRE', 'Site Reliability Engineer', 'SRE Engineer'],
  platform: ['Platform Engineer', 'Platform Security Engineer'],
  data: ['Data Engineer', 'Data Engineering Jobs'],
  backend: ['Backend Engineer', 'Backend Developer'],
  frontend: ['Frontend Engineer', 'Frontend Developer'],
  fullstack: ['Full Stack Engineer', 'Full Stack Developer'],
  qa: ['QA Engineer', 'QA Automation'],
  network: ['Network Engineer'],
};

export function roleVariants(role: string): string[] {
  const r = role.toLowerCase();
  for (const [key, variants] of Object.entries(ROLE_VARIANTS)) {
    if (r.includes(key)) return variants;
  }
  // Unknown role → sensible posting-style variants of the raw query.
  const base = role.trim();
  return [base, `${base} Engineer`, `${base} Jobs`, `${base} hiring`];
}

// Tech keywords for combo queries (per role family).
const TECH_COMBOS: Record<string, string[]> = {
  devsecops: ['Kubernetes', 'CI/CD', 'SAST', 'DAST', 'SCA', 'Terraform', 'AWS', 'Azure', 'GCP', 'Docker', 'GitLab', 'Jenkins', 'GitHub Actions'],
  devops: ['Kubernetes', 'CI/CD', 'Terraform', 'AWS', 'Azure', 'GCP', 'Docker', 'GitLab', 'Jenkins', 'GitHub Actions', 'Helm', 'Linux'],
  cloud: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD'],
  default: ['Remote', 'Hiring', 'Jobs', 'Openings'],
};

// Build the optimized query set: 1–3 hashtags OR 2–3 keywords per query.
export function buildSearchQueries(role: string): string[] {
  const variants = roleVariants(role);
  const r = role.toLowerCase();
  const combos = TECH_COMBOS[Object.keys(TECH_COMBOS).find((k) => r.includes(k)) || 'default'] || TECH_COMBOS.default;
  const queries: string[] = [];

  // 1. Hashtag queries (1–3 tags).
  const tags = variants.slice(0, 4).map((v) => `#${v.replace(/\s+/g, '')}`);
  queries.push(tags.slice(0, 2).join(' '), `${tags[0] || ''} #Hiring`, `${tags[0] || ''} #NowHiring`, `${tags[1] || tags[0] || ''} #JobOpening`);

  // 2. Role + hiring-intent keyword (2–3 keywords per query).
  for (const v of variants.slice(0, 4)) {
    queries.push(`"${v}" ${HIRING_WORDS[0]}`);
    queries.push(`"${v}" ${HIRING_WORDS[3]}`);
    queries.push(`"${v}" ${HIRING_WORDS[4]}`);
  }

  // 3. Tech combos (role + technology).
  for (const t of combos.slice(0, 4)) {
    queries.push(`${variants[0]} ${t}`);
  }

  // 4. Remote-first modifiers.
  queries.push(`"${variants[0]}" Remote`, `"${variants[0]}" Remote India`, `${variants[0]} openings`);

  // Dedupe + cap (don't spam engines).
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const clean = q.replace(/\s+/g, ' ').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out.slice(0, 14);
}

async function searchGoogle(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords}`);
  const html = await getHtml(`https://www.google.com/search?q=${q}&tbs=qdr:d&num=20&gbv=1`, {
    Cookie: 'CONSENT=YES+cb.20240101-01-p0.en+FX+111; SOCS=CAESEwgDEgk2NzM5NzcwMzUaAmVuIAEaBgiA_LyaBg',
  });
  return html ? extractLinkedInPostUrls(html) : [];
}

async function searchDuckDuckGo(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords}`);
  const html = await getHtml(`https://html.duckduckgo.com/html/?q=${q}&df=${dateRangeParam()}`);
  return html ? extractLinkedInPostUrls(html) : [];
}

async function searchBing(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords}`);
  const html = await getHtml(`https://www.bing.com/search?q=${q}&filters=ex1%3A%22ez5_19890_19890%22&count=20`);
  return html ? extractLinkedInPostUrls(html) : [];
}

async function discoverPostUrls(keywords: string, limit: number): Promise<string[]> {
  const queries = buildSearchQueries(keywords);
  const found = new Set<string>();
  const engines = [searchGoogle, searchDuckDuckGo, searchBing];

  // Rotate engines through the query set (max 5 engine hits per search — be a
  // good citizen) until we have enough posts or run out of queries.
  let engineHits = 0;
  for (const query of queries) {
    if (found.size >= limit) break;
    if (engineHits >= 5) break;
    const engine = engines[engineHits % engines.length];
    engineHits++;
    try {
      const urls = await engine(query);
      for (const u of urls) found.add(u);
      await new Promise((r) => setTimeout(r, 400)); // polite pause between engine hits
    } catch { /* try next */ }
  }
  return [...found];
}

interface ParsedPost {
  author: string;
  text: string;
  date?: string;
  applyUrl?: string;
  hashtags: string[];
}

export function extractHashtags(text: string): string[] {
  const tags = [...new Set(text.match(/#[A-Za-z0-9_]+/g) || [])].slice(0, 8);
  return tags;
}

function parseRelativeTime(label: string): string | undefined {
  const m = label.match(/(\d+)\s*(minute|hour|day)s?\s*ago/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms = unit.startsWith('minute') ? n * 60000 : unit.startsWith('hour') ? n * 3600000 : n * 86400000;
  return new Date(Date.now() - ms).toISOString();
}

async function fetchPost(url: string): Promise<ParsedPost | null> {
  const html = await getHtml(url);
  if (!html) return null;

  const og = (prop: string) => html.match(new RegExp(`<meta[^>]+property="og:${prop}"[^>]+content="([^"]*)"`))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="og:${prop}"`))?.[1] ?? '';

  const title = og('title').replace(/ \| LinkedIn$/i, '').trim();
  const text = og('description').trim();

  // Author: og:title is often "Firstname Lastname on LinkedIn"
  const author = title.split(' on LinkedIn')[0].trim() || 'LinkedIn';

  // Date: prefer the visible "X hours ago" label, then ISO dates.
  let date: string | undefined;
  const rel = html.match(/(\d+ (?:minute|hour|day)s? ago)/i)?.[1];
  if (rel) date = parseRelativeTime(rel);
  if (!date) {
    const iso = html.match(/datetime="([^"]+)"/)?.[1];
    if (iso) date = new Date(iso).toISOString();
  }

  // External link (the job/apply URL recruiters put in the post).
  const ext = html.match(/<a[^>]+href="(https?:\/\/(?!www\.linkedin\.com)[^"]+)"[^>]*>[^<]*<\/a>/)?.[1];
  const applyUrl = ext && !ext.includes('linkedin.com') ? ext.split('?')[0] : undefined;

  if (!text && !title) return null;
  return { author, text: text || title, date, applyUrl, hashtags: extractHashtags(text || title) };
}

export class LinkedInPostsScraper {
  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords?.trim();
    if (!keywords) return [];
    const limit = Math.min(20, Math.max(1, params.maxJobsPerSource || 10));

    const urls = await discoverPostUrls(keywords, limit);
    const jobs: Job[] = [];
    const seen = new Set<string>();

    for (const url of urls) {
      if (jobs.length >= limit) break;
      const post = await fetchPost(url);
      if (!post) continue;
      const firstLine = post.text.split('\n').map((l) => l.trim()).find((l) => l.length > 10) || post.text.slice(0, 90);
      const title = firstLine.slice(0, 110);
      if (seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());

      const now = new Date().toISOString();
      jobs.push({
        id: `linkedinpost-${Buffer.from(url).toString('base64url').slice(0, 24)}`,
        title,
        company: post.author,
        location: '',
        source: 'LinkedInPosts',
        description: post.text.slice(0, 3000),
        url,
        postedDate: post.date,
        postedDateParsed: post.date ? new Date(post.date).toISOString().slice(0, 10) : undefined,
        applyUrl: post.applyUrl,
        hashtags: post.hashtags,
        jobType: 'Post',
        state: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    }
    return jobs;
  }
}
