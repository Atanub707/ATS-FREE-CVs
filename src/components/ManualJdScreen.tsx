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
  const [stage, setStage] = useState<'analysis' | 'review'>('analysis');
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
      setStage(a.diff ? 'review' : 'analysis');
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
    setLoading(true); setError(''); setResult(null); setDiff(null); setDownloadToken(null); setStage('analysis');
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
      if (data.diff) { setDiff(data.diff); setStage('review'); }
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
  const score = result?.matchScore ?? 0;
  const displayScore = diff ? diff.afterScore : score;
  const currentStep = !result ? 1 : !diff ? 2 : 3;
  const reviewSkills: string[] = diff ? diff.addedAfter.skillsAdded || [] : [];
  const reviewBullets: { original: string; rewritten: string }[] = diff?.bulletRewrites || [];

  return (
    <div className="fixed inset-0 z-40 bg-[#F0FDFA] text-[#164E63] flex flex-col font-sans">
      {/* Header */}
      <div className="px-5 sm:px-8 py-4 border-b border-[#A5F3FC] bg-white/70 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-[#0E7490] bg-[#ECFEFF] border border-[#A5F3FC] hover:bg-[#CFFAFE] transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-[#155E75] tracking-tight">Manual JD</h1>
            <p className="text-[11.5px] text-[#0E7490]">Paste a job description — get a tailored CV in 4 simple steps.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openHistory} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-[#0E7490] bg-[#ECFEFF] border border-[#A5F3FC] hover:bg-[#CFFAFE] transition-colors cursor-pointer">
            <History className="w-3.5 h-3.5" /> History
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#0E7490] hover:bg-[#ECFEFF] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 sm:px-8 pt-4 flex items-center gap-2 flex-wrap shrink-0">
        {[
          { n: 1, label: 'Paste JD', on: !!result },
          { n: 2, label: 'Pick skills', on: currentStep >= 2 },
          { n: 3, label: 'Review', on: currentStep >= 3 },
          { n: 4, label: 'Download', on: !!downloadToken },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            {i > 0 && <ArrowRight className="w-3 h-3 text-[#99F6E4]" />}
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
              s.on ? 'bg-[#0891B2] border-[#0891B2] text-white' : currentStep === s.n ? 'bg-white border-[#0891B2] text-[#155E75]' : 'bg-white border-[#A5F3FC] text-[#0E7490] opacity-60'
            }`}>
              <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${s.on ? 'bg-white/25' : 'bg-[#CFFAFE] text-[#0E7490]'}`}>{s.on ? '✓' : s.n}</span>
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {error && <p className="px-5 sm:px-8 pt-3 text-[12px] text-red-600">{error}</p>}

      {/* Sliding track: Add JD | Analysis | Tailoring updates */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="max-w-5xl mx-auto p-5 sm:p-8 overflow-hidden">
          <div
            className="flex gap-[18px]"
            style={{
              transform: stage === 'review' ? 'translateX(calc(-50% - 9px))' : 'translateX(0)',
              transition: 'transform .55s cubic-bezier(.25,.8,.3,1)',
            }}
          >
          {/* PANEL 1: inputs */}
          <div className="bg-white border border-[#A5F3FC] rounded-2xl p-5 space-y-3.5 self-start" style={{ flex: '0 0 calc((100% - 18px) / 2)' }}>
            <h2 className="text-[13.5px] font-bold text-[#155E75]">Job details</h2>
            <div>
              <label className="block text-[11.5px] font-bold text-[#0E7490] mb-1.5">Role name</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DevOps Engineer"
                className="w-full border border-[#CFFAFE] rounded-xl px-3.5 py-2.5 text-[13px] bg-[#F0FDFA] focus:bg-white focus:border-[#0891B2] outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-[#0E7490] mb-1.5">Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name"
                className="w-full border border-[#CFFAFE] rounded-xl px-3.5 py-2.5 text-[13px] bg-[#F0FDFA] focus:bg-white focus:border-[#0891B2] outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-[#0E7490] mb-1.5">Job description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={10}
                placeholder="Paste the full job description…"
                className="w-full border border-[#CFFAFE] rounded-xl px-3.5 py-2.5 text-[12.5px] bg-[#F0FDFA] focus:bg-white focus:border-[#0891B2] outline-none resize-y leading-relaxed" />
              <p className="text-right text-[10.5px] text-[#0E7490] mt-1">{description.length.toLocaleString()} chars</p>
            </div>
            <button onClick={handleAnalyze} disabled={loading || !title.trim() || !description.trim()}
              className="w-full py-2.5 rounded-xl bg-[#0891B2] hover:opacity-85 disabled:opacity-40 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> Analyze Match</>}
            </button>
            <p className="text-center text-[10.5px] text-[#0E7490]">Everything stays on your machine</p>
          </div>

          {/* PANEL 2: analysis + pick skills */}
          <div className="bg-white border border-[#A5F3FC] rounded-2xl p-5" style={{ flex: '0 0 calc((100% - 18px) / 2)' }}>
            {!result ? (
              <div className="min-h-[380px] flex items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#ECFEFF] border border-[#A5F3FC] flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#22D3EE]" />
                  </div>
                  <p className="text-[13.5px] font-bold text-[#0E7490]">Insights will appear here</p>
                  <p className="text-[12px] text-[#0E7490] mt-1">Score, skill picker, and the review — all on this side.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score */}
                <div className="flex items-center gap-4 p-4 bg-[#F0FDFA] border border-[#A5F3FC] rounded-xl">
                  <div className="text-4xl font-extrabold text-[#0891B2] leading-none">{displayScore}%</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold text-[#155E75]">
                      {diff ? `Improved from ${diff.beforeScore}% to ${diff.afterScore}%` : `${(result.gapAnalysis.matchingSkills || []).length} of ${missing.length + (result.gapAnalysis.matchingSkills || []).length} skills matched`}
                    </div>
                    <div className="text-[11.5px] text-[#0E7490] mt-0.5">
                      {diff ? `${reviewSkills.length} skills added · ${reviewBullets.length} bullets rewritten` : 'Good fit — pick the missing skills to improve'}
                    </div>
                  </div>
                  {diff && <span className="text-[11px] font-bold text-[#15803D] bg-[#DCFCE7] rounded-full px-2.5 py-1 shrink-0">+{diff.scoreBoost}% boost</span>}
                </div>

                {/* Step 2: skill picker */}
                {!diff && (
                  <>
                    <h3 className="text-[12.5px] font-bold text-[#155E75]">Pick skills to add</h3>
                    {missing.length === 0 && missingKw.length === 0 ? (
                      <p className="text-[12px] text-[#0E7490]">No missing skills detected — your CV already covers this JD well.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {[...new Set([...missing, ...missingKw])].map((s) => {
                          const on = selectedSkills.has(s);
                          const n = countInJd(s, description);
                          return (
                            <button key={s} onClick={() => setSelectedSkills((p) => { const n2 = new Set(p); if (n2.has(s)) n2.delete(s); else n2.add(s); return n2; })}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold border cursor-pointer transition-colors ${on ? 'bg-[#0891B2] border-[#0891B2] text-white' : 'bg-white border-[#A5F3FC] text-[#0E7490] opacity-60 hover:opacity-100'}`}>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${on ? 'bg-white text-[#0891B2] border-white' : 'border-[#99F6E4]'}`}>{on ? '✓' : ''}</span>
                              {s}{n > 0 && <span className="text-[9.5px] opacity-70">×{n}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-[#0E7490]">Unselected skills are never added.</p>
                    <button onClick={() => handleTailor()} disabled={tailoring || selectedSkills.size === 0}
                      className="w-full py-2.5 rounded-xl bg-[#22C55E] hover:opacity-85 disabled:opacity-40 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                      {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Tailored CV</>}
                    </button>
                  </>
                )}

              </div>
            )}
          </div>

          {/* PANEL 3: tailoring updates — slides in from the right */}
          <div className="bg-white border border-[#A5F3FC] rounded-2xl p-5" style={{ flex: '0 0 calc((100% - 18px) / 2)' }}>
            {!diff ? (
              <div className="min-h-[380px] flex items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#ECFEFF] border border-[#A5F3FC] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#22D3EE]" />
                  </div>
                  <p className="text-[13.5px] font-bold text-[#0E7490]">Tailoring updates</p>
                  <p className="text-[12px] text-[#0E7490] mt-1">Generate the tailored CV — this panel slides in.</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-[13.5px] font-bold text-[#155E75] mb-4">Tailoring updates</h2>
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="bg-[#F0FDFA] border border-[#A5F3FC] rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-[#15803D]">+{diff.scoreBoost}%</div>
                    <div className="text-[10px] text-[#0E7490] mt-0.5">ATS score boost ({diff.beforeScore}% → {diff.afterScore}%)</div>
                  </div>
                  <div className="bg-[#F0FDFA] border border-[#A5F3FC] rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-[#15803D]">+{reviewSkills.length}</div>
                    <div className="text-[10px] text-[#0E7490] mt-0.5">skills added</div>
                  </div>
                  <div className="bg-[#F0FDFA] border border-[#A5F3FC] rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-[#15803D]">+{reviewBullets.length}</div>
                    <div className="text-[10px] text-[#0E7490] mt-0.5">bullets rewritten</div>
                  </div>
                  <div className="bg-[#F0FDFA] border border-[#A5F3FC] rounded-xl px-3.5 py-3">
                    <div className="text-xl font-extrabold text-[#0E7490]">{diff.notIntegrable?.length || 0}</div>
                    <div className="text-[10px] text-[#0E7490] mt-0.5">skipped — no honest way to add</div>
                  </div>
                </div>
                <h3 className="text-[12.5px] font-bold text-[#155E75]">Review changes — remove what you don't like</h3>
                    {reviewSkills.map((s) => {
                      const removed = removedPoints.has(`skill:${s}`);
                      return (
                        <div key={`skill:${s}`} className={`flex items-start gap-2.5 py-2 border-b border-[#CFFAFE] last:border-b-0 ${removed ? 'opacity-40' : ''}`}>
                          <div className="flex-1 text-[12.5px] text-[#164E63] leading-relaxed">
                            {removed ? <span className="line-through text-[#64748B]">Added skill {s}</span> : <>Added skill <b className="text-[#15803D]">{s}</b></>}
                          </div>
                          <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(`skill:${s}`); return n; })() : new Set(p).add(`skill:${s}`))}
                            className={`w-6 h-6 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${removed ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]' : 'bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626] hover:bg-[#FECACA]'}`}>
                            {removed ? '↺' : '✕'}
                          </button>
                        </div>
                      );
                    })}
                    {reviewBullets.map((br, bi) => {
                      const key = `bullet:${bi}`;
                      const removed = removedPoints.has(key);
                      return (
                        <div key={key} className={`py-2.5 border-b border-[#CFFAFE] last:border-b-0 ${removed ? 'opacity-40' : ''}`}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Before</div>
                          <p className="text-[11.5px] text-[#64748B] line-through leading-relaxed">{br.original}</p>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#15803D] mt-2 mb-1">After</div>
                          <div className="flex items-start gap-2.5">
                            <p className="flex-1 text-[12px] text-[#164E63] leading-relaxed bg-[#F0FDFA] border border-[#A5F3FC] rounded-lg px-2.5 py-2">{br.rewritten}</p>
                            <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(key); return n; })() : new Set(p).add(key))}
                              className={`w-6 h-6 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${removed ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]' : 'bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626] hover:bg-[#FECACA]'}`}>
                              {removed ? '↺' : '✕'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {reviewSkills.length === 0 && reviewBullets.length === 0 && (
                      <p className="text-[12px] text-[#0E7490]">No changes to review.</p>
                    )}
                    {removedPoints.size > 0 && (
                      <button onClick={handleRegenerate} disabled={tailoring}
                        className="w-full py-2.5 rounded-xl bg-[#0891B2] hover:opacity-85 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                        {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating…</> : <><Sparkles className="w-4 h-4" /> Regenerate without the removed changes</>}
                      </button>
                    )}
                    <div className="flex gap-2.5 pt-2">
                      <button onClick={download} className="flex-1 py-2.5 rounded-xl bg-[#22C55E] hover:opacity-85 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                        <Download className="w-4 h-4" /> Download Tailored CV
                      </button>
                      <button onClick={openHistory} className="py-2.5 px-4 rounded-xl bg-[#ECFEFF] hover:bg-[#CFFAFE] text-[#0E7490] font-bold text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Saved
                      </button>
                    </div>
                    <button onClick={() => setStage('analysis')} className="mt-2 w-full py-2 rounded-xl bg-[#ECFEFF] hover:bg-[#CFFAFE] text-[#0E7490] font-bold text-[12px] cursor-pointer transition-colors">
                      ← Back to analysis
                    </button>
                  </>
                )}
          </div>
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
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${h.score >= 75 ? 'bg-emerald-50 text-emerald-700' : h.score >= 50 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {h.score}%
                      </span>
                      {h.hasTailoredCv && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">Tailored</span>}
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
