import React, { useState, useEffect, useCallback } from 'react';
import { X, MagnifyingGlass, ArrowSquareOut, Sparkle } from '@phosphor-icons/react';

interface PostResult {
  id: string;
  title: string;
  company: string;
  url: string;
  applyUrl?: string;
  postedDate?: string;
  description?: string;
  hashtags?: string[];
}

type SearchState = 'idle' | 'searching' | 'done' | 'error';

const RELATIVE = (iso?: string): string => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 3600000) return `${Math.max(1, Math.round(ms / 60000))} min ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)} hr ago`;
  return `${Math.round(ms / 86400000)} days ago`;
};

const DAY_LABEL = (iso?: string): string => {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Group saved posts by their (posted or saved) date, newest first.
const groupByDay = (items: PostResult[]): { label: string; items: PostResult[] }[] => {
  const groups = new Map<string, PostResult[]>();
  for (const p of items) {
    const key = DAY_LABEL(p.postedDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return [...groups.entries()].map(([label, list]) => ({ label, items: list }));
};

const PostCard: React.FC<{ p: PostResult }> = ({ p }) => (
  <div className="lp-card">
    <div className="lp-card-top">
      <span className="lp-avatar">{p.company?.charAt(0)?.toUpperCase() || 'L'}</span>
      <div className="lp-card-meta">
        <b>{p.title}</b>
        <span>{p.company}{p.postedDate ? ` · ${RELATIVE(p.postedDate)}` : ''}</span>
      </div>
    </div>
    {p.description && <p className="lp-card-text">{p.description}</p>}
    {p.hashtags && p.hashtags.length > 0 && (
      <div className="lp-tags">
        {p.hashtags.map((h) => <span key={h} className="lp-tag">{h}</span>)}
      </div>
    )}
    <div className="lp-card-actions">
      <a className="lp-link" href={p.url} target="_blank" rel="noreferrer">
        Open post <ArrowSquareOut size={12} weight="bold" />
      </a>
      {p.applyUrl && (
        <a className="lp-link apply" href={p.applyUrl} target="_blank" rel="noreferrer">
          Apply link <ArrowSquareOut size={12} weight="bold" />
        </a>
      )}
    </div>
  </div>
);

export const LinkedInPostsScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [addedCount, setAddedCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ queriesTried: number; linksFound: number } | null>(null);
  const [setup, setSetup] = useState<{ cookie: boolean; apify: boolean } | null>(null);
  const [feed, setFeed] = useState<PostResult[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => setSetup({ cookie: !!(c?.linkedin?.liAt), apify: !!(c?.apify?.enabled && c?.apify?.token) }))
      .catch(() => setSetup(null));
  }, []);

  // The saved feed persists in the database — surviving refresh. Loaded on
  // mount, grouped by date, and refreshed after every search.
  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?source=LinkedInPosts&sortBy=createdAt&sortOrder=desc&page=1&limit=100');
      if (!res.ok) return;
      const d = await res.json();
      setFeed(
        (d.jobs || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          url: j.url,
          applyUrl: j.applyUrl,
          postedDate: j.postedDate,
          description: j.description,
          hashtags: j.hashtags || [],
        }))
      );
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const search = async (raw?: string) => {
    const q = (raw ?? query).trim();
    if (!q || state === 'searching') return;
    setQuery(q);
    setState('searching');
    setError(null);
    setMessage(null);
    setPosts([]);
    try {
      const res = await fetch('/api/linkedin-posts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: q, limit: 20, engine: 'free' }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d?.error || 'Search failed.');
      }
      setPosts(d.posts || []);
      setAddedCount(d.addedCount || 0);
      setDebug(d.debug || null);
      setState('done');
      loadFeed();
      const window = 'from the last 24 hours ';
      if (d.valid === false) {
        setMessage(d.discoveryFailed
          ? `Search engines returned no results from this server (likely rate-limited or blocked — ${d.debug?.queriesTried ?? 0} queries tried). Try again in a minute.`
          : 'No recent job postings matched this search. Try a broader job role, e.g. "DevOps Engineer".');
      } else if (d.total === 0) {
        setMessage(`No job postings found ${window}for this search. Try broader keywords or search again later.`);
      } else if (d.addedCount > 0) {
        setMessage(`Found ${d.total} job postings ${window}— ${d.addedCount} new ones added to your job list.`);
      } else {
        setMessage(`Found ${d.total} job postings ${window}(all already in your job list).`);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not search LinkedIn posts.');
      setState('error');
    }
  };

  const busy = state === 'searching';

  return (
    <div className="lp-screen">
      <header className="lp-hdr">
        <div className="lp-hdr-logo"><span className="lp-orb" aria-hidden="true"></span></div>
        <div className="lp-hdr-ttl">
          <b>LinkedIn Posts</b>
          <span>Job openings recruiters share as posts — from the last 24 hours</span>
        </div>
        <div className="lp-spacer" />
        <button className="lp-x" onClick={onClose} aria-label="Close"><X size={18} weight="bold" /></button>
      </header>

      <div className="lp-body">
        {setup && !setup.apify && (
          <div className="lp-setup">
            <b>⚡ Free engine is active — no token needed</b>
            <p>Search runs through built-in search engines (Google/DuckDuckGo/Bing) — free and unlimited. The paid Apify engine is coming later.</p>
          </div>
        )}
        <div className="lp-hero">
          <span className="lp-eyebrow"><Sparkle size={12} weight="fill" /> Real-time job posts</span>
          <h1>Find jobs shared as LinkedIn posts</h1>
          <p>Recruiters announce openings in posts hours before formal listings. Search any role — we scrape the last 24 hours of LinkedIn posts and bring back the announcements with links.</p>

          {/* ChatGPT-style pill search bar */}
          <form
            className={`lp-search ${busy ? 'searching' : ''}`}
            onSubmit={(e) => { e.preventDefault(); search(); }}
            role="search"
          >
            <input
              className="lp-search-input"
              placeholder="Search job posts — e.g. DevOps Engineer, Cyber Security Engineer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search LinkedIn posts"
              autoFocus
            />
            {busy && <span className="lp-spin" aria-hidden="true"></span>}
            <button type="submit" className="lp-search-btn" disabled={busy || !query.trim()} aria-label="Search">
              <MagnifyingGlass size={19} weight="bold" />
            </button>
          </form>

          {/* Engine indicator — Free engine active. Apify engine is locked for
              now (unlock later); the toggle stays hidden until it ships. */}
          <div className="lp-engine" role="group" aria-label="Search engine">
            <span className="lp-engine-btn on" aria-current="true">
              <span className="lp-engine-dot">◉</span> Free engine
              <span className="lp-engine-sub">built-in · no token</span>
            </span>
            <span className="lp-quota free">Free · unlimited</span>
            <span className="lp-engine-locked" title="Apify engine will unlock later">✦ Apify engine — coming soon</span>
          </div>
          <p className="lp-hint">Job postings only · last 24 hours · unlimited · results are added to your job list with a “LinkedIn Posts” tag</p>
        </div>

        {error && <div className="lp-error">{error}</div>}
        {message && <div className="lp-msg">{message}</div>}
        {state === 'done' && debug && debug.linksFound === 0 && (
          <p className="lp-debug">Diagnostics: {debug.queriesTried} queries tried · {debug.enginesUsed ?? 0} engine(s) reached · {debug.linksFound} LinkedIn post links returned. Sources: Google News RSS + DuckDuckGo/Bing (via render proxy) — retry in a minute if the engines are rate-limiting.</p>
        )}

        {state === 'done' && posts.length > 0 && (
          <div className="lp-results">
            <div className="lp-results-head">
              <b>{posts.length} job postings from the last 24 hours</b>
              <span>{addedCount > 0 ? `+${addedCount} new in your job list` : 'all already saved'}</span>
            </div>
            <div className="lp-grid">
              {posts.map((p) => (
                <PostCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}

        {/* Persistent feed — saved in the DB, grouped by date, survives refresh */}
        {!feedLoading && feed.length > 0 && (
          <div className="lp-feed">
            <div className="lp-feed-title">
              <b>Your saved feed</b>
              <span>{feed.length} posts saved · kept in the database</span>
            </div>
            {groupByDay(feed).map((g) => (
              <div className="lp-feed-day" key={g.label}>
                <div className="lp-feed-day-hdr">
                  <span className="lp-feed-dot" aria-hidden="true"></span>
                  <b>{g.label}</b>
                  <em>{g.items.length} post{g.items.length === 1 ? '' : 's'}</em>
                </div>
                <div className="lp-grid">
                  {g.items.map((p) => (
                    <PostCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .lp-screen{position:fixed; inset:0; z-index:55; background:#F7F8FA; color:#0F172A; display:flex; flex-direction:column;
          font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;}
        .lp-hdr{display:flex; align-items:center; gap:13px; padding:0 28px; height:64px; border-bottom:1px solid #E2E8F0;
          background:rgba(255,255,255,.82); backdrop-filter:blur(12px); flex-shrink:0;}
        .lp-hdr-logo{display:inline-flex;}
        .lp-orb{width:30px; height:30px; border-radius:50%;
          background:radial-gradient(circle at 32% 28%, #fff 0%, #DBEAFE 9%, #7C3AED 42%, #2563EB 68%, #1E3A8A 100%);
          box-shadow:inset -6px -5px 10px rgba(30,58,138,.45), inset 4px 4px 8px rgba(255,255,255,.5), 0 6px 16px -6px rgba(37,99,235,.5);}
        .lp-hdr-ttl b{font-size:15px; font-weight:800; display:block; line-height:1.2;}
        .lp-hdr-ttl span{font-size:11px; color:#64748B; font-weight:500;}
        .lp-spacer{flex:1;}
        .lp-x{border:0; background:none; color:#64748B; cursor:pointer; padding:8px; border-radius:10px; display:inline-flex; transition:all .2s ease;}
        .lp-x:hover{background:#F1F5F9; color:#0F172A;}

        .lp-body{flex:1; overflow-y:auto; padding:44px 30px 60px;}
        .lp-hero{max-width:720px; margin:0 auto; text-align:center; display:flex; flex-direction:column; align-items:center;}
        .lp-eyebrow{display:inline-flex; align-items:center; gap:7px; font-size:10.5px; font-weight:800; letter-spacing:.16em; text-transform:uppercase;
          color:#7C3AED; background:#fff; border:1px solid #E9D5FF; border-radius:999px; padding:7px 16px; margin-bottom:18px; box-shadow:0 1px 3px rgba(15,23,42,.06);}
        .lp-hero h1{font-size:30px; font-weight:800; letter-spacing:-.045em; line-height:1.15;}
        .lp-hero p{font-size:13px; color:#475569; margin-top:10px; max-width:560px; line-height:1.7;}

        /* ChatGPT-style pill search bar */
        .lp-search{display:flex; align-items:center; gap:10px; width:100%; max-width:620px; margin:30px auto 0;
          background:#fff; border:1.5px solid #CBD5E1; border-radius:999px; padding:7px 7px 7px 24px;
          box-shadow:0 4px 18px -8px rgba(15,23,42,.12), 0 2px 6px -3px rgba(15,23,42,.06);
          transition:border-color .2s ease, box-shadow .2s ease;}
        .lp-search:focus-within{border-color:#2563EB; box-shadow:0 0 0 4px rgba(37,99,235,.1), 0 8px 24px -10px rgba(15,23,42,.14);}
        .lp-search-input{flex:1; border:0; outline:none; background:none; font-size:14px; color:#0F172A; font-family:inherit; padding:9px 0;}
        .lp-search-input::placeholder{color:#94A3B8;}
        .lp-search-btn{width:46px; height:46px; border-radius:50%; border:0; display:inline-flex; align-items:center; justify-content:center;
          background:linear-gradient(135deg,#2563EB,#1D4ED8); color:#fff; cursor:pointer; transition:filter .2s ease, transform .15s ease; flex-shrink:0;
          box-shadow:0 8px 18px -8px rgba(37,99,235,.6);}
        .lp-search-btn:hover{filter:brightness(1.08);}
        .lp-search-btn:active{transform:scale(.96);}
        .lp-search-btn:disabled{opacity:.5; cursor:not-allowed;}
        .lp-spin{width:18px; height:18px; border-radius:50%; border:2.5px solid #DBEAFE; border-top-color:#2563EB; animation:lpRot .7s linear infinite; flex-shrink:0;}
        @keyframes lpRot{to{transform:rotate(360deg)}}
        .lp-hint{font-size:11px; color:#64748B; margin-top:12px; font-weight:600;}
        .lp-engine{display:flex; align-items:center; justify-content:center; gap:9px; margin-top:18px; flex-wrap:wrap;}
        .lp-engine-btn{display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#475569; cursor:pointer;
          background:#fff; border:1.5px solid #CBD5E1; border-radius:999px; padding:8px 15px; transition:all .18s ease; font-family:inherit;}
        .lp-engine-btn .lp-engine-sub{font-size:10px; font-weight:600; color:#94A3B8;}
        .lp-engine-btn.on{border-color:#2563EB; color:#1D4ED8; background:#EFF6FF; box-shadow:0 0 0 3px rgba(37,99,235,.12);}
        .lp-engine-btn:disabled{opacity:.45; cursor:not-allowed;}
        .lp-engine-dot{font-size:13px; line-height:1;}
        .lp-quota{font-size:11px; font-weight:800; color:#7C3AED; background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:6px 13px;}
        .lp-quota.out{color:#DC2626; background:#FEF2F2; border-color:#FECACA;}
        .lp-quota.free{color:#15803D; background:#F0FDF4; border-color:#BBF7D0;}
        .lp-engine-locked{font-size:11px; font-weight:800; color:#94A3B8; background:#F1F5F9; border:1px dashed #CBD5E1; border-radius:999px; padding:6px 13px; cursor:not-allowed;}
        .lp-debug{max-width:620px; margin:12px auto 0; font-size:10.5px; color:#94A3B8; text-align:center; line-height:1.6;}
        .lp-setup{max-width:620px; margin:0 auto 22px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:14px; padding:15px 18px;}
        .lp-setup b{display:block; font-size:12.5px; font-weight:800; color:#92400E; margin-bottom:4px;}
        .lp-setup p{font-size:11.5px; color:#B45309; line-height:1.65;}

        .lp-error{align-self:center; font-size:12px; font-weight:700; color:#DC2626; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:10px 15px;}
        .lp-msg{max-width:620px; margin:26px auto 0; font-size:12.5px; font-weight:700; color:#475569; background:#fff;
          border:1px solid #E2E8F0; border-radius:13px; padding:13px 17px; box-shadow:0 1px 3px rgba(15,23,42,.05); text-align:center;}

        .lp-results{max-width:900px; margin:34px auto 0;}
        .lp-results-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding:0 2px;}
        .lp-results-head b{font-size:15px; font-weight:800;}
        .lp-results-head span{font-size:11px; font-weight:800; color:#7C3AED; background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:4px 12px;}
        .lp-feed{max-width:900px; margin:44px auto 0; border-top:1px dashed #E2E8F0; padding-top:30px;}
        .lp-feed-title{display:flex; align-items:baseline; gap:10px; margin-bottom:6px; padding:0 2px;}
        .lp-feed-title b{font-size:16px; font-weight:800;}
        .lp-feed-title span{font-size:11px; color:#94A3B8; font-weight:600;}
        .lp-feed-day{margin-top:20px;}
        .lp-feed-day-hdr{display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:0 2px;}
        .lp-feed-day-hdr b{font-size:12.5px; font-weight:800; color:#334155;}
        .lp-feed-day-hdr em{font-size:10.5px; font-style:normal; font-weight:700; color:#94A3B8;}
        .lp-feed-dot{width:7px; height:7px; border-radius:50%; background:linear-gradient(135deg,#7C3AED,#2563EB); flex-shrink:0;}
        .lp-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px;}
        .lp-card{background:#fff; border:1px solid #E2E8F0; border-radius:16px; padding:18px 19px; box-shadow:0 1px 3px rgba(15,23,42,.05);
          display:flex; flex-direction:column; gap:11px; transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;}
        .lp-card:hover{border-color:#C7D2FE; box-shadow:0 10px 26px -12px rgba(15,23,42,.16); transform:translateY(-2px);}
        .lp-card-top{display:flex; align-items:center; gap:11px;}
        .lp-avatar{width:38px; height:38px; border-radius:11px; background:linear-gradient(135deg,#7C3AED,#2563EB); color:#fff; font-weight:800; font-size:14px;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;}
        .lp-card-meta{min-width:0;}
        .lp-card-meta b{display:block; font-size:13px; font-weight:800; line-height:1.35;}
        .lp-card-meta span{font-size:11px; color:#64748B; display:inline-flex; align-items:center; gap:5px;}
        .lp-tags{display:flex; flex-wrap:wrap; gap:6px;}
        .lp-tag{font-size:10.5px; font-weight:800; color:#7C3AED; background:#F5F3FF; border:1px solid #E9D5FF; border-radius:999px; padding:3px 10px;}
        .lp-card-text{font-size:12px; color:#475569; line-height:1.6; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;}
        .lp-card-actions{display:flex; gap:9px; margin-top:auto; padding-top:2px;}
        .lp-link{display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:800; color:#2563EB; text-decoration:none;
          background:#EFF6FF; border:1px solid #BFDBFE; border-radius:999px; padding:6px 12px; transition:all .18s ease;}
        .lp-link:hover{background:#DBEAFE;}
        .lp-link.apply{color:#7C3AED; background:#F5F3FF; border-color:#E9D5FF;}
        .lp-link.apply:hover{background:#EDE9FE;}
        @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important; transition:none !important;}}
      `}</style>
    </div>
  );
};
