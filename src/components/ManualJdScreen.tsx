import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Loader2, Sparkles, Download, FileText, CheckCircle2, ArrowRight, History, Trash2, AlertTriangle, TrendingUp, Plus, PenLine, Ban } from 'lucide-react';
import { llmErrorMessage } from '../lib/llmError';
import { MasterCv } from '../types';

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

export const ManualJdScreen: React.FC<ManualJdScreenProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
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

  useEffect(() => {
    if (isOpen && historyOpen) loadHistory();
  }, [isOpen, historyOpen]);

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
      if ((a.tailored_cv || a.tailoredCv) && a.diff?.scoreBoost !== undefined) setDownloadToken(payload.downloadToken || `restored-${a.id}`);
    } catch (e: any) { setError(e.message); }
  };

  const deleteHistoryEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/manual-jd/history/${id}`, { method: 'DELETE' });
    if (res.ok) setHistory((h) => h.filter((x) => x.id !== id));
  };

  const handleAnalyze = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true); setError(''); setTailorError(false); setResult(null); setDiff(null); setDownloadToken(null);
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
    } catch (e: any) { setError(e.message); }
    finally { setTailoring(false); }
  };

  const download = () => {
    if (!downloadToken) return;
    window.open(`/api/analyze-jd/download?token=${downloadToken}&format=pdf`, '_blank');
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

  // Pop-in stage — panels appear ONE BY ONE, never all at once
  const panelStyle = (n: 1 | 2 | 3): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute', top: 6, bottom: 6, background: '#fff', border: '1px solid #E2E8F0',
      borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      opacity: 0, pointerEvents: 'none',
      transition: 'left .55s cubic-bezier(.25,.8,.3,1), width .55s cubic-bezier(.25,.8,.3,1), opacity .3s ease, transform .45s cubic-bezier(.25,.8,.3,1)',
      transform: 'translateX(24px) scale(.97)',
    };
    if (step === 1) {
      if (n === 1) return { ...base, left: '27%', width: '46%', opacity: 1, pointerEvents: 'auto', transform: 'none' };
      return base;
    }
    if (step === 2) {
      if (n === 1) return { ...base, left: '2%', width: '46%', opacity: 1, pointerEvents: 'auto', transform: 'none' };
      if (n === 2) return { ...base, left: '52%', width: '46%', opacity: 1, pointerEvents: 'auto', transform: 'none' };
      return base;
    }
    const left = n === 1 ? '2%' : n === 2 ? '34.5%' : '67%';
    return { ...base, left, width: '31%', opacity: 1, pointerEvents: 'auto', transform: 'none' };
  };

  const stepBadge = (n: number) => (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[13px] font-bold shrink-0 ${step >= n ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
  );

  const loadingOverlay = (text: string) => (
    <div className="absolute inset-0 z-10 bg-white/90 rounded-[14px] flex flex-col items-center justify-center gap-3">
      <div className="w-[30px] h-[30px] border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      <p className="text-[12px] font-semibold text-slate-500">{text}</p>
    </div>
  );

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

      {/* Workflow stepper */}
      <div className="px-5 sm:px-8 pt-4 flex items-center justify-center gap-2 flex-wrap shrink-0">
        {[
          { n: 1, label: 'Add JD', on: step >= 2 },
          { n: 2, label: 'Analysis', on: step >= 3 },
          { n: 3, label: 'Tailor', on: step >= 3 && !tailoring },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <ArrowRight className="w-3 h-3 text-slate-300" />}
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              s.on ? 'bg-slate-900 border-slate-900 text-white' : step === s.n ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <span className={`w-4.5 h-4.5 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${s.on || step === s.n ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{s.on ? '✓' : s.n}</span>
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {error && <p className="px-5 sm:px-8 pt-3 text-[12px] text-red-600">{error}</p>}

      {/* Centered stage — ONE panel at a time, popping in step by step */}
      <div className="flex-1 overflow-hidden">
        <div className="relative mx-auto" style={{ width: '100%', height: '100%', padding: '10px 32px 0' }}>
          {/* PANEL 1 · Add job description (centered, step 1) */}
          <div style={panelStyle(1)} className="overflow-hidden">
            <h2 className="text-[18px] font-bold text-slate-900 mb-4 flex items-center justify-between gap-2">
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
                <textarea id="mj-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={8}
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

          {/* PANEL 2 · Analysis (pops in on the right with loading) */}
          <div style={panelStyle(2)} className="overflow-hidden">
            {loading && loadingOverlay('Analyzing your CV against the JD…')}
            <div className={`flex flex-col h-full min-h-0 transition-opacity duration-200 ${loading ? 'opacity-10' : 'opacity-100'}`}>
              <h2 className="text-[18px] font-bold text-slate-900 mb-3 flex items-center justify-between gap-2 shrink-0">
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

          {/* PANEL 3 · Tailoring updates (pops in on the right with loading) */}
          <div style={panelStyle(3)} className="overflow-hidden">
            {tailoring && loadingOverlay('Tailoring your CV…')}
            <div className={`flex flex-col h-full min-h-0 transition-opacity duration-200 ${tailoring ? 'opacity-10' : 'opacity-100'}`}>
              <h2 className="text-[18px] font-bold text-slate-900 mb-3 flex items-center justify-between gap-2 shrink-0">
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
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-bold text-green-600 leading-none">{diff.beforeScore}% → {diff.afterScore}%</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-tight">ATS score boost +{diff.scoreBoost}%</div>
                          <div className="h-1.5 rounded-full bg-slate-200 relative overflow-hidden mt-1.5">
                            <div className="absolute inset-y-0 bg-green-500" style={{ left: `${diff.beforeScore}%`, width: `${Math.max(0, diff.afterScore - diff.beforeScore)}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                          <Plus className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[17px] font-bold text-green-600 leading-none">+{reviewSkills.length}</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-tight">Skills added</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                          <PenLine className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[17px] font-bold text-green-600 leading-none">+{reviewBullets.length}</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-tight">Bullets rewritten</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <Ban className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[17px] font-bold text-slate-500 leading-none">{diff.notIntegrable?.length || 0}</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-tight">Skipped — no honest way to add</div>
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
                  <div className="shrink-0 pt-3 mt-3 border-t border-slate-200/80">
                    <button onClick={download} disabled={!downloadToken} className="w-full min-h-[48px] rounded-[10px] bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-40">
                      <Download className="w-4 h-4" /> Download Tailored CV
                    </button>
                    <p className="text-[11px] text-slate-400 text-center mt-2">Downloading also saves the tailored CV to your history.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
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
