import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Loader2, Sparkles, Download, FileText, CheckCircle2, ArrowRight, History, Trash2, AlertTriangle, TrendingUp, Plus, PenLine, Ban, Copy, ChevronsLeftRight } from 'lucide-react';
import { llmErrorMessage } from '../lib/llmError';
import { MasterCv } from '../types';
import { CvPdfPreview, masterCvToPdfShape, compressedCvToPdfShape } from './CvPdfPreview';

interface ManualJdScreenProps {
  isOpen: boolean;
  onClose: () => void;
  masterCv?: MasterCv | null;
}

interface HistoryEntry {
  id: string;
  role: string;
  company: string;
  score: number;
  hasTailoredCv: boolean;
  createdAt: string;
}

interface DiffPayload {
  beforeScore: number;
  afterScore: number;
  scoreBoost: number;
  missingBefore: { skills: string[]; keywords: string[] };
  addedAfter: {
    skillsAdded: string[];
    rephrasedHighlightsCount: number;
  };
  notIntegrable: string[];
  bulletRewrites?: { original: string; rewritten: string }[];
}

interface AnalysisResult {
  matchScore: number;
  gapAnalysis: {
    matchingSkills: string[];
    missingSkills: string[];
    keyRecommendations: string[];
    missingKeywords: string[];
    matchedKeywords: string[];
  };
}

function countInJd(term: string, jd: string): number {
  const t = term.toLowerCase().trim();
  if (!t) return 0;
  const hay = jd.toLowerCase();
  let count = 0, idx = 0;
  while ((idx = hay.indexOf(t, idx)) !== -1) { count++; idx += t.length; }
  return count;
}

interface SkillGroup {
  display: string;
  count: number;
  raws: string[];
}

