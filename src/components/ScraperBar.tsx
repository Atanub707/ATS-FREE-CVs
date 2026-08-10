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
    contractType?: string;
    experienceLevel?: string;
    under10Applicants?: boolean;
  }) => Promise<{ scrapedTotal: number; addedCount: number; skippedDuplicates: number; filteredOutCount?: number; skippedSources?: { source: string; reason: string }[]; newContacts?: { name: string | null; email: string | null; phone: string | null; whatsapp: boolean; recruiterUrl: string | null; company: string }[] } | void>;
  isLoading: boolean;
}

const ALL_SOURCES: JobSource[] = ['LinkedIn', 'Arbeitnow', 'SimplyHired', 'Dice', 'Reed', 'MyCareersFuture', 'Cutshort', 'Gupy', 'JobsCh', 'Daijob', 'MyJobMag', 'RemoteOK', 'WeWorkRemotely'];
const COMING_SOON: JobSource[] = ['RemoteOK', 'WeWorkRemotely'];

export const ScraperBar: React.FC<ScraperBarProps> = ({ onScrape, isLoading }) => {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [datePostedFilter, setDatePostedFilter] = useState<'all' | '24h' | '7d' | '30d'>('24h');
  const [jobType, setJobType] = useState<'all' | 'remote' | 'onsite' | 'hybrid'>('remote');
  const [jobTypeInfoOpen, setJobTypeInfoOpen] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [contractType, setContractType] = useState('');
  const [maxJobsPerSource, setMaxJobsPerSource] = useState<number>(10);
  const [under10Applicants, setUnder10Applicants] = useState(false);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);
  const [scrapeNewContacts, setScrapeNewContacts] = useState<{ name: string | null; email: string | null; phone: string | null; whatsapp: boolean; recruiterUrl: string | null }[]>([]);
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
    setScrapeNewContacts([]);
    const result = await onScrape({
      keywords: keywords.trim(),
      location,
      sources: selectedSources,
      datePostedFilter,
      jobType,
      maxJobsPerSource,
      contractType: contractType || undefined,
      experienceLevel: experienceLevel || undefined,
      under10Applicants,
    });

    if (result && result.scrapedTotal > 0) {
      const filterNote = result.filteredOutCount && result.filteredOutCount > 0
        ? ` (${result.filteredOutCount} filtered out — over 10 applicants)`
        : '';
      setScrapeNewContacts(result.newContacts || []);
      if (result.addedCount > 0) {
        setScrapeSuccessMsg(`Scraped ${result.scrapedTotal} live postings! Added ${result.addedCount} new jobs to top (${result.skippedDuplicates} duplicates skipped).${filterNote}`);
      } else {
        setScrapeSuccessMsg(`Scraped ${result.scrapedTotal} live postings! (All ${result.skippedDuplicates} were already in your job list).${filterNote}`);
      }
    } else if (result?.skippedSources && result.skippedSources.length > 0) {
      const skippedNames = result.skippedSources.map((s) => s.source).join(', ');
      setScrapeSuccessMsg(`Searched — ${skippedNames} skipped: their robots.txt disallows automated access. You can disable robots.txt respect in Settings to include them (you take responsibility for their Terms of Service).`);
    } else {
      const srcList = selectedSources.join(' + ');
      setScrapeSuccessMsg(`Searched ${srcList} — No results found in the selected window. Try different keywords, a wider posted window, or search again later.`);
    }
    setTimeout(() => setScrapeSuccessMsg(null), 10000);
  };

  const selectClass =
    'w-full appearance-none bg-white border-[1.5px] border-slate-200 rounded-lg border border-slate-200 pl-3 pr-9 py-2.5 text-[13px] font-medium text-slate-900 cursor-pointer transition-colors hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10';

  const renderSourceChip = (src: JobSource) => {
    const isComingSoon = COMING_SOON.includes(src);
    const isSelected = selectedSources.includes(src);
    return (
      <button
        key={src}
        type="button"
        onClick={() => toggleSource(src)}
        disabled={isComingSoon}
        title={isComingSoon ? `${src} — Coming soon` : `${src} — ${getSourceCountry(src)}`}
        className={`inline-flex items-center gap-[7px] pl-2 pr-3 py-[7px] rounded-lg text-[12px] font-medium border transition-colors whitespace-nowrap ${
          isComingSoon
            ? 'opacity-45 cursor-not-allowed bg-white border-slate-200 text-slate-500'
            : isSelected
            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold cursor-pointer'
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
  };

  return (
    <div className="bg-white border-b border-slate-200 py-5 text-slate-900">
      {/* Datalists for Native Auto-completion */}
      <datalist id="datalist-roles-keywords">
        {Array.from(new Set([...roleSuggestions, ...keywordSuggestions])).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <datalist id="datalist-locations">
        {PREDEFINED_LOCATIONS.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* ── Row 1: Hero Search ── */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-1.5 py-2 transition-colors focus-within:border-blue-500 focus-within:bg-white focus-within:ring-[3px] focus-within:ring-blue-500/10">
          <Search className="w-[18px] h-[18px] text-slate-400 shrink-0" />
          <input
            type="text"
            id="input-scrape-keywords"
            list="datalist-roles-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Search role, skills, or job title — e.g. 'DevOps Engineer'"
            autoComplete="off"
            name="ats-search-keywords"
            className="flex-1 border-none outline-none bg-transparent text-[15px] font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal py-2"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            id="btn-scrape-submit"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg px-6 py-3 text-[13.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
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
                autoComplete="off"
                name="ats-search-location"
                className="w-full bg-white border-[1.5px] border-slate-200 rounded-lg border border-slate-200 pl-8 pr-3 py-2.5 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10"
              />
            </div>
          </div>

          {/* Job Type */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              Job Type
              <span className="relative inline-flex group">
                <button
                  type="button"
                  aria-label="Job type may not be accurate"
                  onClick={() => setJobTypeInfoOpen((v) => !v)}
                  className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full border border-slate-300 bg-slate-100 text-slate-500 text-[9.5px] font-bold leading-none cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  i
                </button>
                <span
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-52 bg-slate-900 text-white text-[10.5px] font-medium leading-relaxed rounded-lg px-2.5 py-2 shadow-lg z-20 pointer-events-none transition-opacity duration-150 ${jobTypeInfoOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  Job-type labels are detected from descriptions and may not always be accurate.
                </span>
              </span>
            </label>
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
                <option value="">Any level</option>
                <option value="1">Internship</option>
                <option value="2">Entry</option>
                <option value="3">Associate</option>
                <option value="4">Mid-Senior</option>
                <option value="5">Director</option>
                <option value="6">Executive</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Contract type */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-slate-500">Contract</label>
            <div className="relative">
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as any)}
                className={selectClass}
              >
                <option value="">Any contract</option>
                <option value="F">Full-time</option>
                <option value="P">Part-time</option>
                <option value="C">Contract</option>
                <option value="T">Temporary</option>
                <option value="I">Internship</option>
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
                <option value={5}>5</option>
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
            <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:border-slate-300" title="Only show jobs with 10 or fewer applicants — low-competition roles (LinkedIn only; other sources are skipped when enabled)">
              <input
                type="checkbox"
                checked={under10Applicants}
                onChange={(e) => setUnder10Applicants(e.target.checked)}
                className="accent-blue-600 w-[15px] h-[15px] cursor-pointer"
              />
              <span className="text-[12px] font-medium text-slate-600 truncate">Under 10 applicants</span>
            </label>
          </div>
        </div>

        {/* ── Row 3: Source Pills with Flags ── */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-slate-500 pt-[7px] whitespace-nowrap">Sources</span>
            <div className="flex items-center gap-2 flex-nowrap min-w-0">
              {ALL_SOURCES.slice(0, 3).map((src) => renderSourceChip(src))}

              {/* More — hover/focus opens the full source list */}
              <div className="relative group shrink-0">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 pl-2 pr-2.5 py-[7px] rounded-lg text-[12px] font-semibold text-slate-600 border border-slate-200 bg-white hover:border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                  title="All sources this search can capture"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>More</span>
                  <span className="text-[10px] font-bold text-slate-400">({ALL_SOURCES.length - 3})</span>
                </button>
                <div className="absolute right-0 top-full mt-1.5 z-30 w-[330px] bg-white border border-slate-200 rounded-xl shadow-lg p-3 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition-all">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    All sources this search can capture
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SOURCES.slice(3).map((src) => renderSourceChip(src))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {scrapeSuccessMsg && (
            <div className="text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shrink-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{scrapeSuccessMsg}</span>
              </div>
              {scrapeNewContacts.length > 0 && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px]">
                  <span className="font-bold whitespace-nowrap">
                    +{scrapeNewContacts.length} recruiter{scrapeNewContacts.length > 1 ? 's' : ''}:
                  </span>
                  <span className="text-emerald-800">
                    {scrapeNewContacts.slice(0, 6).map((c) => {
                      const value = c.email || c.phone || c.recruiterUrl || '';
                      const label = value.replace(/^https?:\/\//, '');
                      return c.name ? `${c.name} (${label})` : label;
                    }).join(' · ')}
                    {scrapeNewContacts.length > 6 ? ` · +${scrapeNewContacts.length - 6} more` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
