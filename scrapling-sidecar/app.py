import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Scrapling LinkedIn Posts sidecar", version="0.1.0")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

HIRING_HINTS = re.compile(
    r"\b(?:hiring|recruiting|we\s+are\s+hiring|we\'?re\s+hiring|looking\s+for|vacanc|open(?:ing)?\s+role|urgent\s+hiring|opportunit|needed|wanted)\b",
    re.I,
)
ROLE_HINTS = re.compile(
    r"\b(?:engineer|developer|analyst|architect|manager|lead|specialist|consultant|scientist|administrator|director|officer|designer|developer|programmer)\b",
    re.I,
)

SEARCH_ENGINES = [
    "https://html.duckduckgo.com/html/?q={q}",
    "https://www.bing.com/search?q={q}&count=20",
    "https://www.google.com/search?q={q}&tbs=qdr:d&num=20&gbv=1",
]

JINA_ENGINES = [
    ("jina@DDG", "https://html.duckduckgo.com/html/?q={q}"),
    ("jina@Bing", "https://www.bing.com/search?q={q}&count=20"),
]

RUN_BUDGET_SECONDS = 150
FETCH_TIMEOUT_MS = 30_000


def jina_fetch(url: str) -> str:
    """Fetch a URL through jina's render proxy (r.jina.ai). This is the only
    channel that returns real SERP content from a datacenter IP."""
    q = urllib.parse.quote(url)
    req = urllib.request.Request(
        f"https://r.jina.ai/{q}",
        headers={"User-Agent": UA, "X-Timeout": "30"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


class SearchReq(BaseModel):
    keywords: str
    limit: int = 20


def is_job_posting(text: str) -> bool:
    return bool(HIRING_HINTS.search(text) and ROLE_HINTS.search(text))


def within_24h(dt: Optional[datetime]) -> bool:
    if not dt:
        return False
    try:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt) <= timedelta(hours=24)
    except Exception:
        return False


def gnrss_candidates(keywords: str) -> list[dict]:
    q = urllib.parse.quote(f"site:linkedin.com/posts {keywords}")
    url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            xml = r.read().decode("utf-8", "ignore")
    except Exception:
        return []
    out = []
    for it in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title_m = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", it, re.S)
        link_m = re.search(r"<link>(.*?)</link>", it, re.S)
        date_m = re.search(r"<pubDate>(.*?)</pubDate>", it, re.S)
        if not title_m or not link_m:
            continue
        title = title_m.group(1).strip()
        link = link_m.group(1).strip()
        pub_date = None
        if date_m:
            try:
                pub_date = parsedate_to_datetime(date_m.group(1))
            except Exception:
                pub_date = None
        out.append({"title": title, "link": link, "pubDate": pub_date})
    return out


def distinctive_phrase(text: str) -> str:
    t = re.sub(r"\s*[-–—|]\s*LinkedIn\s*$", "", text)
    t = re.sub(r"#[A-Za-z0-9_]+", " ", t)
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"[^\w\s'\-–—:;,()]", " ", t, flags=re.UNICODE)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) > 60:
        t = t[:60].rsplit(" ", 1)[0]
    return t


def extract_post_urls(html: str) -> list[str]:
    found = []
    for m in re.finditer(r"uddg=([^&\"\s\)]+)", html):
        try:
            u = urllib.parse.unquote(m.group(1))
        except Exception:
            continue
        if "linkedin.com/posts/" in u or "linkedin.com/feed/update/" in u:
            found.append(u)
    for m in re.finditer(
        r"https://www\.linkedin\.com/(?:posts/[A-Za-z0-9_-]+|feed/update/urn:li:activity:[0-9]+)",
        html,
    ):
        found.append(m.group(0))
    return found