// Merge near-duplicate extractions before display: case differences, plural
// forms, trailing punctuation, and "X" vs "X (full name)" variants collapse
// into one chip so the UI never inflates the number of additions.
function normalizeAdditions(missing: string[], missingKw: string[], jd: string): SkillGroup[] {
  const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.,;:'"!?]+$/, '');
  const groups = new Map<string, SkillGroup>();
  for (const raw of [...new Set([...missing, ...missingKw])]) {
    const k = normKey(raw);
    if (!k) continue;
    const base = k.includes('(') ? k.split(' (')[0].trim() : k;
    const occ = Math.max(1, countInJd(raw, jd));
    const existing = groups.get(base);
    if (existing) {
      existing.count += occ;
      existing.raws.push(raw);
      if (k.includes('(')) existing.display = raw;
      continue;
    }
    if (base.endsWith('s')) {
      const sg = groups.get(base.slice(0, -1));
      if (sg) { sg.count += occ; sg.raws.push(raw); continue; }
    } else if (groups.has(base + 's')) {
      const pl = groups.get(base + 's')!;
      if (raw.includes('(') || !pl.display.includes('(')) pl.display = raw;
      pl.count += occ;
      pl.raws.push(raw);
      continue;
    }
    groups.set(base, { display: raw, count: occ, raws: [raw] });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
}

/* ───────────────── Main screen ───────────────── */

export const ManualJdScreen: React.FC<ManualJdScreenProps> = ({ isOpen, onClose, masterCv }) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [removedPoints, setRemovedPoints] = useState<Set<string>>(new Set());
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMsg, setHistoryMsg] = useState<string | null>(null);
  const [tailorError, setTailorError] = useState(false);
  const [showAllMatched, setShowAllMatched] = useState(false);
  const [showAllAdditions, setShowAllAdditions] = useState(false);
  const [showAllAddedSkills, setShowAllAddedSkills] = useState(false);
  const [showAllRewrites, setShowAllRewrites] = useState(false);
  const [showAllReview, setShowAllReview] = useState(false);
  const [tailoredCv, setTailoredCv] = useState<any | null>(null);
  const [cvLoadFailed, setCvLoadFailed] = useState(false);
  const [cut, setCut] = useState(50);
  // View step — lets users click a completed step in the stepper to go back.
  // Auto-follows the derived step whenever the flow advances.
  const [viewStep, setViewStep] = useState<1 | 2 | 3>(1);
  const draggingRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const oldScrollRef = useRef<HTMLDivElement>(null);
  const newScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  useEffect(() => {
    if (isOpen && historyOpen) loadHistory();
  }, [isOpen, historyOpen]);

  // Keep the view step in sync with the flow's natural progression.
  useEffect(() => {
    const s = !result ? 1 : !diff ? (tailoring ? 3 : 2) : 3;
    setViewStep(s);
  }, [result, diff, tailoring]);

  useEffect(() => {
    if (!tailoredCv) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setCut(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [tailoredCv]);

  // Closed screen → render nothing (Back / X buttons call onClose).
  if (!isOpen) return null;

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/manual-jd/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.analyses || []);
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  };

  const openHistory = () => { setHistoryOpen(true); loadHistory(); };

  const loadTailoredJson = async (token: string) => {
    try {
      const res = await fetch(`/api/analyze-jd/download?token=${encodeURIComponent(token)}&format=json`);
      if (!res.ok) { setCvLoadFailed(true); return; }
      const cv = await res.json();
      if (cv && cv.candidateName) { setTailoredCv(cv); setCvLoadFailed(false); }
      else setCvLoadFailed(true);
    } catch { setCvLoadFailed(true); }
  };

  const restoreAnalysis = async (id: string) => {
    try {
      const res = await fetch(`/api/manual-jd/history/${id}`);
      if (!res.ok) { setHistoryMsg('Could not load this analysis.'); setTimeout(() => setHistoryMsg(null), 3000); return; }
      const payload = await res.json();
      const a = payload.analysis || payload;
      const gap = a.gapAnalysis || a.gap_analysis || { matchingSkills: [], missingSkills: [], keyRecommendations: [], missingKeywords: [], matchedKeywords: [] };
      setTitle(a.role || '');
      setCompany(a.company || '');
      setDescription(a.description || '');
      setResult({ matchScore: a.score, gapAnalysis: gap });
      const missing = gap.missingSkills || [];
      const missingKw = gap.missingKeywords || [];
      setSelectedSkills(new Set([...missing, ...missingKw]));
      setRemovedPoints(new Set());
      setDiff(a.diff || null);
      setHistoryId(a.id);
      setTailorError(false);
      setHistoryOpen(false);
      const restoredToken = payload.downloadToken || `restored-${a.id}`;
      if ((a.tailored_cv || a.tailoredCv) && a.diff?.scoreBoost !== undefined) {
        setDownloadToken(restoredToken);
        loadTailoredJson(restoredToken);
      }
    } catch (e: any) { setError(e.message); }
  };

  const deleteHistoryEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/manual-jd/history/${id}`, { method: 'DELETE' });
    if (res.ok) setHistory((h) => h.filter((x) => x.id !== id));
  };

  const handleAnalyze = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true); setError(''); setTailorError(false); setResult(null); setDiff(null); setDownloadToken(null); setTailoredCv(null); setCvLoadFailed(false);
    setShowAllMatched(false); setShowAllAdditions(false); setShowAllAddedSkills(false); setShowAllRewrites(false); setShowAllReview(false);
    try {
      const res = await fetch('/api/analyze-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), company: company.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Analysis failed'); alert(llmErrorMessage(data.code, data.error)); return; }
      setResult(data);
      const missing = (data.gapAnalysis?.missingSkills || []);
      const missingKw = (data.gapAnalysis?.missingKeywords || []);
      setSelectedSkills(new Set([...missing, ...missingKw]));
      setRemovedPoints(new Set());
      if (data.historyId) setHistoryId(data.historyId);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleTailor = async (skillsOverride?: string[]) => {
    setTailoring(true); setError(''); setTailorError(false);
    const include = skillsOverride !== undefined ? skillsOverride : [...selectedSkills];
    try {
      const res = await fetch('/api/analyze-jd/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          company: company.trim(),
          description: description.trim(),
          gapAnalysis: result?.gapAnalysis,
          matchScore: result?.matchScore,
          historyId,
          includeSkills: include,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Tailoring failed'); setTailorError(true); alert(llmErrorMessage(data.code, data.error)); return; }
      setDownloadToken(data.downloadToken);
      if (data.diff) setDiff(data.diff);
      if (data.historyId) setHistoryId(data.historyId);
      if (data.downloadToken) loadTailoredJson(data.downloadToken);
    } catch (e: any) { setError(e.message); }
    finally { setTailoring(false); }
  };

  const download = (format: 'pdf' | 'txt') => {
    if (!downloadToken) return;
    window.open(`/api/analyze-jd/download?token=${downloadToken}&format=${format}&template=${previewTemplate}`, '_blank');
  };

  const missing = result?.gapAnalysis?.missingSkills || [];
  const missingKw = result?.gapAnalysis?.missingKeywords || [];
  const matchedSkills = result?.gapAnalysis?.matchingSkills || [];
  const additions = normalizeAdditions(missing, missingKw, description);
  const CHIP_CAP = 8;
  const visibleMatched = showAllMatched ? matchedSkills : matchedSkills.slice(0, CHIP_CAP);
  const visibleAdditions = showAllAdditions ? additions : additions.slice(0, CHIP_CAP);
  const displayScore = result?.matchScore ?? 0;
  const step = !result ? 1 : !diff ? (tailoring ? 3 : 2) : 3;
  const reviewSkills: string[] = diff ? diff.addedAfter.skillsAdded || [] : [];
  const reviewBullets: { original: string; rewritten: string }[] = diff?.bulletRewrites || [];
  const clamp1: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
  const clamp2: React.CSSProperties = { ...clamp1, WebkitLineClamp: 2 };
  const ADDED_CAP = 8;
  const REWRITE_CAP = 4;
  const REVIEW_CAP = 3;
  const visibleAddedSkills = showAllAddedSkills ? reviewSkills : reviewSkills.slice(0, ADDED_CAP);
  const visibleRewrites = showAllRewrites ? reviewBullets : reviewBullets.slice(0, REWRITE_CAP);
  const reviewItems: { kind: 'skill' | 'bullet'; key: string; label: string; original?: string }[] = [
    ...reviewSkills.map((s) => ({ kind: 'skill' as const, key: `skill:${s}`, label: s })),
    ...reviewBullets.map((br, bi) => ({ kind: 'bullet' as const, key: `bullet:${bi}`, label: br.rewritten, original: br.original })),
  ];
  const visibleReview = showAllReview ? reviewItems : reviewItems.slice(0, REVIEW_CAP);

  const SKILL_PALETTE = [
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', checkBg: 'bg-blue-600' },
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', checkBg: 'bg-purple-600' },
    { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', checkBg: 'bg-green-600' },
    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', checkBg: 'bg-orange-600' },
    { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', checkBg: 'bg-red-600' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', checkBg: 'bg-cyan-600' },
    { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', checkBg: 'bg-pink-600' },
  ];
  const skillColor = (name: string) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return SKILL_PALETTE[h % SKILL_PALETTE.length];
  };

  const analysisStatus: 'idle' | 'loading' | 'success' | 'error' = loading ? 'loading' : result ? 'success' : error ? 'error' : 'idle';
  const generateStatus: 'idle' | 'loading' | 'success' | 'error' = tailoring ? 'loading' : tailorError ? 'error' : diff ? 'success' : 'idle';

  const inputCls = 'w-full min-h-[46px] border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 outline-none transition-colors';
  const btnBase = 'w-full min-h-[48px] rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40';

  const stepBadge = (n: number) => (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[13px] font-bold shrink-0 ${step >= n ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
  );

  const loadingOverlay = (text: string) => (
    <div className="absolute inset-0 z-10 bg-white/90 flex flex-col items-center justify-center gap-3">
      <div className="w-[30px] h-[30px] border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      <p className="text-[12px] font-semibold text-slate-500">{text}</p>
    </div>
  );

  const panelCls = (n: number) =>
    `absolute inset-0 p-5 overflow-y-auto transition-all duration-[450ms] ease-[cubic-bezier(.25,.8,.3,1)] ${
      viewStep === n ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-10 pointer-events-none'
    }`;

  const originalCv = masterCv ? masterCvToPdfShape(masterCv) : null;
  const newCv = tailoredCv ? compressedCvToPdfShape(tailoredCv) : null;
  const [previewTemplate, setPreviewTemplate] = useState<'harvard' | 'jake' | 'atanu'>(masterCv?.templateId || 'harvard');

  // Keep the ORIGINAL and TAILORED sheets at the same scroll position so the
  // slider always compares matching areas of the two CVs.
  const syncScroll = (from: HTMLDivElement, to: HTMLDivElement | null) => {
    if (!to || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 text-slate-700 flex flex-col font-sans">
      {/* Page header */}
      <header className="px-5 sm:px-8 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Manual JD</h1>
            <p className="text-[10.5px] text-slate-400 font-medium">Paste a job description — get a tailored CV in 3 simple steps.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={openHistory} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
            <History className="w-4 h-4" /> History
          </button>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Workflow stepper — completed steps are clickable to go back */}
      <div className="px-5 sm:px-8 pt-4 flex items-center justify-center gap-2 flex-wrap shrink-0">
        {[
          { n: 1 as const, label: 'Add JD', on: step >= 2, reachable: true },
          { n: 2 as const, label: 'Analysis', on: step >= 3, reachable: !!result },
          { n: 3 as const, label: 'Tailor', on: step >= 3 && !tailoring, reachable: !!diff },
        ].map((s, i) => {
          const isCurrent = viewStep === s.n;
          const canClick = !loading && !tailoring && s.reachable;
          return (
            <React.Fragment key={s.n}>
              {i > 0 && <ArrowRight className="w-3 h-3 text-slate-300" />}
              <button
                type="button"
                onClick={() => canClick && setViewStep(s.n)}
                disabled={!canClick}
                title={canClick ? `Go back to ${s.label}` : undefined}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                  s.on ? 'bg-slate-900 border-slate-900 text-white' : isCurrent ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                } ${canClick ? 'cursor-pointer hover:opacity-85' : 'cursor-default'}`}
              >
                <span className={`w-4.5 h-4.5 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${s.on || isCurrent ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{s.on ? '✓' : s.n}</span>
                {s.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {error && <p className="px-5 sm:px-8 pt-3 text-[12px] text-red-600">{error}</p>}

      {/* ── 50/50 stage: left = workspace, right = CV comparison ── */}
      <div className="flex-1 min-h-0 p-4 sm:p-5 flex gap-0">
        {/* LEFT · Workspace */}
        <section className="flex-1 min-w-0 bg-white border border-slate-200 rounded-l-[14px] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Workspace
            </span>
            <span className="text-[10.5px] font-bold text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">Step {viewStep} of 3</span>
          </div>

          <div className="relative flex-1 min-h-0 overflow-hidden bg-white">
            {/* PANEL 1 · Add JD */}
            <div className={panelCls(1)}>
              <h2 className="text-[16px] font-bold text-slate-900 mb-4 flex items-center justify-between gap-2">
                Add job description {stepBadge(1)}
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="mj-role" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Role name</label>
                  <input id="mj-role" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DevOps Engineer" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="mj-company" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Company</label>
                  <input id="mj-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="mj-description" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Job description</label>
                  <textarea id="mj-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={9}
                    placeholder="Paste the full job description…" className={`${inputCls} min-h-[150px] resize-none leading-relaxed`} />
                  <p className="text-right text-xs text-slate-400 mt-1">{description.length.toLocaleString()} chars</p>
                </div>
                <button onClick={handleAnalyze} disabled={loading || !title.trim() || !description.trim()} aria-live="polite"
                  className={`${btnBase} ${analysisStatus === 'error' ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    : analysisStatus === 'success' ? <><CheckCircle2 className="w-4 h-4" /> Analysis Complete</>
                    : analysisStatus === 'error' ? <><AlertTriangle className="w-4 h-4" /> Try Again</>
                    : <><Sparkles className="w-4 h-4" /> Analyze Match</>}
                </button>
              </div>
            </div>

            {/* PANEL 2 · Analysis */}
            <div className={panelCls(2)}>
              {loading && loadingOverlay('Analyzing your CV against the JD…')}
              <div className={`flex flex-col h-full min-h-0 transition-opacity duration-200 ${loading ? 'opacity-10' : 'opacity-100'}`}>
                <h2 className="text-[16px] font-bold text-slate-900 mb-3 flex items-center justify-between gap-2 shrink-0">
                  Analysis {stepBadge(2)}
                </h2>
                {!result ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">Click Analyze Match to begin</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
                      <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="text-[40px] font-bold text-blue-600 leading-none shrink-0">{displayScore}%</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {matchedSkills.length} of {additions.length + matchedSkills.length} skills matched
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">Excellent fit — you're missing a few skills to reach 100%</div>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70">
                        <h3 className="text-[12.5px] font-bold text-slate-900 mb-2">Tailoring changes</h3>
                        <div className="space-y-1.5 text-[12px] leading-relaxed">
                          <p className="text-slate-700">
                            <span className="font-bold text-green-600">+ Add:</span>{' '}
                            {selectedSkills.size > 0 ? [...selectedSkills].join(' · ') : 'nothing selected'}
                          </p>
                          <p className="text-slate-700">
                            <span className="font-bold text-blue-600">✎ Rewrite:</span> existing experience bullets to naturally integrate the additions
                          </p>
                          <p className="text-slate-400">
                            <span className="font-bold">✓ Preserve:</span> Job titles · Employers · Dates
                          </p>
                        </div>
                      </div>

                      {matchedSkills.length > 0 && (
                        <div>
                          <h3 className="text-[12.5px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                            Already matched
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 rounded-lg px-1.5 py-0.5">{matchedSkills.length}</span>
                            {matchedSkills.length > CHIP_CAP && (
                              <button onClick={() => setShowAllMatched((v) => !v)} className="ml-auto text-[11.5px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                                {showAllMatched ? 'Show less' : `+${matchedSkills.length - CHIP_CAP} more`}
                              </button>
                            )}
                          </h3>
                          <div className="flex flex-wrap gap-2 min-w-0">
                            {visibleMatched.map((s) => (
                              <span key={s} className="inline-flex items-center gap-[7px] px-[11px] py-1.5 rounded-[9px] text-[13px] font-semibold border bg-green-50 border-green-200 text-green-700 max-w-full">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="break-words min-w-0">{s}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="text-[12.5px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                          Recommended additions
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 rounded-lg px-1.5 py-0.5">{additions.length}</span>
                          {additions.length > CHIP_CAP && (
                            <button onClick={() => setShowAllAdditions((v) => !v)} className="ml-auto text-[11.5px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                              {showAllAdditions ? 'Show less' : `+${additions.length - CHIP_CAP} more`}
                            </button>
                          )}
                        </h3>
                        {additions.length === 0 ? (
                          <p className="text-xs text-slate-500">No missing skills detected — your CV already covers this JD well.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 min-w-0">
                            {visibleAdditions.map((g) => {
                              const on = g.raws.some((r) => selectedSkills.has(r));
                              const c = skillColor(g.display);
                              return (
                                <button key={g.display} onClick={() => setSelectedSkills((p) => {
                                  const n2 = new Set(p);
                                  const anySel = g.raws.some((r) => n2.has(r));
                                  if (anySel) g.raws.forEach((r) => n2.delete(r)); else n2.add(g.display);
                                  return n2;
                                })}
                                  aria-pressed={on}
                                  className={`inline-flex items-center gap-[7px] px-[11px] py-1.5 rounded-[9px] text-[13px] font-semibold border cursor-pointer transition-colors max-w-full wrap-anywhere ${on ? `${c.bg} ${c.border} ${c.text}` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                  <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${on ? `${c.checkBg} text-white border-transparent` : 'border border-slate-300 text-transparent'}`}>{on ? '✓' : ''}</span>
                                  <span className="break-words min-w-0">{g.display}</span>
                                  {g.count > 1 && <span className={`text-[11px] shrink-0 ${on ? 'opacity-60' : 'text-slate-400'}`}>×{g.count}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-400">Tap a chip to include or exclude it. Only your selected additions are applied — never all keywords.</p>
                    </div>

                    <div className="shrink-0 pt-3 mt-3 border-t border-slate-200/80">
                      <button onClick={() => handleTailor()} disabled={tailoring || selectedSkills.size === 0} aria-live="polite"
                        title={generateStatus === 'success' ? 'Regenerate CV with the selected skills' : undefined}
                        className={`${btnBase} ${generateStatus === 'error' ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                        {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Tailoring CV…</>
                          : generateStatus === 'error' ? <><AlertTriangle className="w-4 h-4" /> Try Again</>
                          : generateStatus === 'success' ? <><CheckCircle2 className="w-4 h-4" /> CV Generated</>
                          : <><FileText className="w-4 h-4" /> Tailor CV <ArrowRight className="w-4 h-4" /></>}
                      </button>
                      {tailorError && error && <p className="text-xs text-red-600 mt-2">{error}</p>}
                      <p className="text-xs text-slate-400 text-center mt-2">AI will tailor your CV with the selected additions</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* PANEL 3 · ATS result */}
            <div className={panelCls(3)}>
              {tailoring && loadingOverlay('Tailoring your CV…')}
              <div className={`flex flex-col h-full min-h-0 transition-opacity duration-200 ${tailoring ? 'opacity-10' : 'opacity-100'}`}>
                <h2 className="text-[16px] font-bold text-slate-900 mb-3 flex items-center justify-between gap-2 shrink-0">
                  Tailoring updates {stepBadge(3)}
                </h2>
                {!diff ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">Tailor your CV to see updates</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
                      <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="text-[36px] font-bold text-green-600 leading-none shrink-0">{diff.afterScore}%</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            ATS score after tailoring <span className="text-[11px] font-extrabold text-green-600 bg-green-50 border border-green-200 rounded-lg px-1.5 py-0.5 ml-1">+{diff.scoreBoost}%</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{diff.beforeScore}% before → {diff.afterScore}% after</div>
                          <div className="h-1.5 rounded-full bg-slate-200 relative overflow-hidden mt-2">
                            <div className="absolute inset-y-0 bg-green-500" style={{ left: `${diff.beforeScore}%`, width: `${Math.max(0, diff.afterScore - diff.beforeScore)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                            <Plus className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-bold text-green-600 leading-none">+{reviewSkills.length}</div>
                            <div className="text-[9.5px] text-slate-500 mt-1 leading-tight">Skills added</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                            <PenLine className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-bold text-green-600 leading-none">+{reviewBullets.length}</div>
                            <div className="text-[9.5px] text-slate-500 mt-1 leading-tight">Bullets rewritten</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Ban className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-bold text-slate-500 leading-none">{diff.notIntegrable?.length || 0}</div>
                            <div className="text-[9.5px] text-slate-500 mt-1 leading-tight">Skipped — no honest way to add</div>
                          </div>
                        </div>
                      </div>

                      {reviewSkills.length > 0 && (
                        <div>
                          <h3 className="text-[12.5px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                            What's been added
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 rounded-lg px-1.5 py-0.5">{reviewSkills.length}</span>
                            {reviewSkills.length > ADDED_CAP && (
                              <button onClick={() => setShowAllAddedSkills((v) => !v)} className="ml-auto text-[11.5px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                                {showAllAddedSkills ? 'Show less' : `+${reviewSkills.length - ADDED_CAP} more`}
                              </button>
                            )}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 min-w-0">
                            {visibleAddedSkills.map((s) => (
                              <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-semibold bg-green-50 border border-green-200 text-green-700 max-w-full">
                                <Plus className="w-3 h-3 shrink-0" />
                                <span className="break-words min-w-0">{s}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {reviewBullets.length > 0 && (
                        <div>
                          <h3 className="text-[12.5px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                            What's been rewritten
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 rounded-lg px-1.5 py-0.5">{reviewBullets.length}</span>
                            {reviewBullets.length > REWRITE_CAP && (
                              <button onClick={() => setShowAllRewrites((v) => !v)} className="ml-auto text-[11.5px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                                {showAllRewrites ? 'Show less' : `+${reviewBullets.length - REWRITE_CAP} more`}
                              </button>
                            )}
                          </h3>
                          <div className="space-y-1.5">
                            {visibleRewrites.map((br, bi) => (
                              <div key={`rw:${bi}`} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                                <div className="flex items-start gap-2">
                                  <PenLine className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Before</p>
                                    <p className="text-[11.5px] text-slate-400 line-through leading-relaxed break-words mt-0.5" style={clamp1}>{br.original}</p>
                                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-green-600 mt-1.5">After</p>
                                    <p className="text-[12px] text-slate-700 leading-relaxed break-words mt-0.5" style={clamp2}>{br.rewritten}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/70">
                        <h3 className="text-[12.5px] font-bold text-slate-900 mb-1.5">What's preserved</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {['Job titles', 'Employers', 'Employment dates'].map((x) => (
                            <span key={x} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" /> {x}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[12.5px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                          Review changes — remove what you don't like
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 rounded-lg px-1.5 py-0.5">{reviewItems.length}</span>
                        </h3>
                        <div className="divide-y divide-slate-100">
                          {visibleReview.map((item) => {
                            const removed = removedPoints.has(item.key);
                            return item.kind === 'skill' ? (
                              <div key={item.key} className={`flex items-center gap-2.5 py-1.5 ${removed ? 'opacity-40' : ''}`}>
                                <div className="flex-1 text-[12.5px] text-slate-700 min-w-0 break-words">
                                  {removed ? <span className="line-through text-slate-400">Added skill {item.label}</span> : <>Added skill <b className="text-green-600">{item.label}</b></>}
                                </div>
                                <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(item.key); return n; })() : new Set(p).add(item.key))}
                                  aria-label={removed ? `Restore ${item.label}` : `Remove ${item.label}`}
                                  className={`w-7 h-7 rounded-lg border text-[12px] font-bold cursor-pointer transition-colors shrink-0 ${removed ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                                  {removed ? '↺' : '✕'}
                                </button>
                              </div>
                            ) : (
                              <div key={item.key} className={`flex items-start gap-2.5 py-1.5 ${removed ? 'opacity-40' : ''}`}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10.5px] text-slate-400 line-through leading-relaxed break-words" style={clamp1}>{item.original}</p>
                                  <p className={`text-[12px] leading-relaxed break-words mt-0.5 ${removed ? 'line-through text-slate-400' : 'text-slate-700'}`} style={clamp2} title={item.label}>{item.label}</p>
                                </div>
                                <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(item.key); return n; })() : new Set(p).add(item.key))}
                                  aria-label={removed ? 'Restore change' : 'Remove change'}
                                  className={`w-7 h-7 rounded-lg border text-[12px] font-bold cursor-pointer transition-colors shrink-0 ${removed ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                                  {removed ? '↺' : '✕'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {reviewItems.length > REVIEW_CAP && (
                          <button onClick={() => setShowAllReview((v) => !v)} className="w-full mt-2 py-1.5 rounded-lg border border-slate-200 text-[11.5px] font-bold text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
                            {showAllReview ? 'Show less' : `+${reviewItems.length - REVIEW_CAP} more additions`}
                          </button>
                        )}
                        {reviewItems.length === 0 && (
                          <p className="text-xs text-slate-500">No changes to review.</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 pt-3 mt-3 border-t border-slate-200/80 flex gap-2">
                      <button onClick={() => download('pdf')} disabled={!downloadToken} className="flex-1 min-h-[46px] rounded-[10px] bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-40">
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      <button onClick={() => download('txt')} disabled={!downloadToken} className="flex-1 min-h-[46px] rounded-[10px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-40">
                        <Copy className="w-4 h-4" /> Copy text
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 text-center mt-2">Downloading also saves the tailored CV to your history.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT · CV Preview — original + tailored with sliding comparison */}
        <section className="flex-1 min-w-0 bg-white border border-slate-200 border-l-0 rounded-r-[14px] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> CV Preview
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-0.5">
                {([
                  { id: 'harvard', label: 'Harvard' },
                  { id: 'jake', label: 'Jake' },
                  { id: 'atanu', label: 'Atanu' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewTemplate(t.id)}
                    title={`Preview and download in the ${t.label} template`}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors cursor-pointer ${
                      previewTemplate === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="text-[10.5px] font-bold text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                {tailoredCv ? 'Drag to compare' : 'Original CV'}
              </span>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 bg-slate-100" ref={wrapRef}>
            {!tailoredCv ? (
              originalCv ? (
                <div className="absolute inset-0 overflow-y-auto">
                  <CvPdfPreview cv={originalCv} template={previewTemplate} fitToWidth />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <FileText className="w-9 h-9 text-slate-300" />
                  <p className="text-[12px] font-semibold">No CV yet — tailor to compare</p>
                  {!masterCv && <p className="text-[10.5px] text-slate-300">Add your Master CV in the CV screen first</p>}
                </div>
              )
            ) : (
              <>
                {/* ORIGINAL layer */}
                <div
                  ref={oldScrollRef}
                  onScroll={(e) => syncScroll(e.currentTarget, newScrollRef.current)}
                  className="absolute inset-0 overflow-y-auto bg-slate-100"
                >
                  {originalCv && <CvPdfPreview cv={originalCv} template={previewTemplate} fitToWidth />}
                </div>
                {/* TAILORED layer (clipped by the slider) */}
                {newCv && (
                  <div
                    ref={newScrollRef}
                    onScroll={(e) => syncScroll(e.currentTarget, oldScrollRef.current)}
                    className="absolute inset-0 overflow-y-auto bg-slate-100"
                    style={{ clipPath: `inset(0 0 0 ${cut}%)` }}
                  >
                    <CvPdfPreview cv={newCv} template={previewTemplate} fitToWidth />
                  </div>
                )}
                {/* Handle */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-blue-600 z-10 cursor-ew-resize"
                  style={{ left: `${cut}%` }}
                  onPointerDown={(e) => { e.preventDefault(); draggingRef.current = true; }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-md">
                    <ChevronsLeftRight className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                {/* Tags */}
                <span className="absolute top-3 left-3 z-10 text-[10px] font-extrabold tracking-wide text-slate-500 bg-white/95 border border-slate-200 rounded-full px-2.5 py-1 shadow-sm">ORIGINAL</span>
                <span className="absolute top-3 right-3 z-10 text-[10px] font-extrabold tracking-wide text-blue-600 bg-blue-50/95 border border-blue-200 rounded-full px-2.5 py-1 shadow-sm">TAILORED</span>
                {cvLoadFailed && (
                  <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
                    <span className="text-[10.5px] font-semibold text-amber-700 bg-amber-50/95 border border-amber-200 rounded-full px-3 py-1.5 shadow-sm">
                      Tailored CV unavailable — download it from the workspace
                    </span>
                  </div>
                )}
                {!cvLoadFailed && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[10.5px] font-semibold text-slate-600 bg-white/95 border border-slate-200 rounded-full px-3 py-1.5 shadow-sm whitespace-nowrap">
                    ↔ Drag to slide between Original &amp; Tailored
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 pb-3 pt-2 shrink-0">
        © 2025 Tailor CV by Atanu. All rights reserved.
      </footer>

      {/* History overlay */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
          <div className="w-full max-w-md bg-white h-full flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">Manual JD history</h2>
              <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {historyMsg && <p className="text-[11.5px] font-semibold text-blue-700">{historyMsg}</p>}
              {historyLoading && <p className="text-[12px] text-slate-400">Loading…</p>}
              {!historyLoading && history.length === 0 && <p className="text-[12px] text-slate-400 text-center py-10">No analyses yet.</p>}
              {history.map((h) => (
                <div key={h.id} onClick={() => restoreAnalysis(h.id)} className={`border rounded-xl p-3 cursor-pointer transition-colors ${historyId === h.id ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{h.role || 'Untitled role'}</p>
                      <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                        {h.company || '—'} · {new Date(h.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${h.score >= 75 ? 'bg-emerald-50 text-emerald-700' : h.score >= 50 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {h.score}%
                      </span>
                      {h.hasTailoredCv && <span className="text-[9px] font-bold text-green-600 bg-green-50 rounded-lg px-1.5 py-0.5">Tailored</span>}
                      <button onClick={(e) => deleteHistoryEntry(h.id, e)} className="p-1 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
