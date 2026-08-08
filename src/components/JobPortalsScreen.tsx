import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Globe, Search, ExternalLink, Sparkles, TrendingUp, X, Bookmark } from 'lucide-react';
import { JOB_PORTALS, PORTAL_CATEGORIES, JobPortal } from '../constants/jobPortals';

interface JobPortalsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Deterministic solid color per portal name
const AVATAR_GRADIENTS = [
  'bg-blue-600',
  'bg-slate-800',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-violet-600',
  'bg-rose-500',
  'bg-cyan-600',
];

function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

const POPULAR_NAMES = new Set([
  'Indeed', 'LinkedIn Jobs', 'Glassdoor', 'Monster', 'ZipRecruiter', 'Naukri',
  'Reed', 'Seek (AU)', 'Wellfound (AngelList)', 'Himalayas', 'RemoteOK', 'MyCareersFuture (SG Gov)',
]);

export const JobPortalsScreen: React.FC<JobPortalsScreenProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [featured, setFeatured] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Load bookmarks when the screen opens
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/portals/bookmarks')
      .then((r) => r.json())
      .then((d) => setBookmarks(new Set(d.bookmarks || [])))
      .catch(() => setBookmarks(new Set()));
  }, [isOpen]);

  const toggleBookmark = async (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isBookmarked = bookmarks.has(name);
    const url = isBookmarked
      ? `/api/portals/bookmarks/${encodeURIComponent(name)}`
      : '/api/portals/bookmarks';
    const res = await fetch(url, {
      method: isBookmarked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: isBookmarked ? undefined : JSON.stringify({ portalName: name }),
    });
    if (res.ok) {
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (isBookmarked) next.delete(name); else next.add(name);
        return next;
      });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return JOB_PORTALS.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, category]);

  const popular = useMemo(
    () => (featured && category === 'all' && !search ? JOB_PORTALS.filter((p) => POPULAR_NAMES.has(p.name)) : []),
    [featured, category, search]
  );

  const favorited = useMemo(
    () => (bookmarks.size > 0 && category === 'all' && !search ? JOB_PORTALS.filter((p) => bookmarks.has(p.name)) : []),
    [bookmarks, category, search]
  );

  const grouped = useMemo(() => {
    if (category !== 'all' || search) return [];
    return PORTAL_CATEGORIES.map((c) => ({ id: c.id, portals: filtered.filter((p) => p.category === c.id) }))
      .filter((g) => g.portals.length > 0);
  }, [filtered, category, search]);

  const total = JOB_PORTALS.length;

  if (!isOpen) return null;

  const PortalCard = (props: { p: JobPortal; key?: React.Key }) => {
    const { p } = props;
    const isBookmarked = bookmarks.has(p.name);
    return (
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
      >
        <span className={`w-10 h-10 rounded-xl ${avatarGradient(p.name)} flex items-center justify-center text-sm font-extrabold text-white shadow-sm shrink-0`}>
          {p.name[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block text-[13px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{p.name}</span>
            {POPULAR_NAMES.has(p.name) && (
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </span>
          <span className="block text-[10.5px] text-slate-400 truncate font-medium">
            {p.url.replace(/^https?:\/\/(www\.)?/, '')}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => toggleBookmark(p.name, e)}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this portal'}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
              isBookmarked
                ? 'bg-amber-50 border-amber-200 text-amber-500'
                : 'bg-slate-50 border-slate-100 text-slate-300 hover:bg-amber-50 hover:text-amber-400 hover:border-amber-200'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
          </button>
          <span className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </span>
      </a>
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#F7F8FA] text-slate-900 flex flex-col">
      {/* Header */}
      <div className="relative px-6 py-3.5 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Centered headline */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="flex items-center justify-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center">
              <Globe className="w-3 h-3 text-white" />
            </span>
            <h2 className="text-[15px] font-extrabold text-slate-900 leading-tight">
              Find your next job on <span className="text-blue-600">{total} portals</span>
            </h2>
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Search by name or browse by region — click any portal to apply directly</p>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          {total} portals · {PORTAL_CATEGORIES.length} regions
        </span>
      </div>

      {/* Search */}
      <div className="px-6 pt-5 pb-0 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
            <Search className="w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search portals — e.g. Japan, finance, tech, Singapore…"
              className="flex-1 bg-transparent outline-none text-[13.5px] text-slate-800 placeholder-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Region chips */}
          <div className="flex gap-1.5 mt-3.5 pb-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCategory('all')}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                category === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              All regions · {total}
            </button>
            {PORTAL_CATEGORIES.map((c) => {
              const count = JOB_PORTALS.filter((p) => p.category === c.id).length;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(active ? 'all' : c.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {c.label.split(' ')[0]} <span className={active ? 'text-blue-100' : 'text-slate-400 font-semibold'}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 space-y-7">
          {/* Favorites */}
          {favorited.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider">Favorites</span>
                <span className="text-[10.5px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{favorited.length}</span>
                <span className="flex-1 h-px bg-amber-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {favorited.map((p) => <PortalCard key={p.name} p={p} />)}
              </div>
            </div>
          )}

          {/* Popular */}
          {popular.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider">Most Popular</span>
                <span className="flex-1 h-px bg-amber-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {popular.map((p) => <PortalCard key={p.name} p={p} />)}
              </div>
            </div>
          )}

          {/* Search results / single region */}
          {(category !== 'all' || search) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider">
                  {category !== 'all' ? PORTAL_CATEGORIES.find((c) => c.id === category)?.label : `Results for “${search}”`}
                </span>
                <span className="text-[10.5px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{filtered.length}</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>
              {filtered.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3.5">
                    <Globe className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No portals found</p>
                  <p className="text-[11px] text-slate-400 mt-1">Try a different name, URL, or region.</p>
                  <button
                    onClick={() => { setSearch(''); setCategory('all'); }}
                    className="mt-4 px-4 py-2 rounded-lg text-[11.5px] font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filtered.map((p) => <PortalCard key={p.name} p={p} />)}
                </div>
              )}
            </div>
          )}

          {/* Region groups */}
          {grouped.map((g) => {
            const meta = PORTAL_CATEGORIES.find((c) => c.id === g.id);
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider">{meta?.label}</span>
                  <span className="text-[10.5px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">{g.portals.length}</span>
                  <span className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {g.portals.map((p) => <PortalCard key={p.name} p={p} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { scrollbar-width: none; }`}</style>
    </div>
  );
};
