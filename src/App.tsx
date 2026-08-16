import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { ScraperBar } from './components/ScraperBar';
import { JobMatrix } from './components/JobMatrix';
import { JobDetailModal } from './components/JobDetailModal';
import { MasterCvScreen } from './components/MasterCvScreen';
import { SettingsModal } from './components/SettingsModal';
import { ManualJdScreen } from './components/ManualJdScreen';
import { JobPortalsScreen } from './components/JobPortalsScreen';
import { RecruitersScreen } from './components/RecruitersScreen';
import { AiSystemScreen } from './components/AiSystemScreen';
import { OnboardingTour, startTour } from './components/OnboardingTour';
import { LoginScreen } from './components/LoginScreen';
import { Job, JobState, MasterCv, AppConfig, JobSource, TemplateId } from './types';
import { llmErrorMessage } from './lib/llmError';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [masterCv, setMasterCv] = useState<MasterCv | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; isGuest: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active filters and views
  const [activeStateTab, setActiveStateTab] = useState<'all' | JobState>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobTab, setSelectedJobTab] = useState<'details' | 'gap' | 'tailored'>('details');

  // Drawers and Modals
  const [isMasterCvOpen, setIsMasterCvOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualJdOpen, setIsManualJdOpen] = useState(false);
  const [isJobPortalsOpen, setIsJobPortalsOpen] = useState(false);
  const [isRecruitersOpen, setIsRecruitersOpen] = useState(false);
  const [isAiSystemOpen, setIsAiSystemOpen] = useState(false);
  const [recruiterBadge, setRecruiterBadge] = useState(0);
  const [recruiterFocus, setRecruiterFocus] = useState<{ name?: string | null; url?: string | null } | null>(null);

  // Loading states
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [loadingJobIds, setLoadingJobIds] = useState<Set<string>>(new Set());
  const [scoreMessages, setScoreMessages] = useState<Record<string, string[]>>({});
  const [tailorMessages, setTailorMessages] = useState<Record<string, string[]>>({});

  // Server-side list state
  const [totalJobs, setTotalJobs] = useState(0);
  const [stats, setStats] = useState<{ total: number; pending: number; matched: number; tailored: number; applied: number; scoredCount: number; avgScore: number; byState: Record<string, number> }>({
    total: 0, pending: 0, matched: 0, tailored: 0, applied: 0, scoredCount: 0, avgScore: 0, byState: {},
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | JobSource>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'postedDate' | 'matchScore' | 'salaryMax'>('createdAt');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Per-job loading tracking. The list refresh is NEVER globally blocked —
  // pagination, filters, delete, and downloads stay live while any
  // match/tailor runs in the background.
  const addLoadingJobId = (id: string) => setLoadingJobIds((prev) => new Set(prev).add(id));
  const removeLoadingJobId = (id: string) => setLoadingJobIds((prev) => { const next = new Set(prev); next.delete(id); return next; });

  const runWithMessages = async (
    jobId: string,
    messages: string[],
    fn: () => Promise<void>,
    setter: React.Dispatch<React.SetStateAction<Record<string, string[]>>>,
  ) => {
    addLoadingJobId(jobId);
    let idx = 0;
    setter((prev) => ({ ...prev, [jobId]: [messages[0]] }));
    const timer = setInterval(() => {
      idx++;
      if (idx < messages.length) {
        setter((prev) => ({
          ...prev,
          [jobId]: [...(prev[jobId] || []), messages[idx]],
        }));
      }
    }, 1200);

    try {
      await fn();
    } catch (err) {
      console.error('Operation error:', err);
    } finally {
      clearInterval(timer);
      setter((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      removeLoadingJobId(jobId);
      fetchJobs();
    }
  };

  // Fetch job list (server-side filtered + paginated) and stats.
  // Never blocked — runs on every page/filter change regardless of
  // background match/tailor operations.
  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams({
      state: activeStateTab,
      source: sourceFilter,
      search: searchTerm,
      sortBy,
      sortOrder: 'desc',
      page: String(page),
      limit: String(pageSize),
    });
    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/jobs?${params}`),
      fetch('/api/jobs/stats'),
    ]);
    if (listRes.ok) {
      const data = await listRes.json();
      setJobs(data.jobs || []);
      setTotalJobs(data.total || 0);
    }
    if (statsRes.ok) {
      setStats(await statsRes.json());
    }
  }, [activeStateTab, sourceFilter, searchTerm, sortBy, page, pageSize]);

  // Initial Fetch (session + config + first page)
  const fetchAllData = async () => {
    try {
      const [authRes, configRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/config'),
      ]);

      if (authRes.ok) {
        const authData = await authRes.json();
        setCurrentUser(authData.user);
        if (authData.user) {
          const cvRes = await fetch('/api/cv/master');
          if (cvRes.ok) {
            const cvData = await cvRes.json();
            setMasterCv(cvData);
          }
          await fetchJobs();
        }
      }
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Refetch whenever filters/pagination change
  useEffect(() => {
    if (currentUser) fetchJobs();
  }, [fetchJobs, currentUser]);

  // Reset to page 1 when a filter changes
  useEffect(() => {
    setPage(1);
  }, [activeStateTab, sourceFilter, searchTerm, sortBy, pageSize]);

  // Scrape Handler
  const handleScrape = async (params: {
    keywords: string;
    location: string;
    sources: JobSource[];
    datePostedFilter: 'all' | '24h' | '7d' | '30d';
    jobType?: 'all' | 'remote' | 'onsite' | 'hybrid';
    minSalary?: number;
    maxJobsPerSource?: number;
    under10Applicants?: boolean;
  }) => {
    setIsScrapingLoading(true);
    try {
      const res = await fetch('/api/jobs/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        // Searching ADDS jobs to the store. The list always shows your full
        // library (newest scraped first) — the search never narrows or hides
        // existing jobs. Use the toolbar search box / source / sort controls
        // to filter the view manually.
        setActiveStateTab('all');
        setPage(1);
        await fetchJobs();
        // Notification badge: new recruiters found in this scrape's
        // descriptions (accumulates until the Recruiters screen is opened).
        if (data.newContacts?.length > 0) {
          setRecruiterBadge((prev) => prev + data.newContacts.length);
        }
        return { scrapedTotal: data.scrapedTotal || 0, addedCount: data.addedCount || 0, skippedDuplicates: data.skippedDuplicates || 0, filteredOutCount: data.filteredOutCount || 0, skippedSources: data.skippedSources || [], newContacts: data.newContacts || [] };
      } else {
        const err = await res.json();
        alert(`Scrape error: ${err.error}`);
        return { scrapedTotal: 0, addedCount: 0, skippedDuplicates: 0 };
      }
    } catch (err: any) {
      alert(`Scrape request failed: ${err.message}`);
      return { scrapedTotal: 0, addedCount: 0, skippedDuplicates: 0 };
    } finally {
      setIsScrapingLoading(false);
    }
  };

  // Match Job Handler
  const handleMatchJob = async (jobId: string) => {
    runWithMessages(jobId, [
      'Reading job requirements from LinkedIn...',
      'Extracting hard skills & technologies...',
      'Comparing against your Master CV...',
      'Identifying matching & missing keywords...',
      'Computing weighted ATS match score...',
    ], async () => {
      const res = await fetch(`/api/jobs/${jobId}/match`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === jobId ? data.job : j)));
        if (selectedJob && selectedJob.id === jobId) setSelectedJob(data.job);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(llmErrorMessage(data.code, data.error));
        throw new Error(data.error || 'Match failed');
      }
    }, setScoreMessages);
  };

  // Batch Match Handler
  // Tailor CV Handler
  const handleTailorJob = async (jobId: string) => {
    runWithMessages(jobId, [
      'Analyzing job requirements from description...',
      'Matching skills with your Master CV profile...',
      'Rewriting experience bullets with JD keywords...',
      'Integrating missing keywords into sections...',
      'Verifying all keywords are placed correctly...',
      'Generating ATS-ready PDF document...',
    ], async () => {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === jobId ? data.job : j)));
        if (selectedJob && selectedJob.id === jobId) setSelectedJob(data.job);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(llmErrorMessage(data.code, data.error));
        throw new Error(data.error || 'Tailor failed');
      }
    }, setTailorMessages);
  };

  // Status Update Handler
  const handleUpdateStatus = async (jobId: string, state: JobState) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });

      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === jobId ? data.job : j)));
        fetchJobs();
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  // Delete Job Handler
  const handleDeleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob(null);
        }
        fetchJobs();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all jobs? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/jobs', { method: 'DELETE' });
      if (res.ok) {
        setJobs([]);
        setSelectedJob(null);
        fetchJobs();
      }
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  // Save Master CV Handler — returns true on success so the editor can show
  // an honest "Saved!" vs an error (never a fake success on a failed request).
  const handleSaveMasterCv = async (updatedCv: MasterCv): Promise<boolean> => {
    try {
      const res = await fetch('/api/cv/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCv),
      });

      if (res.ok) {
        const data = await res.json();
        setMasterCv(data.cv);
        return true;
      }
      console.error('Save master CV failed:', res.status);
      return false;
    } catch (err) {
      console.error('Save master CV error:', err);
      return false;
    }
  };

  // ── Auth handlers ──
  const handleLogin = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Login failed.' };
    setCurrentUser(data.user);
    setMasterCv(null);
    await fetchAllData();
    return null;
  };

  const handleRegister = async (name: string, email: string, password: string, recovery?: { q1: string; a1: string; q2: string; a2: string }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        recoveryQ1: recovery?.q1,
        recoveryA1: recovery?.a1,
        recoveryQ2: recovery?.q2,
        recoveryA2: recovery?.a2,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Registration failed.' };
    setCurrentUser(data.user);
    setMasterCv(null);
    await fetchAllData();
    return null;
  };

  const handleGuestLogin = async (name: string) => {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Guest login failed.' };
    setCurrentUser(data.user);
    setMasterCv(null);
    await fetchAllData();
    return null;
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setMasterCv(null);
    setJobs([]);
    setSelectedJob(null);
  };

  // Save Config Handler
  const handleSaveConfig = async (updatedConfig: AppConfig) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Save config error:', err);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      <OnboardingTour ready={!!currentUser && !authLoading} />
      {authLoading ? (
        <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
      ) : !currentUser ? (
        <LoginScreen
          onLogin={handleLogin}
          onRegister={handleRegister}
          onGuestLogin={handleGuestLogin}
        />
      ) : (
        <>
          {/* Header Navigation */}
          <Navbar
            user={currentUser}
            onLogout={handleLogout}
            onOpenMasterCv={() => setIsMasterCvOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenManualJd={() => setIsManualJdOpen(true)}
            onOpenJobPortals={() => setIsJobPortalsOpen(true)}
            onOpenRecruiters={() => {
              setRecruiterBadge(0);
              setIsRecruitersOpen(true);
            }}
            onOpenChat={() => setIsAiSystemOpen(true)}
            recruiterBadge={recruiterBadge}
            onTour={startTour}
          />

          {/* Live Job Scraper Bar */}
          <ScraperBar
            onScrape={handleScrape}
            isLoading={isScrapingLoading}
            apifyAvailable={!!config?.apify.enabled && !!config?.apify.token}
          />

          {/* Main Jobs Matrix View */}
          <main>
            <JobMatrix
              jobs={jobs}
              totalJobs={totalJobs}
              stats={stats}
              activeStateTab={activeStateTab}
              onStateTabChange={setActiveStateTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sourceFilter={sourceFilter}
              setSourceFilter={setSourceFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              onSelectJob={(job) => { setSelectedJob(job); setSelectedJobTab('details'); }}
            onOpenRecruiter={(job) => { setRecruiterFocus({ name: job.recruiterName, url: job.recruiterUrl }); setIsRecruitersOpen(true); }}
              onSelectTailoredReview={(job) => { setSelectedJob(job); setSelectedJobTab('tailored'); }}
              onMatchJob={handleMatchJob}
              onTailorJob={handleTailorJob}
              onDeleteJob={handleDeleteJob}
              onUpdateStatus={handleUpdateStatus}
              onClearAll={handleClearAll}
              loadingJobIds={loadingJobIds}
              scoreMessages={scoreMessages}
              tailorMessages={tailorMessages}
            />
          </main>

          {/* Job Details & Tailored CV Modal */}
          <JobDetailModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onMatchJob={handleMatchJob}
            onTailorJob={handleTailorJob}
            onUpdateStatus={handleUpdateStatus}
            isLoading={selectedJob ? loadingJobIds.has(selectedJob.id) : false}
            initialTab={selectedJobTab}
            cvTemplate={(masterCv?.templateId || 'harvard') as TemplateId}
          />

          {/* Master Candidate CV — full screen */}
          {masterCv && (
            <MasterCvScreen
              isOpen={isMasterCvOpen}
              onClose={() => setIsMasterCvOpen(false)}
              masterCv={masterCv}
              onSaveMasterCv={handleSaveMasterCv}
            />
          )}

          {/* System INI Config Settings Modal */}
          {config && (
            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              config={config}
              onSaveConfig={handleSaveConfig}
              user={currentUser}
              onOpenMasterCv={() => setIsMasterCvOpen(true)}
            />
          )}

          {/* Manual JD — full screen */}
          <ManualJdScreen
            isOpen={isManualJdOpen}
            onClose={() => setIsManualJdOpen(false)}
            masterCv={masterCv}
          />

          {/* Job Portals Directory — full screen */}
          <JobPortalsScreen
            isOpen={isJobPortalsOpen}
            onClose={() => setIsJobPortalsOpen(false)}
          />

          {/* Recruiters — emails found in job descriptions */}
          <RecruitersScreen
            isOpen={isRecruitersOpen}
            onClose={() => setIsRecruitersOpen(false)}
            focusRecruiter={recruiterFocus}
          />

          {/* AI Interview */}
          {isAiSystemOpen && <AiSystemScreen onClose={() => setIsAiSystemOpen(false)} />}
        </>
      )}
    </div>
  );
}
