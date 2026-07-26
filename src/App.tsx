import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ScraperBar } from './components/ScraperBar';
import { JobMatrix } from './components/JobMatrix';
import { JobDetailModal } from './components/JobDetailModal';
import { MasterCvDrawer } from './components/MasterCvDrawer';
import { SettingsModal } from './components/SettingsModal';
import { Job, JobState, MasterCv, AppConfig, JobSource } from './types';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [masterCv, setMasterCv] = useState<MasterCv | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);

  // Active filters and views
  const [activeStateTab, setActiveStateTab] = useState<'all' | JobState>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Drawers and Modals
  const [isMasterCvOpen, setIsMasterCvOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Loading states
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [isBatchMatching, setIsBatchMatching] = useState(false);
  const [isBatchTailoring, setIsBatchTailoring] = useState(false);
  const [actionJobIdLoading, setActionJobIdLoading] = useState<string | null>(null);

  // Initial Fetch
  const fetchAllData = async () => {
    try {
      const [jobsRes, cvRes, configRes] = await Promise.all([
        fetch('/api/jobs?limit=500'),
        fetch('/api/cv/master'),
        fetch('/api/config'),
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }
      if (cvRes.ok) {
        const cvData = await cvRes.json();
        setMasterCv(cvData);
      }
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Scrape Handler
  const handleScrape = async (params: {
    keywords: string;
    location: string;
    sources: JobSource[];
    datePostedFilter: 'all' | '24h' | '7d' | '30d';
    minSalary?: number;
    maxJobsPerSource?: number;
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
        setActiveStateTab('all');
        await fetchAllData();
        return {
          scrapedTotal: data.scrapedTotal || 0,
          addedCount: data.addedCount || 0,
          skippedDuplicates: data.skippedDuplicates || 0,
        };
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
    setActionJobIdLoading(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === jobId ? data.job : j)));
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob(data.job);
        }
      }
    } catch (err) {
      console.error('Match error:', err);
    } finally {
      setActionJobIdLoading(null);
    }
  };

  // Batch Match Handler
  const handleBatchMatch = async () => {
    setIsBatchMatching(true);
    try {
      const res = await fetch('/api/jobs/batch-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          setJobs((prev) => {
            const updated = new Map(data.jobs.map((j: Job) => [j.id, j]));
            return prev.map((j) => updated.get(j.id) || j);
          });
        }
      }
    } catch (err) {
      console.error('Batch match error:', err);
    } finally {
      setIsBatchMatching(false);
    }
  };

  // Tailor CV Handler
  const handleTailorJob = async (jobId: string) => {
    setActionJobIdLoading(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === jobId ? data.job : j)));
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob(data.job);
        }
      }
    } catch (err) {
      console.error('Tailor error:', err);
    } finally {
      setActionJobIdLoading(null);
    }
  };

  // Batch Tailor Handler
  const handleBatchTailor = async () => {
    setIsBatchTailoring(true);
    try {
      const res = await fetch('/api/jobs/batch-tailor', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          setJobs((prev) => {
            const updated = new Map(data.jobs.map((j: Job) => [j.id, j]));
            return prev.map((j) => updated.get(j.id) || j);
          });
        }
      }
    } catch (err) {
      console.error('Batch tailor error:', err);
    } finally {
      setIsBatchTailoring(false);
    }
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
      }
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  // Save Master CV Handler
  const handleSaveMasterCv = async (updatedCv: MasterCv) => {
    try {
      const res = await fetch('/api/cv/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCv),
      });

      if (res.ok) {
        const data = await res.json();
        setMasterCv(data.cv);
      }
    } catch (err) {
      console.error('Save master CV error:', err);
    }
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
  const matchedCount = jobs.filter((j) => j.state === 'matched' || j.state === 'tailored' || j.state === 'ready').length;
  const tailoredCount = jobs.filter((j) => j.state === 'tailored' || j.state === 'ready').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Header Navigation */}
      <Navbar
        onOpenMasterCv={() => setIsMasterCvOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        totalJobs={jobs.length}
        matchedCount={matchedCount}
        tailoredCount={tailoredCount}
      />

      {/* Live Job Scraper Bar */}
      <ScraperBar onScrape={handleScrape} isLoading={isScrapingLoading} />

      {/* Main Jobs Matrix View */}
      <main>
        <JobMatrix
          jobs={jobs}
          activeStateTab={activeStateTab}
          onStateTabChange={setActiveStateTab}
          onSelectJob={(job) => setSelectedJob(job)}
          onMatchJob={handleMatchJob}
          onBatchMatch={handleBatchMatch}
          onTailorJob={handleTailorJob}
          onBatchTailor={handleBatchTailor}
          onDeleteJob={handleDeleteJob}
          onClearAll={handleClearAll}
          isBatchMatching={isBatchMatching}
          isBatchTailoring={isBatchTailoring}
          actionJobIdLoading={actionJobIdLoading}
        />
      </main>

      {/* Job Details & Tailored CV Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onMatchJob={handleMatchJob}
        onTailorJob={handleTailorJob}
        onUpdateStatus={handleUpdateStatus}
        isLoading={actionJobIdLoading === selectedJob?.id}
      />

      {/* Master Candidate CV Drawer */}
      {masterCv && (
        <MasterCvDrawer
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
        />
      )}
    </div>
  );
}
