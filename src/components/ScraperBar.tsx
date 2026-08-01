import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Globe,
  Play,
  Loader2,
  CheckCircle2,
  ChevronDown,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { JobSource } from '../types';
import { PREDEFINED_LOCATIONS, getRoleSuggestions, getKeywordSuggestions, detectDomains } from '../constants/suggestions';

interface ScraperBarProps {
  onScrape: (params: {
    keywords: string;
    location: string;
    sources: JobSource[];
    datePostedFilter: 'all' | '24h' | '7d' | '30d';
    minSalary?: number;
    maxJobsPerSource?: number;
    experienceLevel?: string;
    under10Applicants?: boolean;
  }) => Promise<{ scrapedTotal: number; addedCount: number; skippedDuplicates: number } | void>;
  isLoading: boolean;
}

export const ScraperBar: React.FC<ScraperBarProps> = ({ onScrape, isLoading }) => {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [datePostedFilter, setDatePostedFilter] = useState<'all' | '24h' | '7d' | '30d'>('24h');
  const [experienceLevel, setExperienceLevel] = useState<'all' | 'entry' | 'mid' | 'senior' | 'lead'>('all');
  const [maxJobsPerSource, setMaxJobsPerSource] = useState<number>(15);
  const [under10Applicants, setUnder10Applicants] = useState(false);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<JobSource[]>(['LinkedIn']);

  const roleSuggestions = getRoleSuggestions(keywords);
  const keywordSuggestions = getKeywordSuggestions(keywords);
  const matchedDomains = detectDomains(keywords);

  const toggleSource = (source: JobSource) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) return;

    setScrapeSuccessMsg(null);
    const result = await onScrape({
      keywords: keywords.trim(),
      location,
      sources: selectedSources,
      datePostedFilter,
      maxJobsPerSource,
      experienceLevel,
      under10Applicants,
    });

    if (result && result.scrapedTotal > 0) {
      if (result.addedCount > 0) {
        setScrapeSuccessMsg(`Scraped ${result.scrapedTotal} live postings! Added ${result.addedCount} new jobs to top (${result.skippedDuplicates} duplicates skipped).`);
      } else {
        setScrapeSuccessMsg(`Scraped ${result.scrapedTotal} live postings! (All ${result.skippedDuplicates} were already in your job list).`);
      }
    } else {
      const srcList = selectedSources.join(' + ');
      setScrapeSuccessMsg(`Searched ${srcList} — No results found. Try changing filters or keywords.`);
    }
    setTimeout(() => setScrapeSuccessMsg(null), 7000);
  };

  return (
    <div className="bg-white border-b border-slate-200 py-4 text-slate-900">
      {/* Predefined Datalists for Native Auto-completion */}
      <datalist id="datalist-roles-keywords">
        {roleSuggestions.map((role) => (
          <option key={role} value={role} />
        ))}
        {keywordSuggestions.map((kw) => (
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
          <div className="lg:col-span-2">
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
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Posted</label>
            <div className="relative">
              <select
                value={datePostedFilter}
                onChange={(e) => setDatePostedFilter(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-6 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all cursor-pointer appearance-none font-normal"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">Anytime</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Experience Level */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Level</label>
            <div className="relative">
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-6 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all cursor-pointer appearance-none font-normal"
              >
                <option value="all">Any</option>
                <option value="entry">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
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

        {/* Advanced Filters */}
        <div className="flex items-center gap-3 text-[11px]">
          <label className="flex items-center space-x-2 cursor-pointer text-slate-600 hover:text-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={under10Applicants}
              onChange={(e) => setUnder10Applicants(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-medium">Under 10 applicants (LinkedIn)</span>
          </label>
          {under10Applicants && (
            <span className="text-amber-600 text-[10px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              ⚡ Less competition — faster responses
            </span>
          )}
        </div>

        {/* Quick Predefined Suggestion Chips */}
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-semibold flex items-center space-x-1 mr-1">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>Suggested Roles{matchedDomains.length > 0 ? ` (${matchedDomains[0].label})` : ''}:</span>
            </span>
            {roleSuggestions.slice(0, 5).map((role) => (
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

          {matchedDomains.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-indigo-500 font-semibold mr-1">Related Skills:</span>
              {keywordSuggestions.slice(0, 8).map((kw) => (
                <button
                  type="button"
                  key={kw}
                  onClick={() => setKeywords(kw)}
                  className={`px-2 py-0.5 rounded-md border text-[11px] transition-all cursor-pointer ${
                    keywords === kw
                      ? 'bg-indigo-600 text-white border-indigo-600 font-medium'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}
                >
                  {kw}
                </button>
              ))}
            </div>
          )}

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
              <span>Sources:</span>
            </span>

            {(['LinkedIn', 'Arbeitnow', 'SimplyHired', 'Dice', 'Reed', 'Greenhouse', 'Lever', 'RemoteOK', 'WeWorkRemotely'] as const).map((src) => {
              const isComingSoon = src === 'WeWorkRemotely' || src === 'RemoteOK';
              return (
                <button key={src} type="button"
                  onClick={() => !isComingSoon && toggleSource(src)}
                  disabled={isComingSoon}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                    isComingSoon
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      : selectedSources.includes(src)
                      ? src === 'LinkedIn' ? 'bg-blue-50 text-blue-700 border-blue-300 cursor-pointer'
                      : src === 'RemoteOK' ? 'bg-cyan-50 text-cyan-700 border-cyan-300 cursor-pointer'
                      : src === 'WeWorkRemotely' ? 'bg-violet-50 text-violet-700 border-violet-300 cursor-pointer'
                      : src === 'Arbeitnow' ? 'bg-emerald-50 text-emerald-700 border-emerald-300 cursor-pointer'
                      : src === 'SimplyHired' ? 'bg-teal-50 text-teal-700 border-teal-300 cursor-pointer'
                      : src === 'Dice' ? 'bg-purple-50 text-purple-700 border-purple-300 cursor-pointer'
                      : src === 'Reed' ? 'bg-rose-50 text-rose-700 border-rose-300 cursor-pointer'
                      : src === 'Greenhouse' ? 'bg-green-50 text-green-700 border-green-300 cursor-pointer'
                      : 'bg-orange-50 text-orange-700 border-orange-300 cursor-pointer'
                      : 'bg-slate-100 text-slate-500 border-slate-200 cursor-pointer'
                  }`}
                >
                  {src} {isComingSoon ? 'Coming Soon' : selectedSources.includes(src) ? '✓' : ''}
                </button>
              );
            })}

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
                  <span>Searching jobs...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Search Jobs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
