import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Play,
  Loader2,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { JobSource } from '../types';
import { PREDEFINED_LOCATIONS, getRoleSuggestions, getKeywordSuggestions } from '../constants/suggestions';
import { getSourceFlag, getSourceCountry } from '../constants/sourceMeta';

interface ScraperBarProps {
  onScrape: (params: {
    keywords: string;
    location: string;
    sources: JobSource[];
    datePostedFilter: 'all' | '24h' | '7d' | '30d';
    jobType?: 'all' | 'remote' | 'onsite' | 'hybrid';
    minSalary?: number;
    maxJobsPerSource?: number;
    experienceLevel?: string;
    under10Applicants?: boolean;
  }) => Promise<{ scrapedTotal: number; addedCount: number; skippedDuplicates: number } | void>;
  isLoading: boolean;
}

const ALL_SOURCES: JobSource[] = ['LinkedIn', 'Arbeitnow', 'SimplyHired', 'Dice', 'Reed', 'MyCareersFuture', 'Cutshort', 'Gupy', 'JobsCh', 'Daijob', 'MyJobMag', 'RemoteOK', 'WeWorkRemotely'];
const COMING_SOON: JobSource[] = ['RemoteOK', 'WeWorkRemotely'];

export const ScraperBar: React.FC<ScraperBarProps> = ({ onScrape, isLoading }) => {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [datePostedFilter, setDatePostedFilter] = useState<'all' | '24h' | '7d' | '30d'>('24h');
  const [jobType, setJobType] = useState<'all' | 'remote' | 'onsite' | 'hybrid'>('remote');
  const [experienceLevel, setExperienceLevel] = useState<'all' | 'entry' | 'mid' | 'senior' | 'lead'>('all');
  const [maxJobsPerSource, setMaxJobsPerSource] = useState<number>(15);
  const [under10Applicants, setUnder10Applicants] = useState(false);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<JobSource[]>(['LinkedIn']);

  const roleSuggestions = getRoleSuggestions(keywords);
  const keywordSuggestions = getKeywordSuggestions(keywords);

  const toggleSource = (source: JobSource) => {
    if (COMING_SOON.includes(source)) return;
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
      jobType,
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

  const selectClass =
    'w-full appearance-none bg-white border-[1.5px] border-slate-200 rounded-[10px] pl-3 pr-9 py-[9px] text-[13px] font-medium text-slate-900 cursor-pointer transition-all hover:border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-[3px] focus:ring-indigo-500/10';

  return (
    <div className="bg-white border-b border-slate-200 py-5 text-slate-900">
      {/* Datalists for Native Auto-completion */}
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

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* ── Row 1: Hero Search ── */}
        <div className="flex items-center gap-3 bg-slate-50 border-[1.5px] border-slate-200 rounded-xl pl-4 pr-1.5 py-1.5 transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]">
          <Search className="w-[18px] h-[18px] text-slate-400 shrink-0" />
          <input
            type="text"
            id="input-scrape-keywords"
            list="datalist-roles-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Search role, skills, or job title — e.g. 'DevOps Engineer'"
            className="flex-1 border-none outline-none bg-transparent text-[15px] font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal py-2"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            id="btn-scrape-submit"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-[9px] px-5 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
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

        {/* ── Row 2: Filter Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Location */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Location</label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="input-scrape-location"
                list="datalist-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Worldwide"
                className="w-full bg-white border-[1.5px] border-slate-200 rounded-[10px] pl-8 pr-3 py-[9px] text-[13px] font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-all hover:border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-[3px] focus:ring-indigo-500/10"
              />
            </div>
          </div>

          {/* Job Type */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Job Type</label>
            <div className="relative">
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as any)}
                className={selectClass}
              >
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
                <option value="all">All</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Posted */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Posted</label>
            <div className="relative">
              <select
                value={datePostedFilter}
                onChange={(e) => setDatePostedFilter(e.target.value as any)}
                className={selectClass}
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">Anytime</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Level */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Level</label>
            <div className="relative">
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as any)}
                className={selectClass}
              >
                <option value="all">Any level</option>
                <option value="entry">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Limit */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Limit</label>
            <div className="relative">
              <select
                id="select-scrape-limit"
                value={maxJobsPerSource}
                onChange={(e) => setMaxJobsPerSource(Number(e.target.value))}
                className={selectClass}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Under 10 applicants */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Competition</label>
            <label className="flex items-center gap-2 bg-white border-[1.5px] border-slate-200 rounded-[10px] px-3 py-[9px] cursor-pointer transition-all hover:border-slate-300">
              <input
                type="checkbox"
                checked={under10Applicants}
                onChange={(e) => setUnder10Applicants(e.target.checked)}
                className="accent-indigo-600 w-[15px] h-[15px] cursor-pointer"
              />
              <span className="text-[12px] font-medium text-slate-600 truncate">Under 10 applicants</span>
            </label>
          </div>
        </div>

        {/* ── Row 3: Source Pills with Flags ── */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-slate-500 pt-[7px] whitespace-nowrap">Sources</span>
            <div className="flex flex-wrap gap-2">
              {ALL_SOURCES.map((src) => {
                const isComingSoon = COMING_SOON.includes(src);
                const isSelected = selectedSources.includes(src);
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => toggleSource(src)}
                    disabled={isComingSoon}
                    title={isComingSoon ? `${src} — Coming soon` : `${src} — ${getSourceCountry(src)}`}
                    className={`inline-flex items-center gap-[7px] pl-2 pr-3 py-[5px] rounded-full text-[12px] font-medium border-[1.5px] transition-all whitespace-nowrap ${
                      isComingSoon
                        ? 'opacity-45 cursor-not-allowed bg-white border-slate-200 text-slate-500'
                        : isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <span className="text-[13px] leading-none">{getSourceFlag(src)}</span>
                    <span>{src}</span>
                    {isComingSoon && (
                      <span className="text-[9px] font-bold uppercase text-slate-400">Soon</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {scrapeSuccessMsg && (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{scrapeSuccessMsg}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
