import React, { useState, useMemo } from 'react';
import { ArrowLeft, Globe, Search, ExternalLink, Sparkles, TrendingUp, X } from 'lucide-react';
import { JOB_PORTALS, PORTAL_CATEGORIES, JobPortal } from '../constants/jobPortals';

interface JobPortalsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Deterministic gradient per portal name — tasteful, not rainbow
const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-slate-700 to-slate-900',
  'from-emerald-600 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-violet-600 to-purple-700',
  'from-rose-500 to-pink-600',
  'from-cyan-600 to-sky-700',
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

  const grouped = useMemo(() => {
    if (category !== 'all' || search) return [];
    return PORTAL_CATEGORIES.map((c) => ({ id: c.id, portals: filtered.filter((p) => p.category === c.id) }))
      .filter((g) => g.portals.length > 0);
  }, [filtered, category, search]);

  const total = JOB_PORTALS.length;

  if (!isOpen) return null;

  const PortalCard = ({ p, key }: { p: JobPortal; key?: React.Key }) => (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
    >
      <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGradient(p.name)} flex items-center justify-center text-sm font-extrabold text-white shadow-sm shrink-0`}>
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
      <span className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 shrink-0 transition-colors">
        <ExternalLink className="w-3.5 h-3.5" />
      </span>
    </a>
  );

  return (
    <div className="fixed inset-0 z-40 bg-[#F7F8FA] text-slate-900 flex flex-col">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/25">
            <Globe className="w-4 h-4 text-white" />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold text-slate-900 leading-tight">Job Portals</h2>
            <p className="text-[10.5px] text-slate-400 font-medium">Apply anywhere in the world</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          {total} portals · {PORTAL_CATEGORIES.length} regions
        </span>
      </div>

      {/* Hero search */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Find your next job on <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">184 portals</span>
            </h1>
            <p className="text-[12px] text-slate-500 mt-1.5">
              Search by name or browse by region — click any portal to apply directly
            </p>
          </div>

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
          {/* Popular */}
          {popular.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wider">Most Popular</span>
                <span className="flex-1 h-px bg-gradient-to-r from-amber-200 to-transparent" />
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
