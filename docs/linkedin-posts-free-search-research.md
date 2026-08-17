# LinkedIn Posts — Free Search: Research Findings & Implementation

Date: 2026-08-17 · Research by parallel agent team (4 tracks) · Verified live

## Problem
The free LinkedIn Posts search returned **0 results** ("8 queries tried · 0 links found").
Root cause was NOT "engines don't index LinkedIn" — it was three independent failures
from datacenter/container IPs.

## Root-cause findings (live-tested from this machine)

| Engine | Status | What happened |
|---|---|---|
| Google SERP | JS anti-bot challenge (`emsg=SG_REL`) | `gbv=1` is deprecated/ignored; response identical with/without it. Only a real browser or paid API fixes this. |
| DuckDuckGo | Captcha after ~1 hit/IP | First request returns real posts; every request after returns a 202 image-captcha. The old 8-hit rotation guaranteed lockout. |
| Bing | 200 but `site:` silently dropped | Returns generic DevOps tutorials; result redirect format changed from `u=a1<base64url>` to `/ck/a?!&p=<opaque>` (extractor couldn't decode). |
| **Google News RSS** | **Works — free, no captcha** | Honors `site:linkedin.com/posts`, returns ~100 fresh items in the last day (`when:1d`), full post text in titles. |
| **r.jina.ai proxy** | **Works for DDG/Bing** | Renders JS SERPs to HTML; 20 RPM free (500 RPM with free key). Google domains blocked anonymously. |
| Brave direct | ~1 in 4 requests | Alternates 429/200; real posts on success. Good retry-with-backoff source. |
| Mojeek | 403/503 | Hard blocked. |

Also found: **`lnkd.in` returns 403 on HEAD but 200 on GET** (post-link resolver bug), and
guest LinkedIn post pages expose author/date differently than assumed.

## Recommended architecture (implemented)

1. **Primary: Google News RSS** — `news.google.com/rss/search?q=site:linkedin.com/posts <role>+when:1d`.
   GNRSS item titles ARE the full hiring-post text. Since Google News only exposes a
   token link (not the direct post URL), posts are **synthesized** from the title +
   `pubDate` + any apply link found in the text. Passes through `isJobPosting` +
   `isWithin24h`.
2. **Secondary: r.jina.ai render proxy** over DuckDuckGo/Bing — yields direct
   `linkedin.com/posts` URLs that flow through the normal fetch/parse path.
3. **Last resort: direct engines** (Google/DDG/Bing) — kept, but only after the two
   reliable sources; 1s pacing, 12-hit budget.
4. **Post-fetch fixes** (for direct URLs): GET (not HEAD) for lnkd.in; author from the
   `" | "` split in og:title (guest pages have no "on LinkedIn"); date from JSON-LD
   `datePublished`; apply links from og:description text (not `<a href>`).
5. **UX copy split** — distinguish "engines blocked/rate-limited" (`linksFound === 0`)
   from "found posts but none were job postings in the last 24h" (`linksFound > 0`).

## Verified live
- `JOBS: 8` real posts for "DevOps engineer" via the free path (first time ever).
- API end-to-end: `valid: true`, 5 posts for "DevSecOps engineer" (e.g. "WE'RE HIRING |
  Azure DevOps Engineer", "We are Hiring: Senior Multi-Cloud DevOps Engineer | Deloitte").
- 69 tests pass.

## Honest limitations
- Free path returns the **full post text + date**, but apply URLs are only recoverable
  when a direct post URL or an explicit link is present (GNRSS titles are truncated).
- Nothing from a datacenter IP is 100% reliable; Google specifically needs a browser
  (not worth it) or a paid SERP API.

## Future options (if paid/keys acceptable)
- Tavily free tier (1,000/mo, no card) — deterministic, includes `linkedin.com` + `days=1`.
- Brave Search API free (~1,000/mo, card required) — `freshness=pd`.
- SerpAPI free (250/mo) — real Google SERP.
- Headless Chromium — highest effort; uncertain from datacenter IPs; not recommended.
