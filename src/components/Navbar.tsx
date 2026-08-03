import React from 'react';
import { FileText, Settings, FileInput, LogOut, UserCircle2 } from 'lucide-react';

interface NavbarProps {
  onOpenMasterCv: () => void;
  onOpenSettings: () => void;
  onOpenManualJd: () => void;
  user?: { id: string; email: string; name: string; isGuest: boolean } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMasterCv,
  onOpenSettings,
  onOpenManualJd,
  user,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Clean Title */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-xs">
            JM
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight font-sans">
                ATS CV Tailor
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Multi-Source
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Job Search • AI ATS Matching • CV Tailoring & Export
            </p>
          </div>
        </div>

        {/* Minimal Action Controls */}
        <div className="flex items-center space-x-2">
          {user && (
            <div className="hidden md:flex items-center space-x-1.5 mr-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <UserCircle2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 max-w-32 truncate">
                {user.isGuest ? `Guest · ${user.name}` : user.name}
              </span>
              <button
                onClick={onLogout}
                className="ml-1 p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={onOpenManualJd}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
          >
            <FileInput className="w-3.5 h-3.5 text-indigo-600" />
            <span className="whitespace-nowrap">Manual JD</span>
          </button>

          <button
            onClick={onOpenMasterCv}
            id="btn-master-cv"
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span className="whitespace-nowrap">Master Candidate CV</span>
          </button>

          <button
            onClick={onOpenSettings}
            id="btn-settings"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
            title="System Configuration"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
