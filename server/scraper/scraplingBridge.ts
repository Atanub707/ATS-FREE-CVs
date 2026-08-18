// ── Scrapling sidecar bridge ────────────────────────────────────────────────
// The Scrapling engine runs in a Python sidecar container (stealth browser):
// discovery + resolution + post fetch all happen there. This module is the
// only Node↔sidecar contact: it calls the sidecar and maps its posts into the
// same Job shape the free path produces, so storage/upgrade/UI are shared.

import { createHash } from 'crypto';
import type { Job } from '../../src/types.js';

export interface SidecarPost {
  title: string;
  description: string;
  author: string;
  url: string;
  postedDate?: string;
  applyUrl?: string;
  hashtags?: string[];
  replacesUrl?: string;
}

export interface SidecarSearchResult {
  ok: boolean;
  debug?: { queriesTried?: number; linksFound?: number; postsFound?: number; enginesUsed?: number };
  posts?: SidecarPost[];
  error?: string;
}

const SIDECAR_URL = (process.env.SCRAPLING_SIDECAR_URL || 'http://localhost:5001').replace(/\/+$/, '');

export function scraplingSearch(keywords: string, limit: number): Promise<SidecarSearchResult> {
  return (async () => {
    try {
      const res = await fetch(`${SIDECAR_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, limit }),
        signal: AbortSignal.timeout(240000),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
        return { ok: false, error: `Scrapling sidecar returned ${res.status}: ${detail?.detail || 'unknown error'}` };
      }
      const data = (await res.json()) as SidecarSearchResult;
      return data.ok ? data : { ok: false, error: data.error || 'Scrapling sidecar returned ok:false' };
    } catch (err: any) {
      const reason = err?.name === 'TimeoutError' ? 'timed out after 240s' : err?.message || String(err);
      return {
        ok: false,
        error: `Scrapling sidecar unreachable (${reason}). Is the scrapling container running? Try the Free engine instead.`,
      };
    }
  })();
}

// Sidecar posts → the exact Job shape the free path produces (same ids,
// same source tag, same storage/upgrade contract).
export function sidecarPostsToJobs(posts: SidecarPost[]): Job[] {
  const now = new Date().toISOString();
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    const url = p.url?.split('?')[0] ?? '';
    if (!url || !url.includes('linkedin.com') || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    jobs.push({
      id: `linkedinpost-${createHash('sha1').update(url).digest('base64url').slice(0, 20)}`,
      title: (p.title || '').slice(0, 110),
      company: p.author || '',
      location: '',
      source: 'LinkedInPosts',
      description: (p.description || '').slice(0, 3000),
      url,
      postedDate: p.postedDate,
      postedDateParsed: p.postedDate ? p.postedDate.slice(0, 10) : undefined,
      applyUrl: p.applyUrl,
      hashtags: p.hashtags || [],
      recruiterName: p.author || undefined,
      replacesUrl: p.replacesUrl,
      jobType: 'Post',
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }
  return jobs;
}