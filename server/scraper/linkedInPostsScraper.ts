import { Job, ScraperParams } from '../../src/types.js';
import { loadConfig } from '../config.js';

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

export function extractLinkedInPostUrls(html: string): string[] {
  const urls = new Set<string>();
  // 1. Direct hrefs (all engines sometimes expose them raw).
  for (const m of html.matchAll(/https:\/\/www\.linkedin\.com\/(?:posts\/[a-zA-Z0-9_-]+|feed\/update\/urn:li:activity:[0-9]+|company\/[a-zA-Z0-9._-]+\/posts\/[a-zA-Z0-9_-]+)/g)) {
    urls.add(m[0]);
  }
  // 2. Google redirect: /url?q=https%3A%2F%2F...
  for (const m of html.matchAll(/href="\/url\?q=([^"&]+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (u.includes('linkedin.com/posts/') || u.includes('linkedin.com/feed/update/')) urls.add(u.split('#')[0]);
    } catch { /* skip */ }
  }
  // 3. DuckDuckGo redirect: /l/?uddg=https%3A%2F%2F...
  for (const m of html.matchAll(/uddg=([^"&]+)/g)) {
    try {
      const u = decodeURIComponent(m[1]);
      if (u.includes('linkedin.com/posts/') || u.includes('linkedin.com/feed/update/')) urls.add(u.split('#')[0]);
    } catch { /* skip */ }
  }
  // 4. Bing redirect: /ck/a?...&u=a1aHR0cHM6... (base64url of the target URL)
  for (const m of html.matchAll(/[?&]u=a1([A-Za-z0-9_-]+)/g)) {
    try {
      const pad = m[1] + '='.repeat((4 - (m[1].length % 4)) % 4);
      const u = Buffer.from(pad, 'base64url').toString('utf8');
      if (u.includes('linkedin.com/posts/') || u.includes('linkedin.com/feed/update/')) urls.add(u.split('#')[0]);
    } catch { /* skip */ }
  }
  // 5. LinkedIn short links (lnkd.in) — resolved later via the post fetch redirect.
  for (const m of html.matchAll(/https:\/\/lnkd\.in\/[a-zA-Z0-9]+/g)) {
    urls.add(m[0]);
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

async function discoverPostUrls(keywords: string, limit: number): Promise<{ urls: string[]; queriesTried: number; linksFound: number }> {
  const queries = buildSearchQueries(keywords);
  const found = new Set<string>();
  const engines = [searchGoogle, searchDuckDuckGo, searchBing];
  let queriesTried = 0;

  // Rotate engines through the query set (max 8 engine hits per search — be a
  // good citizen) until we have enough posts or run out of queries.
  for (const query of queries) {
    if (found.size >= limit) break;
    if (queriesTried >= 8) break;
    const engine = engines[queriesTried % engines.length];
    queriesTried++;
    try {
      const urls = await engine(query);
      for (const u of urls) found.add(u);
      await new Promise((r) => setTimeout(r, 600)); // polite pause between engine hits
    } catch { /* try next */ }
  }
  return { urls: [...found], queriesTried, linksFound: found.size };
}

interface ParsedPost {
  author: string;
  text: string;
  date?: string;
  applyUrl?: string;
  hashtags: string[];
}

// ── Job-posting validation ───────────────────────────────────────────────────
// The search is for JOB-HUNTING posts ONLY. Anything else (news, memes,
// thought-leadership) is dropped and the caller reports "not valid".
const JOB_TEXT_SIGNALS =
  /\b(hiring|now hiring|we are hiring|we're hiring|looking for|openings?|job opening|open position|apply (now|here|today)|recruit(ing|er)?|opportunity|position|vacancy|join (us|our|the))\b|\b#?(hiring|nowhiring|jobopening|jobs|job)\b/i;
const ROLE_HINT = /\b(engineer|developer|architect|analyst|manager|lead|specialist|consultant|scientist|designer|admin|devops|sre|security|cloud|backend|frontend|full[- ]?stack|qa)\b/i;

export function isJobPosting(text: string, hasJobLink = false): boolean {
  if (hasJobLink) return true; // apify items carry a real job listing
  if (!text || text.length < 12) return false;
  const t = text.toLowerCase();
  return JOB_TEXT_SIGNALS.test(t) && ROLE_HINT.test(t);
}

// Strict "last 24 hours" cut: known dates older than 24h are dropped.
const CUTOFF_24H_MS = 24 * 3600000;
export function isWithin24h(iso?: string): boolean {
  if (!iso) return true; // unknown date → keep (engines are already 24h-scoped)
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t <= CUTOFF_24H_MS;
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
  let target = url;
  // Resolve LinkedIn short links (lnkd.in) to the real post page first.
  if (target.includes('lnkd.in')) {
    try {
      const head = await fetch(target, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      target = head.url || target;
    } catch { /* keep original */ }
  }
  const html = await getHtml(target);
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

// ── Apify layer (reliable keyword post search) ──────────────────────────────
// harvestapi/linkedin-post-search — "No Cookies" actor: keyword search over
// LinkedIn posts WITHOUT a session cookie (free engines still work as the
// no-token fallback). Returns ~100 posts per run (~$0.20/run at $2/1K);
// the client shows `limit` of them. Verified schema (2026-08-16):
//   input:  { searchQueries: string[] }  (required)
//   items:  linkedinUrl · content · author{name,linkedinUrl} ·
//           postedAt{timestamp,date,postedAgoText} · job{title,linkedinUrl,
//           location,subtitle,logoUrl} · socialContent · comments
const APIFY_POSTS_ACTOR = 'harvestapi~linkedin-post-search';

async function apifyPostsSearch(keywords: string, limit: number): Promise<Job[]> {
  const config = loadConfig();
  const token = config.apify.token?.trim();
  if (!token || config.apify.enabled !== true) return [];

  const input = {
    searchQueries: [keywords, `${keywords} hiring`],
  };
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_POSTS_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(240000) }
    );
    if (!res.ok) {
      console.warn(`[LinkedInPosts] Apify actor returned ${res.status}`);
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];

    const jobs: Job[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (jobs.length >= limit) break;
      const url = String(item.linkedinUrl || item.url || item.postUrl || '').split('?')[0];
      const text = String(item.content || item.text || item.description || item.postContent || '').trim();
      const author = String(item.author?.name || item.authorName || item.companyName || 'LinkedIn').trim();
      if (!url.includes('linkedin.com') || !text || seen.has(url)) continue;
      const jobUrl = item.job?.linkedinUrl ? String(item.job.linkedinUrl) : undefined;
      // Job-posting search only: keep posts that ARE job postings.
      if (!isJobPosting(text, !!jobUrl)) continue;
      const postedRaw = item.postedAt?.date || item.postedAt?.timestamp || item.postedAt || item.date;
      const postedIso = postedRaw ? new Date(postedRaw).toISOString() : undefined;
      if (!isWithin24h(postedIso)) continue; // last 24h only
      seen.add(url);
      const now = new Date().toISOString();
      const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 10) || text.slice(0, 110);
      // The post often carries the actual JOB listing — prefer it as the apply link.
      const company = item.job?.subtitle ? String(item.job.subtitle).replace(/^Job by\s*/i, '') : author;
      jobs.push({
        id: `linkedinpost-${Buffer.from(url).toString('base64url').slice(0, 24)}`,
        title: firstLine.slice(0, 110),
        company,
        location: String(item.job?.location || ''),
        source: 'LinkedInPosts',
        description: text.slice(0, 3000),
        url,
        postedDate: postedIso,
        postedDateParsed: postedIso ? postedIso.slice(0, 10) : undefined,
        applyUrl: jobUrl || (item.externalUrl ? String(item.externalUrl) : undefined),
        hashtags: extractHashtags(text),
        jobType: 'Post',
        state: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    }
    return jobs;
  } catch (e: any) {
    console.warn('[LinkedInPosts] Apify actor failed:', e?.message);
    return [];
  }
}

export class LinkedInPostsScraper {
  lastDebug: { queriesTried: number; linksFound: number; via?: string } = { queriesTried: 0, linksFound: 0 };

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords?.trim();
    if (!keywords) return [];
    const limit = Math.min(20, Math.max(1, params.maxJobsPerSource || 20));
    // The user chooses the engine. Free (built-in engines, no token) is the
    // default — Apify is opt-in and charged to the user's own token.
    const engine: 'free' | 'apify' = params.engine || 'free';

    if (engine === 'apify') {
      const apifyJobs = await apifyPostsSearch(keywords, limit);
      if (apifyJobs.length > 0) {
        this.lastDebug = { queriesTried: 1, linksFound: apifyJobs.length, via: 'apify' };
      }
      return apifyJobs;
    }

    // Free path: multi-engine discovery (works without a cookie or token).
    const { urls, queriesTried, linksFound } = await discoverPostUrls(keywords, limit);
    this.lastDebug = { queriesTried, linksFound };
    const jobs: Job[] = [];
    const seen = new Set<string>();

    for (const url of urls) {
      if (jobs.length >= limit) break;
      const post = await fetchPost(url);
      if (!post) continue;
      // Job-posting search only: drop non-job posts ("not valid" material).
      if (!isJobPosting(post.text)) continue;
      if (!isWithin24h(post.date)) continue; // last 24h only
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
