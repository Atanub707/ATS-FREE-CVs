import React, { useState, useMemo } from 'react';
import { ArrowLeft, Globe, Search, ExternalLink } from 'lucide-react';
import { JOB_PORTALS, PORTAL_CATEGORIES } from '../constants/jobPortals';

interface JobPortalsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JobPortalsScreen: React.FC<JobPortalsScreenProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return JOB_PORTALS.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, category]);

  const grouped = useMemo(() => {
    if (category !== 'all') return [{ id: category, portals: filtered }];
    return PORTAL_CATEGORIES.map((c) => ({ id: c.id, portals: filtered.filter((p) => p.category === c.id) }))
      .filter((g) => g.portals.length > 0);
  }, [filtered, category]);

  if (!isOpen) return null;

  const total = JOB_PORTALS.length;

  return (
    <div className="fixed inset-0 z-40 bg-white text-slate-900 flex flex-col">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <Globe className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Job Portals Directory</h2>
            <p className="text-[10.5px] text-slate-400 font-medium">{total} verified portals across 13 regions — click any portal to apply directly</p>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/60 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search portals by name or URL…"
              className="flex-1 bg-transparent outline-none text-xs text-slate-800 placeholder-slate-400"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer outline-none"
          >
            <option value="all">All regions ({total})</option>
            {PORTAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label} ({JOB_PORTALS.filter((p) => p.category === c.id).length})</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-5 space-y-6">
          {grouped.length === 0 && (
            <div className="text-center py-16">
              <Globe className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">No portals match "{search}"</p>
              <p className="text-[11px] text-slate-400 mt-1">Try a different name or region.</p>
            </div>
          )}
          {grouped.map((g) => {
            const meta = PORTAL_CATEGORIES.find((c) => c.id === g.id);
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-[12px] font-extrabold text-slate-800">{meta?.label || g.id}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{meta?.description}</span>
                  <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{g.portals.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {g.portals.map((p) => (
                    <a
                      key={p.name}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-500 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                        {p.name[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-slate-800 truncate">{p.name}</span>
                        <span className="block text-[10.5px] text-slate-400 truncate">{p.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
