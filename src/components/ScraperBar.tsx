import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Globe,
  Play,
  Loader2,
  CheckCircle2,
  Linkedin,
  ChevronDown,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { JobSource } from '../types';
import { PREDEFINED_ROLES, PREDEFINED_KEYWORDS, PREDEFINED_LOCATIONS } from '../constants/suggestions';

interface ScraperBarProps {
  onScrape: (params: {
    keywords: string;
    location: string;
    sources: JobSource[];
    datePostedFilter: 'all' | '24h' | '7d' | '30d';
    minSalary?: number;
    maxJobsPerSource?: number;
  }) => Promise<{ scrapedTotal: number; addedCount: number; skippedDuplicates: number } | void>;
  isLoading: boolean;
}

export const ScraperBar: React.FC<ScraperBarProps> = ({ onScrape, isLoading }) => {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [datePostedFilter, setDatePostedFilter] = useState<'all' | '24h' | '7d' | '30d'>('24h');
  const [maxJobsPerSource, setMaxJobsPerSource] = useState<number>(15);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) return;

    setScrapeSuccessMsg(null);
    const result = await onScrape({
      keywords,
      location,
      sources: ['LinkedIn'],
      datePostedFilter,
      maxJobsPerSource,
    });

    if (result && result.scrapedTotal > 0) {
      if (result.addedCount > 0) {
        setScrapeSuccessMsg(`Scraped ${result.scrapedTotal} live postings! Added ${result.addedCount} new jobs to top (${result.skippedDuplicates} duplicates skipped).`);
      } else {
        setScrapeSuccessMsg(`Scraped ${result.scrapedTotal} live postings! (All ${result.skippedDuplicates} were already in your job list).`);
      }
    } else {
      setScrapeSuccessMsg(`Searched live postings on LinkedIn (${maxJobsPerSource} target jobs)!`);
    }
    setTimeout(() => setScrapeSuccessMsg(null), 7000);
  };

  return (
    <div className="bg-white border-b border-slate-200 py-4 text-slate-900">
      {/* Predefined Datalists for Native Auto-completion */}
      <datalist id="datalist-roles-keywords">
        {PREDEFINED_ROLES.map((role) => (
          <option key={role} value={role} />
        ))}
        {PREDEFINED_KEYWORDS.map((kw) => (
          <option key={kw} value={kw} />
        ))}
      </datalist>

      <datalist id="datalist-locations">
        {PREDEFINED_LOCATIONS.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Keywords */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Role / Keywords
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="input-scrape-keywords"
                list="datalist-roles-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Software Engineer 2 - Frontend..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="input-scrape-location"
                list="datalist-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Remote, Singapore, London..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date Posted
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="select-scrape-date"
                value={datePostedFilter}
                onChange={(e) => setDatePostedFilter(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all cursor-pointer appearance-none font-normal"
              >
                <option value="24h">Past 24 Hours</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
                <option value="all">Anytime</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Scrape Limit */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scrape Limit
            </label>
            <div className="relative">
              <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="select-scrape-limit"
                value={maxJobsPerSource}
                onChange={(e) => setMaxJobsPerSource(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all cursor-pointer appearance-none font-normal"
              >
                <option value={10}>10 Postings</option>
                <option value={15}>15 Postings</option>
                <option value={25}>25 Postings</option>
                <option value={50}>50 Postings</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quick Predefined Suggestion Chips */}
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-semibold flex items-center space-x-1 mr-1">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>Suggested Roles:</span>
            </span>
            {PREDEFINED_ROLES.slice(0, 5).map((role) => (
              <button
                type="button"
                key={role}
                onClick={() => setKeywords(role)}
                className={`px-2 py-0.5 rounded-md border text-[11px] transition-all cursor-pointer ${
                  keywords === role
                    ? 'bg-slate-900 text-white border-slate-900 font-medium'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-semibold mr-1">Locations:</span>
            {PREDEFINED_LOCATIONS.map((loc) => (
              <button
                type="button"
                key={loc}
                onClick={() => setLocation(loc)}
                className={`px-2 py-0.5 rounded-md border text-[11px] transition-all cursor-pointer ${
                  location === loc
                    ? 'bg-slate-900 text-white border-slate-900 font-medium'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Source Selector Controls & Scrape Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Target Source Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold flex items-center space-x-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Source:</span>
            </span>

            {/* LinkedIn Active Badge */}
            <div className="px-2.5 py-1 rounded-md text-xs font-semibold border flex items-center space-x-1.5 bg-blue-50 text-blue-700 border-blue-300">
              <Linkedin className="w-3.5 h-3.5 text-blue-600" />
              <span>LinkedIn Live Jobs</span>
              <CheckCircle2 className="w-3 h-3 text-blue-600 ml-0.5" />
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {scrapeSuccessMsg && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{scrapeSuccessMsg}</span>
              </span>
            )}

            <button
              type="submit"
              disabled={isLoading}
              id="btn-scrape-submit"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scraping LinkedIn Jobs...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Scrape LinkedIn Jobs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
