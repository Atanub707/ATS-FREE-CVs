import React, { useEffect, useRef, useState } from 'react';
import { FileText, Settings, FileInput, LogOut, ChevronDown, Globe } from 'lucide-react';
import { AtanuBadge } from './AtanuBadge';

interface NavbarProps {
  onOpenMasterCv: () => void;
  onOpenSettings: () => void;
  onOpenManualJd: () => void;
  onOpenJobPortals?: () => void;
  user?: { id: string; email: string; name: string; isGuest: boolean } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMasterCv,
  onOpenSettings,
  onOpenManualJd,
  onOpenJobPortals,
  user,
  onLogout,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Keyboard shortcuts matching the hint labels in the menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'j') { e.preventDefault(); onOpenManualJd(); }
      if (e.key === ',') { e.preventDefault(); onOpenSettings(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpenManualJd, onOpenSettings]);

  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || user.email[0].toUpperCase();

  const closeAnd = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const ddItemCls =
    'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border-none bg-transparent cursor-pointer font-inherit text-[13px] font-medium text-slate-700 text-left transition-colors duration-100 hover:bg-slate-100 active:bg-slate-200';
  const ddIconCls =
    'w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Clean Title */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            T
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight font-sans">
                Tailor CV
              </h1>
              <AtanuBadge />
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Job Search • AI ATS Matching • CV Tailoring & Export
            </p>
          </div>
        </div>

        {/* App-bar actions + account */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenJobPortals?.()}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-600 bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
            title="Browse 184 job portals worldwide"
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span>Job Portals</span>
          </button>

          <div className="relative" ref={rootRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`flex items-center gap-2 rounded-full bg-white border border-slate-200 pl-1 pr-3 py-1 cursor-pointer transition-all duration-150 hover:bg-slate-50 hover:border-slate-300 ${
              menuOpen ? 'border-slate-400 ring-2 ring-blue-500/15' : ''
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
                user.isGuest
                  ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                  : 'bg-gradient-to-br from-slate-700 to-slate-900'
              }`}
            >
              {initials}
            </span>
            <span className="hidden md:block text-xs font-semibold text-slate-900 max-w-28 truncate">
              {user.isGuest ? `Guest · ${user.name}` : user.name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-72 bg-white border border-slate-200 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)] p-1.5 origin-top-right animate-[dd_.15s_ease-out]"
            >
              {/* User card */}
              <div className="flex items-center gap-2.5 px-2.5 pb-3 pt-1.5 border-b border-slate-100 mb-1">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0 ${
                    user.isGuest
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                      : 'bg-gradient-to-br from-slate-700 to-slate-900'
                  }`}
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-900 truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  {user.isGuest && (
                    <span className="inline-flex items-center mt-1 text-[9.5px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                      Guest account
                    </span>
                  )}
                </div>
              </div>

              {/* Workspace */}
              <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Workspace
              </div>
              <button role="menuitem" onClick={closeAnd(onOpenMasterCv)} className={ddItemCls}>
                <span className={ddIconCls}>
                  <FileText className="w-4 h-4" />
                </span>
                Master Candidate CV
              </button>
              <button role="menuitem" onClick={closeAnd(onOpenManualJd)} className={ddItemCls}>
                <span className={ddIconCls}>
                  <FileInput className="w-4 h-4" />
                </span>
                Manual JD
                <span className="ml-auto text-[10px] text-slate-400 font-semibold">⌘J</span>
              </button>
              <button role="menuitem" onClick={closeAnd(() => onOpenJobPortals?.())} className={ddItemCls}>
                <span className={ddIconCls}>
                  <Globe className="w-4 h-4" />
                </span>
                Job Portals
                <span className="ml-auto text-[10px] text-slate-400 font-semibold">190+</span>
              </button>

              {/* System */}
              <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                System
              </div>
              <button role="menuitem" onClick={closeAnd(onOpenSettings)} className={ddItemCls}>
                <span className={ddIconCls}>
                  <Settings className="w-4 h-4" />
                </span>
                Settings
                <span className="ml-auto text-[10px] text-slate-400 font-semibold">⌘,</span>
              </button>

              {/* Sign out */}
              <div className="my-1.5 h-px bg-slate-100" />
              <button
                role="menuitem"
                onClick={closeAnd(() => onLogout?.())}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg border-none bg-transparent cursor-pointer font-inherit text-[13px] font-medium text-red-600 text-left transition-colors duration-100 hover:bg-red-50 active:bg-red-100"
              >
                <span className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
                  <LogOut className="w-4 h-4" />
                </span>
                Sign out
              </button>

              {/* Footer */}
              <div className="mt-1.5 border-t border-slate-100 px-2.5 pt-2 pb-1.5 flex justify-between text-[10.5px] text-slate-400">
                <span>v1.2.0 · local</span>
                <span>Data stays on this machine</span>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      <style>{`@keyframes dd { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </header>
  );
};