def resolve_real_url(text: str) -> tuple[Optional[str], int, set[str]]:
    """Resolve a candidate to its real LinkedIn post URL. The datacenter IP is
    blocked/poisoned on every raw SERP (Google 429, Bing garbage, DDG challenge),
    so jina's render proxy is tried first (proven channel) — the stealth browser
    stays as the fallback layer (it wins where fingerprint blocking is the
    issue, e.g. on residential/proxied egress). Returns (url, queriesTried,
    enginesUsed)."""
    phrase = distinctive_phrase(text)
    if len(phrase) < 20:
        return None, 0, set()
    queries = [f'site:linkedin.com/posts "{phrase}"', f'"{phrase}"']
    queries_tried = 0
    engines_used: set[str] = set()
    # Layer 1: jina render proxy — real SERP content from this datacenter IP.
    for q in queries:
        for name, template in JINA_ENGINES:
            url = template.format(q=urllib.parse.quote(q))
            queries_tried += 1
            try:
                txt = jina_fetch(url)
                engines_used.add(name)
                for u in extract_post_urls(txt):
                    return u, queries_tried, engines_used
            except Exception:
                continue
    # Layer 2: stealth browser directly (fingerprint-evading, no proxy).
    for q in queries:
        for template in SEARCH_ENGINES:
            url = template.format(q=urllib.parse.quote(q))
            queries_tried += 1
            try:
                page = StealthyFetcher.fetch(url, headless=True, network_idle=True, timeout=FETCH_TIMEOUT_MS)
                engines_used.add("StealthyFetcher")
                for u in extract_post_urls(page.html_content):
                    return u, queries_tried, engines_used
            except Exception:
                continue
    return None, queries_tried, engines_used


def og(html: str, prop: str) -> str:
    m = re.search(rf'<meta[^>]+property="og:{prop}"[^>]+content="([^"]*)"', html)
    if m:
        return m.group(1)
    m = re.search(rf'<meta[^>]+content="([^"]*)"[^>]+property="og:{prop}"', html)
    return m.group(1) if m else ""


def parse_relative_time(label: str) -> Optional[str]:
    m = re.match(r"(\d+)\s*(minute|hour|day)s?\s*ago", label, re.I)
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2).lower()
    now = datetime.now(timezone.utc)
    if unit == "minute":
        return (now - timedelta(minutes=n)).isoformat()
    if unit == "hour":
        return (now - timedelta(hours=n)).isoformat()
    return (now - timedelta(days=n)).isoformat()


def fetch_post(url: str) -> Optional[dict]:
    html = None
    try:
        page = StealthyFetcher.fetch(url, headless=True, network_idle=True, timeout=FETCH_TIMEOUT_MS)
        html = page.html_content
    except Exception:
        try:
            page = DynamicFetcher.fetch(url, headless=True, network_idle=True, timeout=FETCH_TIMEOUT_MS)
            html = page.html_content
        except Exception:
            return None
    if not html:
        return None

    title = og(html, "title").replace(" | LinkedIn", "").strip()
    text = og(html, "description").strip()
    if not text:
        ab = re.search(r'"articleBody"\s*:\s*"([^"]+)"', html)
        if ab:
            text = (
                ab.group(1)
                .replace("\\n", "\n")
                .replace("\\r", "")
                .replace("\\u003c", "<")
                .replace("\\u003e", ">")
                .replace('\\"', '"')
                .strip()
            )
    if not text and not title:
        return None

    author = "LinkedIn"
    parts = [p.strip() for p in title.split(" | ") if p.strip()]
    if len(parts) >= 2 and parts[1] and not re.match(r"^\d+ comments?$", parts[1], re.I):
        author = parts[1]
    elif " on LinkedIn" in title:
        author = title.split(" on LinkedIn")[0].strip() or author

    date = None
    rel = re.search(r"(\d+ (?:minute|hour|day)s? ago)", html, re.I)
    if rel:
        date = parse_relative_time(rel.group(1))
    else:
        ld = re.search(r'"datePublished"\s*:\s*"([^"]+)"', html)
        if ld:
            date = ld.group(1)

    apply_url = None
    ext = re.search(r'<a[^>]+href="(https?://(?!.*linkedin\.com)[^"]+)"[^>]*>[^<]*</a>', html)
    if ext:
        apply_url = ext.group(1).split("?")[0]
    if not apply_url:
        m2 = re.search(r"https?://(?!.*linkedin\.com|lnkd\.in)[^\s\"'<>)]+", text)
        if m2:
            apply_url = re.sub(r"[).,;:]+$", "", m2.group(0)).split("?")[0]

    hashtags = list(dict.fromkeys(re.findall(r"#[A-Za-z0-9_]+", text or title)))[:8]
    return {
        "author": author,
        "text": text or title,
        "date": date,
        "applyUrl": apply_url,
        "hashtags": hashtags,
    }


