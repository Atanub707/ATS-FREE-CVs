import React from 'react';
import { FileText, Settings } from 'lucide-react';

interface NavbarProps {
  onOpenMasterCv: () => void;
  onOpenSettings: () => void;
  totalJobs: number;
  matchedCount: number;
  tailoredCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMasterCv,
  onOpenSettings,
  totalJobs,
  matchedCount,
  tailoredCount,
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
                Job Matrix & ATS CV Tailor
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                LinkedIn Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              LinkedIn Job Scraper • Gemini AI ATS Alignment • Calibri .docx Export
            </p>
          </div>
        </div>

        {/* Minimalist Metrics Badge */}
        <div className="hidden lg:flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Scraped:</span>
            <span className="font-bold text-slate-900">{totalJobs}</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Scored:</span>
            <span className="font-bold text-blue-600">{matchedCount}</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Tailored CVs:</span>
            <span className="font-bold text-emerald-600">{tailoredCount}</span>
          </div>
        </div>

        {/* Minimal Action Controls */}
        <div className="flex items-center space-x-2">
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
