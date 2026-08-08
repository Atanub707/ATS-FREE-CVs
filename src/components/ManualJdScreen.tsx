import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Loader2, Sparkles, Download, FileText, CheckCircle2, ArrowRight, History, Trash2 } from 'lucide-react';
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
      const a = await res.json();
      setTitle(a.role || '');
      setCompany(a.company || '');
      setDescription(a.description || '');
      setResult({ matchScore: a.score, gapAnalysis: a.gap_analysis || { matchingSkills: [], missingSkills: [], keyRecommendations: [], missingKeywords: [], matchedKeywords: [] } });
      const missing = a.gap_analysis?.missingSkills || [];
      setSelectedSkills(new Set(missing));
      setRemovedPoints(new Set());
      setDiff(a.diff || null);
      setHistoryId(a.id);
      setHistoryOpen(false);
      if (a.tailored_cv && a.diff?.scoreBoost !== undefined) setDownloadToken(`restored-${a.id}`);
    } catch (e: any) { setError(e.message); }
  };

  const deleteHistoryEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch(`/api/manual-jd/history/${id}`, { method: 'DELETE' });
    if (res.ok) setHistory((h) => h.filter((x) => x.id !== id));
  };

  const handleAnalyze = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true); setError(''); setResult(null); setDiff(null); setDownloadToken(null);
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
      setSelectedSkills(new Set(missing));
      setRemovedPoints(new Set());
      if (data.historyId) setHistoryId(data.historyId);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleTailor = async (skillsOverride?: string[]) => {
    setTailoring(true); setError('');
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
      if (!res.ok) { setError(data.error || 'Tailoring failed'); alert(llmErrorMessage(data.code, data.error)); return; }
      setDownloadToken(data.downloadToken);
      if (data.diff) setDiff(data.diff);
      if (data.historyId) setHistoryId(data.historyId);
    } catch (e: any) { setError(e.message); }
    finally { setTailoring(false); }
  };

  const handleRegenerate = async () => {
    const keep = [...selectedSkills].filter((s) => !removedPoints.has(s));
    setSelectedSkills(new Set(keep));
    setRemovedPoints(new Set());
    await handleTailor(keep);
  };

  const download = () => {
    if (!downloadToken) return;
    window.open(`/api/analyze-jd/download?token=${downloadToken}&format=pdf`, '_blank');
  };

  const missing = result?.gapAnalysis?.missingSkills || [];
  const missingKw = result?.gapAnalysis?.missingKeywords || [];
  const displayScore = diff ? diff.afterScore : result?.matchScore ?? 0;
  const step = !result ? 1 : !diff ? 2 : 3;
  const reviewSkills: string[] = diff ? diff.addedAfter.skillsAdded || [] : [];
  const reviewBullets: { original: string; rewritten: string }[] = diff?.bulletRewrites || [];

  const panelStyle = (n: 1 | 2 | 3): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute', top: 6, bottom: 6, background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 12, padding: '18px 20px', transition: 'left .55s cubic-bezier(.25,.8,.3,1), width .55s cubic-bezier(.25,.8,.3,1), opacity .35s ease',
      opacity: 0, pointerEvents: 'none',
    };
    if (step === 1) {
      if (n === 1) return { ...base, left: '27%', width: '46%', opacity: 1, pointerEvents: 'auto' };
      return base;
    }
    if (step === 2) {
      if (n === 1) return { ...base, left: '2%', width: '46%', opacity: 1, pointerEvents: 'auto' };
      if (n === 2) return { ...base, left: '52%', width: '46%', opacity: 1, pointerEvents: 'auto' };
      return base;
    }
    const left = n === 1 ? '2%' : n === 2 ? '34.5%' : '67%';
    return { ...base, left, width: '31%', opacity: 1, pointerEvents: 'auto' };
  };

  const spinner = (text: string) => (
    <div className="absolute inset-0 bg-white/80 rounded-2xl flex flex-col items-center justify-center gap-3 z-10">
      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      <p className="text-[12px] font-bold text-slate-500">{text}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 text-slate-700 flex flex-col font-sans">
      {/* Header */}
      <div className="px-5 sm:px-8 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Manual JD</h1>
            <p className="text-[11.5px] text-slate-500">Paste a job description — get a tailored CV in 3 simple steps.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openHistory} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
            <History className="w-3.5 h-3.5" /> History
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 sm:px-8 pt-4 flex items-center gap-2 flex-wrap shrink-0">
        {[
          { n: 1, label: 'Add JD', on: step >= 1 },
          { n: 2, label: 'Analysis', on: step >= 2 },
          { n: 3, label: 'Tailor', on: step >= 3 },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <ArrowRight className="w-3 h-3 text-slate-300" />}
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              s.on ? 'bg-slate-900 border-slate-900 text-white' : step === s.n ? 'bg-white border-slate-900 text-slate-900' : 'bg-white border-slate-200 text-slate-500 opacity-60'
            }`}>
              <span className={`w-4.5 h-4.5 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${s.on ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{s.on ? '✓' : s.n}</span>
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {error && <p className="px-5 sm:px-8 pt-3 text-[12px] text-red-600">{error}</p>}

      {/* Centered stage — panels pop in, never leave the screen */}
      <div className="flex-1 overflow-hidden">
        <div className="relative mx-auto" style={{ width: 'min(1040px, 94vw)', height: '100%', paddingTop: 10 }}>
          {/* PANEL 1: Add JD */}
          <div style={panelStyle(1)}>
            <h2 className="text-[13.5px] font-bold text-slate-900 mb-3.5 flex items-center justify-between">
              Add job description <span className="text-[10px] font-extrabold bg-slate-900 text-white rounded-lg px-2.5 py-0.5">1</span>
            </h2>
            <div className="mb-3">
              <label className="block text-[11.5px] font-bold text-slate-600 mb-1.5">Role name</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DevOps Engineer"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-[13px] bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 outline-none transition-colors" />
            </div>
            <div className="mb-3">
              <label className="block text-[11.5px] font-bold text-slate-600 mb-1.5">Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-[13px] bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 outline-none transition-colors" />
            </div>
            <div className="mb-3">
              <label className="block text-[11.5px] font-bold text-slate-600 mb-1.5">Job description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8}
                placeholder="Paste the full job description…"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-[12.5px] bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 outline-none resize-y leading-relaxed" />
              <p className="text-right text-[10.5px] text-slate-400 mt-1">{description.length.toLocaleString()} chars</p>
            </div>
            <button onClick={handleAnalyze} disabled={loading || !title.trim() || !description.trim()}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> Analyze Match</>}
            </button>
            <p className="text-center text-[10.5px] text-slate-500 mt-2">Everything stays on your machine</p>
          </div>

          {/* PANEL 2: Analysis */}
          <div style={panelStyle(2)}>
            {loading && spinner('Analyzing your CV against the JD…')}
            <h2 className="text-[13.5px] font-bold text-slate-900 mb-3.5 flex items-center justify-between">
              Analysis <span className="text-[10px] font-extrabold bg-slate-900 text-white rounded-lg px-2.5 py-0.5">2</span>
            </h2>
            {!result ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-[13px] font-bold text-slate-500">Click Analyze Match to begin</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-4xl font-extrabold text-blue-600 leading-none">{displayScore}%</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold text-slate-900">
                      {(result.gapAnalysis.matchingSkills || []).length} of {missing.length + (result.gapAnalysis.matchingSkills || []).length} skills matched
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">Good fit — pick the missing skills to improve</div>
                  </div>
                </div>
                <h3 className="text-[12px] font-bold text-slate-900">Pick skills to add</h3>
                {missing.length === 0 && missingKw.length === 0 ? (
                  <p className="text-[12px] text-slate-500">No missing skills detected — your CV already covers this JD well.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([...missing, ...missingKw])].map((s) => {
                      const on = selectedSkills.has(s);
                      const n = countInJd(s, description);
                      return (
                        <button key={s} onClick={() => setSelectedSkills((p) => { const n2 = new Set(p); if (n2.has(s)) n2.delete(s); else n2.add(s); return n2; })}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold border cursor-pointer transition-colors ${on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${on ? 'bg-white text-slate-900 border-white' : 'border-slate-300'}`}>{on ? '✓' : ''}</span>
                          {s}{n > 0 && <span className="text-[9.5px] opacity-70">×{n}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Unselected skills are never added.</p>
                <button onClick={() => handleTailor()} disabled={tailoring || selectedSkills.size === 0}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                  {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Tailor CV</>}
                </button>
              </div>
            )}
          </div>

          {/* PANEL 3: Tailoring updates */}
          <div style={panelStyle(3)}>
            {tailoring && spinner('Tailoring your CV…')}
            <h2 className="text-[13.5px] font-bold text-slate-900 mb-3.5 flex items-center justify-between">
              Tailoring updates <span className="text-[10px] font-extrabold bg-slate-900 text-white rounded-lg px-2.5 py-0.5">3</span>
            </h2>
            {!diff ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-[13px] font-bold text-slate-500">Tailor your CV to see updates</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-green-600">+{diff.scoreBoost}%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ATS score boost ({diff.beforeScore}% → {diff.afterScore}%)</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-green-600">+{reviewSkills.length}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">skills added</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-green-600">+{reviewBullets.length}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">bullets rewritten</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-slate-500">{diff.notIntegrable?.length || 0}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">skipped — no honest way to add</div>
                  </div>
                </div>
                <h3 className="text-[12px] font-bold text-slate-900">Review changes — remove what you don't like</h3>
                {reviewSkills.map((s) => {
                  const removed = removedPoints.has(`skill:${s}`);
                  return (
                    <div key={`skill:${s}`} className={`flex items-start gap-2.5 py-2 border-b border-slate-100 ${removed ? 'opacity-40' : ''}`}>
                      <div className="flex-1 text-[12px] text-slate-700 leading-relaxed">
                        {removed ? <span className="line-through text-[#64748B]">Added skill {s}</span> : <>Added skill <b className="text-green-600">{s}</b></>}
                      </div>
                      <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(`skill:${s}`); return n; })() : new Set(p).add(`skill:${s}`))}
                        className={`w-6 h-6 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${removed ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                        {removed ? '↺' : '✕'}
                      </button>
                    </div>
                  );
                })}
                {reviewBullets.map((br, bi) => {
                  const key = `bullet:${bi}`;
                  const removed = removedPoints.has(key);
                  return (
                    <div key={key} className={`py-2 border-b border-slate-100 ${removed ? 'opacity-40' : ''}`}>
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Before</div>
                      <p className="text-[11px] text-[#64748B] line-through leading-relaxed">{br.original}</p>
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-green-600 mt-2 mb-1">After</div>
                      <div className="flex items-start gap-2.5">
                        <p className="flex-1 text-[11.5px] text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">{br.rewritten}</p>
                        <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(key); return n; })() : new Set(p).add(key))}
                          className={`w-6 h-6 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${removed ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                          {removed ? '↺' : '✕'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {reviewSkills.length === 0 && reviewBullets.length === 0 && (
                  <p className="text-[12px] text-slate-500">No changes to review.</p>
                )}
                {removedPoints.size > 0 && (
                  <button onClick={handleRegenerate} disabled={tailoring}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                    {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating…</> : <><Sparkles className="w-4 h-4" /> Regenerate without the removed changes</>}
                  </button>
                )}
                <div className="flex gap-2.5 pt-1">
                  <button onClick={download} className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                    <Download className="w-4 h-4" /> Download Tailored CV
                  </button>
                  <button onClick={openHistory} className="py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </button>
                </div>
                <button onClick={() => setDiff(null)} className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-[12px] cursor-pointer transition-colors">
                  ← Back to analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