def serp_links_for_queries(queries: list[str], t0: float) -> tuple[list[str], int, set[str]]:
    """Run the (≤4) SERP queries once per search — NOT per candidate — and
    collect every unique LinkedIn post link. Keyless jina throttles at ~20
    req/min/IP, so queries are paced; the stealth browser is the fallback
    layer when jina is 403ing. Mirrors the proven free-engine strategy."""
    links: list[str] = []
    engines_used: set[str] = set()
    queries_tried = 0
    for q in queries:
        for name, template in JINA_ENGINES:
            if len(links) >= 12 or time.time() - t0 > RUN_BUDGET_SECONDS:
                break
            queries_tried += 1
            try:
                txt = jina_fetch(template.format(q=urllib.parse.quote(q)))
                engines_used.add(name)
                for u in extract_post_urls(txt):
                    if u not in links:
                        links.append(u)
            except Exception:
                pass
            time.sleep(4)  # respect the keyless jina burst limit
    if not links:
        for q in queries:
            for template in SEARCH_ENGINES:
                if time.time() - t0 > RUN_BUDGET_SECONDS:
                    break
                queries_tried += 1
                try:
                    page = StealthyFetcher.fetch(template.format(q=urllib.parse.quote(q)), headless=True, network_idle=True, timeout=FETCH_TIMEOUT_MS)
                    engines_used.add("StealthyFetcher")
                    for u in extract_post_urls(page.html_content):
                        if u not in links:
                            links.append(u)
                except Exception:
                    continue
    return links, queries_tried, engines_used


def find_matching_candidate(post_text: str, candidates: list[dict]) -> Optional[str]:
    """Find the GNRSS candidate whose announcement phrase appears inside the
    fetched post text — that candidate's Google-News token is the replacesUrl
    (the truncated stored copy that must be upgraded in place)."""
    pt = re.sub(r"\s+", " ", post_text).lower()
    for c in candidates:
        ph = distinctive_phrase(c["title"])
        if len(ph) >= 25 and ph.lower() in pt:
            return c["link"]
    return None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/search")
def search(req: SearchReq):
    keywords = req.keywords.strip()
    limit = max(1, min(100, req.limit))
    if not keywords:
        raise HTTPException(status_code=400, detail="keywords is required")

    t0 = time.time()
    candidates = [
        c
        for c in gnrss_candidates(keywords)
        if is_job_posting(c["title"]) and within_24h(c["pubDate"])
    ]
    debug = {"queriesTried": 1, "linksFound": 0, "postsFound": 0, "enginesUsed": 0}

    # ≤4 SERP queries per search: the top candidate's phrase and the raw
    # keywords, each as site: and plain. Links are collected once and reused.
    queries: list[str] = []
    top = candidates[0]["title"] if candidates else ""
    for src in dict.fromkeys([top, keywords]):
        if not src:
            continue
        queries.append(f'site:linkedin.com/posts "{src}"')
        queries.append(f'"{src}"')
    queries = queries[:4]

    links, queries_tried, engines_used = serp_links_for_queries(queries, t0)
    debug["queriesTried"] += queries_tried
    debug["enginesUsed"] = len(engines_used)
    debug["linksFound"] = len(links)

    posts = []
    for real in links:
        if len(posts) >= limit or time.time() - t0 > RUN_BUDGET_SECONDS:
            break
        post = None
        try:
            post = fetch_post(real)
        except Exception:
            post = None
        if not post or not is_job_posting(post["text"]):
            continue
        if post["date"] and not within_24h(post["date"]):
            continue

        first_line = next((l.strip() for l in post["text"].split("\n") if len(l.strip()) > 10), post["text"][:90])
        posts.append(
            {
                "title": first_line[:110],
                "description": post["text"][:3000],
                "author": post["author"],
                "url": real,
                "postedDate": post["date"],
                "applyUrl": post["applyUrl"],
                "hashtags": post["hashtags"],
                "replacesUrl": find_matching_candidate(post["text"], candidates),
            }
        )
        debug["postsFound"] += 1

    return {"ok": True, "debug": debug, "posts": posts}


from scrapling.fetchers import DynamicFetcher, StealthyFetcher  # noqa: E402