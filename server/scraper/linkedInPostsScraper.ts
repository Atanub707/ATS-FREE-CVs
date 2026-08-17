import { createHash } from 'node:crypto';
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
//    2. Runs Google News RSS against EVERY query (the only engine that works
//       from any IP — no captcha, honors site: + when:1d, ~100 items) and
//       falls back to DDG/Bing/Google/company-pages only when a query comes
//       back empty; engines that return nothing are skipped for the run.
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

function roleVariants(role: string): string[] {
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
function buildSearchQueries(role: string): string[] {
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

// RESEARCH (2026-08-17): Google's SERP returns a JS anti-bot challenge from
// datacenter IPs (gbv=1 is deprecated and irrelevant). The reliable free
// source is Google News RSS, which HONORS `site:linkedin.com/posts`, returns
// ~100 fresh items, and carries the full hiring-post text (with lnkd.in apply
// links) even when the direct post URL is a Google-News token.
// Each GNRSS item → a "synthetic" candidate: title is the full post text,
// pubDate is the exact post time, and any http(s) apply link is lifted from
// the text. These pass through isJobPosting + isWithin24h in the caller.
interface GnCandidate { text: string; pubDate?: string; applyUrl?: string; link: string }

function extractGnItems(html: string): GnCandidate[] {
  const out: GnCandidate[] = [];
  for (const m of html.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const title = it.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const pubDate = it.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || '';
    const link = it.match(/<link>([^<]*)<\/link>/)?.[1] || '';
    if (!title) continue;
    // Unescape basic XML entities.
    const text = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    const applyUrl = text.match(/https?:\/\/(?!www\.linkedin\.com)[^\s"'<>)]+/i)?.[0]?.replace(/[).,;:]+$/, '').split('?')[0];
    out.push({ text, pubDate: pubDate || undefined, applyUrl, link });
  }
  return out;
}

async function searchGoogleNewsRss(keywords: string): Promise<{ urls: string[]; candidates: GnCandidate[] }> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords}`);
  // `when:1d` restricts to the last day — matches the 24h requirement server-side.
  const html = await getHtml(`https://news.google.com/rss/search?q=${q}+when:1d&hl=en-US&gl=US&ceid=US:en`);
  if (!html) return { urls: [], candidates: [] };
  const candidates = extractGnItems(html);
  // Direct post URLs (when GNRSS exposes them) still flow through the normal
  // post-fetch path; candidates power synthetic posts.
  return { urls: extractLinkedInPostUrls(html), candidates };
}

// r.jina.ai renders JS SERPs to plain HTML — unblocks DDG/Bing from
// datacenter IPs (free tier: 20 RPM anonymous; ~500 RPM with a free key).
// Google domains are blocked anonymously, so this is for DDG/Bing only.
async function searchJinaDuckDuckGo(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords}`);
  const html = await getHtml(`https://r.jina.ai/https://html.duckduckgo.com/html/?q=${q}`);
  return html ? extractLinkedInPostUrls(html) : [];
}

// jina-rendered Bing: renders Bing's JS + keeps the u=a1 base64url redirects
// the extractor already decodes. Bing's direct HTML silently drops `site:`
// and uses an opaque redirect the extractor can't read — via jina it works.
async function searchJinaBing(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords}`);
  const html = await getHtml(`https://r.jina.ai/https://www.bing.com/search?q=${q}&count=20`);
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

// RESEARCH (Track B): a LinkedIn company home page (e.g. /company/microsoft/)
// publicly exposes ~8 fresh post URLs without login — a reliable free
// discovery surface. For common engineering employers we fetch their home
// pages and collect the post links; combined across several companies this
// adds a solid trickle of fresh recruiting posts.
const COMPANY_POST_PAGES: Record<string, string[]> = {
  default: [
    'amazon', 'microsoft', 'google', 'meta', 'netflix', 'apple',
    'infosys', 'tcs', 'accenture', 'cognizant', 'wipro', 'deloitte', 'ibm',
    'oracle', 'salesforce', 'vmware', 'atlassian', 'datadog', 'splunk', 'palantir',
  ],
  devsecops: ['amazon', 'microsoft', 'google', 'oracle', 'salesforce', 'vmware', 'splunk', 'crowdstrike', 'paloaltonetworks', 'okta'],
  devops: ['amazon', 'microsoft', 'google', 'netflix', 'atlassian', 'datadog', 'hashicorp', 'gitlab', 'digitalocean', 'cloudflare'],
  cloud: ['amazon', 'microsoft', 'google', 'oracle', 'salesforce', 'cloudflare', 'digitalocean', 'ibm'],
  security: ['crowdstrike', 'paloaltonetworks', 'okta', 'splunk', 'zscaler', 'sentinelone', 'cyberark', 'microsoft'],
  data: ['snowflake', 'databricks', 'datadog', 'confluent', 'mongodb', 'elastic', 'amazon'],
  backend: ['amazon', 'microsoft', 'google', 'stripe', 'stripe', 'cloudflare', 'datadog', 'gitlab'],
};

async function searchCompanyHomes(keywords: string): Promise<string[]> {
  const r = keywords.toLowerCase();
  let companies = COMPANY_POST_PAGES.default;
  for (const key of ['devsecops', 'devops', 'cloud', 'security', 'data', 'backend']) {
    if (r.includes(key)) { companies = COMPANY_POST_PAGES[key]; break; }
  }
  const found = new Set<string>();
  for (const c of companies.slice(0, 4)) { // 4 company pages per search — polite
    const html = await getHtml(`https://www.linkedin.com/company/${c}/`, { Cookie: 'lang=v=2&lang=en-us' });
    if (html) for (const u of extractLinkedInPostUrls(html)) found.add(u);
    await new Promise((r2) => setTimeout(r2, 700));
  }
  return [...found];
}

type EngineResult = { urls: string[]; candidates: GnCandidate[] };

// Polite pause between engine hits (tests can lower it).
let PAUSE_MS = 1000;
export function setScraperPause(ms: number): void {
  PAUSE_MS = Math.max(0, ms);
}

export async function discoverPostUrls(keywords: string, limit: number): Promise<{ urls: string[]; candidates: GnCandidate[]; queriesTried: number; linksFound: number; enginesUsed: number }> {
  const queries = buildSearchQueries(keywords);
  const found = new Set<string>();
  const candidates: GnCandidate[] = [];
  // RESEARCH (docs/linkedin-posts-research.md): GNRSS is the ONLY engine that
  // reliably works from any IP — no captcha, honors site: + when:1d, ~100
  // fresh items per query. So it is tried for EVERY query, and the other
  // engines are fallbacks used only when a query comes back empty. Engines
  // that return nothing are marked broken and skipped for the rest of the
  // run (they mostly fail from datacenter IPs: Google anti-bot, DDG
  // hard-captcha, Bing drops site:).
  const fallbackEngines: ((q: string) => Promise<string[]>)[] = [
    searchJinaDuckDuckGo,
    searchJinaBing,
    searchCompanyHomes,
    searchGoogle,
    searchDuckDuckGo,
    searchBing,
  ];
  let queriesTried = 0;
  const enginesUsed = new Set<number>([0]); // 0 = GNRSS (always tried first)
  const broken = new Set<number>();
  const MAX_HITS = 14;
  // Raw-material cap: stop early once we hold ~2× the target in UNVALIDATED
  // links + candidates (validation happens in scrape()). found.size alone is
  // NOT a good stop signal — most discovered URLs fail isJobPosting /
  // isWithin24h or the guest-page fetch 403s (DevSecOps: 45 links → 0 posts).
  const rawCap = limit * 2;

  for (const query of queries) {
    if (queriesTried >= MAX_HITS) break;
    if (found.size >= rawCap && candidates.length >= rawCap) break;
    queriesTried++;
    let urls: string[] = [];
    let cands: GnCandidate[] = [];
    try {
      const r = await searchGoogleNewsRss(query);
      urls = r.urls;
      cands = r.candidates;
    } catch { /* treat as empty → fallback */ }
    if (!urls.length && !cands.length) {
      for (let i = 0; i < fallbackEngines.length; i++) {
        if (broken.has(i)) continue;
        try {
          const fu = await fallbackEngines[i](query);
          if (fu.length) {
            enginesUsed.add(i + 1);
            for (const u of fu) found.add(u);
            break;
          }
          broken.add(i); // returned nothing → skip next time
        } catch {
          broken.add(i); // threw → skip next time
        }
      }
    }
    for (const u of urls) found.add(u);
    candidates.push(...cands);
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  return { urls: [...found], candidates, queriesTried, linksFound: found.size, enginesUsed: enginesUsed.size };
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
function isWithin24h(iso?: string): boolean {
  if (!iso) return true; // unknown date → keep (engines are already 24h-scoped)
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t <= CUTOFF_24H_MS;
}

function extractHashtags(text: string): string[] {
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
  // RESEARCH: lnkd.in returns 403 on HEAD but 200 on GET, has NO Location
  // header, and shows an interstitial page containing the real destination
  // as an <a href> — extract it so the fetched page (and apply link) resolves.
  if (target.includes('lnkd.in')) {
    try {
      const res = await fetch(target, { method: 'GET', headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const body = await res.text();
      const href = body.match(/href="(https?:\/\/(?!www\.linkedin\.com|licdn\.com|lnkd\.in)[^"]+)"/)?.[1];
      if (href) target = href;
      else if (res.url && !res.url.includes('lnkd.in')) target = res.url;
    } catch { /* keep original */ }
  }
  const html = await getHtml(target);
  if (!html) return null;

  const og = (prop: string) => html.match(new RegExp(`<meta[^>]+property="og:${prop}"[^>]+content="([^"]*)"`))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="og:${prop}"`))?.[1] ?? '';

  const title = og('title').replace(/ \| LinkedIn$/i, '').trim();
  const text = og('description').trim();

  // Author (guest pages): og:title is "<post text> | <AUTHOR> | <N> comments".
  // Take the middle " | " segment (fallback: "on LinkedIn" split, then name).
  let author = 'LinkedIn';
  const pipeParts = title.split(' | ').map((p) => p.trim()).filter(Boolean);
  if (pipeParts.length >= 2 && pipeParts[1] && !/^\d+ comments?$/i.test(pipeParts[pipeParts.length - 1] || '')) {
    author = pipeParts[1];
  } else if (title.includes(' on LinkedIn')) {
    author = title.split(' on LinkedIn')[0].trim() || author;
  }

  // Date (guest pages): there is NO "X hours ago" label and NO datetime=
  // attribute — the only date is JSON-LD `datePublished` (exact ISO).
  let date: string | undefined;
  const rel = html.match(/(\d+ (?:minute|hour|day)s? ago)/i)?.[1];
  if (rel) {
    date = parseRelativeTime(rel);
  } else {
    const ld = html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1];
    if (ld) date = new Date(ld).toISOString();
    const iso = html.match(/datetime="([^"]+)"/)?.[1];
    if (!date && iso) date = new Date(iso).toISOString();
  }

  // Apply/job link: on guest pages the post's links live INSIDE the
  // og:description text (lnkd.in, goo.gle, ibm.co, sforce.co, …), not as
  // <a href> anchors. Prefer an explicit external anchor first, then scan
  // the text for the first non-LinkedIn http(s) URL.
  const extAnchor = html.match(/<a[^>]+href="(https?:\/\/(?!www\.linkedin\.com)[^"]+)"[^>]*>[^<]*<\/a>/)?.[1];
  let applyUrl = extAnchor && !extAnchor.includes('linkedin.com') ? extAnchor.split('?')[0] : undefined;
  if (!applyUrl) {
    const inText = text.match(/https?:\/\/(?!www\.linkedin\.com|lnkd\.in)[^\s"'<>)]+/i)?.[0];
    if (inText) applyUrl = inText.replace(/[).,;:]+$/, '').split('?')[0];
  }

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

  // Single query per run: the actor fetches ~100 posts (billed ~$0.20 at
  // $2/1K) and has no limit input — a second query would double the cost
  // (~$0.40) without doubling what we show. One run = one search = $0.20.
  const input = {
    searchQueries: [keywords],
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
      // NOTE: no 24h cut here — the user PAYS for all ~100 fetched posts, so
      // they see all of them. (The Free engine keeps the 24h window.)
      seen.add(url);
      const now = new Date().toISOString();
      const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 10) || text.slice(0, 110);
      // The post often carries the actual JOB listing — prefer it as the apply link.
      const company = item.job?.subtitle ? String(item.job.subtitle).replace(/^Job by\s*/i, '') : author;
      const postedRaw = item.postedAt?.date || item.postedAt?.timestamp || item.postedAt || item.date;
      const postedIso = postedRaw ? new Date(postedRaw).toISOString() : undefined;
      jobs.push({
        id: `linkedinpost-${createHash('sha1').update(url).digest('base64url').slice(0, 20)}`,
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
  lastDebug: { queriesTried: number; linksFound: number; via?: string; enginesUsed?: number } = { queriesTried: 0, linksFound: 0 };

  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords?.trim();
    if (!keywords) return [];
    const limit = Math.min(100, Math.max(1, params.maxJobsPerSource || 20));
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
    const { urls, candidates, queriesTried, linksFound, enginesUsed } = await discoverPostUrls(keywords, limit);
    this.lastDebug = { queriesTried, linksFound, enginesUsed };
    const jobs: Job[] = [];
    const seen = new Set<string>();
    const now = new Date().toISOString();

    // Direct post URLs → fetch + parse the real post page.
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

      jobs.push({
        id: `linkedinpost-${createHash('sha1').update(url).digest('base64url').slice(0, 20)}`,
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

    // Synthetic posts from Google News RSS titles (full post text + pubDate +
    // embedded apply link). Google News often only exposes a token link, so
    // the post is reconstructed from its own text — the apply link is used as
    // the job URL when the token link isn't a real post page.
    for (const cand of candidates) {
      if (jobs.length >= limit) break;
      if (!isJobPosting(cand.text)) continue;
      const candDate = cand.pubDate ? new Date(cand.pubDate).toISOString() : undefined;
      if (!isWithin24h(candDate)) continue; // last 24h only
      const firstLine = cand.text.split('\n').map((l) => l.trim()).find((l) => l.length > 10) || cand.text.slice(0, 90);
      const title = firstLine.slice(0, 110);
      const dedupeKey = (title + '|' + (cand.applyUrl || '')).toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const idUrl = cand.applyUrl || cand.link;
      jobs.push({
        id: `linkedinpost-${createHash('sha1').update(idUrl).digest('base64url').slice(0, 20)}`,
        title,
        company: '',
        location: '',
        source: 'LinkedInPosts',
        description: cand.text.slice(0, 3000),
        url: cand.link,
        postedDate: candDate,
        postedDateParsed: candDate ? candDate.slice(0, 10) : undefined,
        applyUrl: cand.applyUrl,
        hashtags: extractHashtags(cand.text),
        jobType: 'Post',
        state: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    }
    return jobs;
  }
}
