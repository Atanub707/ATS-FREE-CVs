// robots.txt guard: good-faith crawler behavior. Before scraping a source,
// check its robots.txt; if the site declares crawling disallowed (Disallow: /),
// skip the source with a clear log instead of scraping against the site's
// stated rules. Results are cached in-memory for 1 hour.

const cache = new Map<string, { allowed: boolean; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchRobotsTxt(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'ATS-CV-Tailor/1.0 (+local personal use; respects robots.txt)' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Returns true if the site allows general crawling (or we couldn't determine —
// e.g. no robots.txt, or it's a public API host that doesn't block).
export async function isCrawlingAllowed(domain: string): Promise<boolean> {
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.allowed;

  let allowed = true;
  try {
    const text = await fetchRobotsTxt(domain);
    if (text) {
      // Check User-agent: * groups for a blanket Disallow: /
      // Per RFC 9309: an EMPTY "Disallow:" means "allow everything";
      // only a literal "/" blocks all paths. "Allow: /" in the same
      // group overrides a blanket disallow.
      const groups = text.split(/User-agent:\s*\*/i);
      for (const group of groups.slice(1)) {
        const disallow = group.match(/Disallow:\s*(\S*)/i);
        if (disallow && disallow[1] === '/' && !/Allow:\s*\/\s*$/m.test(group)) {
          allowed = false;
          break;
        }
      }
    }
  } catch {
    allowed = true;
  }

  cache.set(domain, { allowed, fetchedAt: Date.now() });
  return allowed;
}
