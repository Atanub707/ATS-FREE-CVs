import { Job, ScraperParams } from '../../src/types.js';

// ═══════════════════════════════════════════════════════════════════════════
//  LinkedIn Posts scraper (built-in, free)
//
//  Recruiters post jobs as LinkedIn posts. This scraper:
//    1. Discovers recent posts via search engines (Google → DuckDuckGo → Bing)
//       scoped to `site:linkedin.com/posts` + keywords + "past 24 hours".
//    2. Fetches each post page — LinkedIn post pages are publicly viewable
//       WITHOUT login.
//    3. Extracts author, text, date and any external link from the post.
//
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

async function searchGoogle(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords} (hiring OR job OR opening)`);
  const html = await getHtml(`https://www.google.com/search?q=${q}&tbs=qdr:d&num=20&gbv=1`, {
    Cookie: 'CONSENT=YES+cb.20240101-01-p0.en+FX+111; SOCS=CAESEwgDEgk2NzM5NzcwMzUaAmVuIAEaBgiA_LyaBg',
  });
  return html ? extractLinkedInPostUrls(html) : [];
}

async function searchDuckDuckGo(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords} (hiring OR job OR opening)`);
  const html = await getHtml(`https://html.duckduckgo.com/html/?q=${q}&df=${dateRangeParam()}`);
  return html ? extractLinkedInPostUrls(html) : [];
}

async function searchBing(keywords: string): Promise<string[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts ${keywords} (hiring OR job OR opening)`);
  const html = await getHtml(`https://www.bing.com/search?q=${q}&filters=ex1%3A%22ez5_19890_19890%22&count=20`);
  return html ? extractLinkedInPostUrls(html) : [];
}

async function discoverPostUrls(keywords: string): Promise<string[]> {
  const found = new Set<string>();
  for (const search of [searchGoogle, searchDuckDuckGo, searchBing]) {
    try {
      const urls = await search(keywords);
      for (const u of urls) found.add(u);
      if (found.size >= 8) break; // enough — stop hitting engines
    } catch { /* try next engine */ }
  }
  return [...found];
}

interface ParsedPost {
  author: string;
  text: string;
  date?: string;
  applyUrl?: string;
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
  return { author, text: text || title, date, applyUrl };
}

export class LinkedInPostsScraper {
  async scrape(params: ScraperParams): Promise<Job[]> {
    const keywords = params.keywords?.trim();
    if (!keywords) return [];
    const limit = Math.min(20, Math.max(1, params.maxJobsPerSource || 10));

    const urls = await discoverPostUrls(keywords);
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
        jobType: 'Post',
        state: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    }
    return jobs;
  }
}
