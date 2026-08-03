import React, { useState } from 'react';
import { X, Loader2, Sparkles, Download, FileText, ArrowRight, CheckCircle2, AlertTriangle, Users, Clock, Zap, TrendingUp } from 'lucide-react';

interface ManualJdScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiffPayload {
  beforeScore: number;
  afterScore: number;
  scoreBoost: number;
  scoreBreakdown: { alreadyMatched: number; newlyIntegrated: number; remainingGap: number };
  missingBefore: { skills: string[]; keywords: string[] };
  addedAfter: {
    keywordsIncorporated: string[];
    keywordsInExperience: string[];
    keywordsInSkills: string[];
    rephrasedHighlightsCount: number;
    skillsAdded: string[];
  };
  notIntegrable: string[];
  auditNotes: string[];
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

// Count how many times a term appears in the JD (for "why" tooltips)
function countInJd(term: string, jd: string): number {
  const t = term.toLowerCase();
  const hay = jd.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = hay.indexOf(t, idx)) !== -1) {
    count++;
    idx += t.length;
  }
  return count;
}

// Find the JD sentence containing the term (for context)
function contextInJd(term: string, jd: string): string {
  const t = term.toLowerCase();
  const hay = jd.toLowerCase();
  const idx = hay.indexOf(t);
  if (idx === -1) return '';
  const start = Math.max(0, hay.lastIndexOf('.', idx - 1) + 1);
  const end = hay.indexOf('.', idx);
  const sentence = jd.slice(start, end === -1 ? idx + t.length + 40 : end + 1).trim();
  return sentence.length > 120 ? sentence.slice(0, 117) + '…' : sentence;
}

export const ManualJdScreen: React.FC<ManualJdScreenProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
      if (!res.ok) { setError(data.error || 'Analysis failed'); return; }
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleTailor = async () => {
    setTailoring(true); setError('');
    try {
      const res = await fetch('/api/analyze-jd/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), company: company.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Tailoring failed'); return; }
      setDownloadToken(data.downloadToken);
      if (data.diff) setDiff(data.diff);
    } catch (e: any) { setError(e.message); }
    finally { setTailoring(false); }
  };

  const download = () => {
    if (!downloadToken) return;
    window.open(`/api/analyze-jd/download?token=${downloadToken}&format=pdf`, '_blank');
  };

  const score = result?.matchScore ?? 0;
  const color = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-blue-600' : score >= 30 ? 'text-amber-600' : 'text-red-600';
  const verdict = score >= 75 ? 'Strong fit — worth tailoring' : score >= 50 ? 'Decent fit — tailoring will help' : 'Weak fit — consider other roles';
  const missing = result?.gapAnalysis?.missingSkills || [];
  const missingKw = result?.gapAnalysis?.missingKeywords || [];

  const ringC = 2 * Math.PI * 27;

  return (
    <div className="fixed inset-0 z-40 bg-white text-slate-900 flex">
      {/* LEFT: INPUT + ANALYSIS */}
      <div className="w-[44%] min-w-[420px] border-r border-slate-200 flex flex-col bg-white">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Manual Job Analysis</h2>
              <p className="text-[10.5px] text-slate-400 font-medium">Paste a JD — get scored, then see exactly what your CV gains</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input */}
        <div className="overflow-y-auto px-5 pt-4 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Job Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior DevOps Engineer"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Google"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Job Description *</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={14}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y font-mono leading-relaxed"
              />
              <span className="absolute right-2.5 bottom-2 text-[10px] font-semibold text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
                {description.length.toLocaleString()} chars
              </span>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={loading || !title.trim() || !description.trim()}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-blue-600/20 transition-colors"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Analyzing against your CV…</span></>
              : <><Sparkles className="w-4 h-4" /><span>Analyze Match</span></>}
          </button>

          {/* Analysis results */}
          {result && (
            <div className="space-y-4 animate-[fadeIn_.3s_ease]">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                {/* Score ring */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="#EFF1F5" strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="27" fill="none"
                      stroke={score >= 75 ? '#0FA968' : score >= 50 ? '#2F54EB' : score >= 30 ? '#D97706' : '#DC2626'}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={ringC}
                      strokeDashoffset={ringC * (1 - score / 100)}
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1)' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-base font-extrabold ${color}`}>{score}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900">{verdict}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {result.gapAnalysis?.matchingSkills?.length || 0} of {(result.gapAnalysis?.matchingSkills?.length || 0) + missing.length} required skills already present
                  </div>
                  {missing.length > 0 && (
                    <div className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-1.5">
                      <TrendingUp className="w-3 h-3" />
                      <span>Tailor boost: +{Math.min(30, Math.round((missing.length + missingKw.length) * 3))}% projected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Matched chips */}
              {result.gapAnalysis?.matchingSkills?.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-bold text-emerald-700 mb-1.5 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Already Matched ({result.gapAnalysis.matchingSkills.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.gapAnalysis.matchingSkills.slice(0, 14).map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing chips with why-tooltips */}
              {missing.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-bold text-red-600 mb-1.5 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Missing — we will add ({missing.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {missing.map((s: string) => {
                      const n = countInJd(s, description);
                      return (
                        <span key={s} className="relative group px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 cursor-help">
                          {s}
                          {n > 0 && <sup className="ml-0.5 text-[8px] font-bold text-red-400">×{n}</sup>}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 bg-slate-900 text-slate-100 text-[10px] font-medium rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                            <b className="text-emerald-400">Why add:</b> {n > 0 ? `mentioned ${n}× in JD — ` : ''}placed in the Skills section at full weight.
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  {missingKw.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      + {missingKw.slice(0, 8).join(', ')} keywords woven into experience bullets
                    </p>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {result.gapAnalysis?.keyRecommendations?.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10.5px] font-bold text-slate-700 mb-2">📌 Recommendations</p>
                  <ul className="space-y-1.5">
                    {result.gapAnalysis.keyRecommendations.map((r: string, i: number) => (
                      <li key={i} className="text-[11px] text-slate-600 flex gap-2">
                        <span className="w-4 h-4 rounded bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0 mt-px">{i + 1}</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: TAILORING DIFF */}
      <div className="flex-1 bg-slate-100 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {!result ? (
            <div className="h-full min-h-[60vh] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">Run the analysis to see your tailoring plan</p>
                <p className="text-[11px] mt-1">After scoring, click <b className="text-slate-600">Tailor CV</b> to preview every change before you apply it</p>
              </div>
            </div>
          ) : !diff ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-900">Your CV is {score}% match — we can improve it</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Tailoring adds {missing.length} missing skills &amp; weaves {missingKw.length} keywords into bullets. You'll see every change before downloading.</p>
              </div>
              <button
                onClick={handleTailor}
                disabled={tailoring}
                className="shrink-0 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                {tailoring ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Tailoring…</span></>
                  : <><Sparkles className="w-3.5 h-3.5" /><span>Tailor CV</span></>}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-[fadeIn_.35s_ease]">
              {/* Summary banner */}
              <div className="bg-slate-900 text-white rounded-xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-3">✦ What we added — and why</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/10 border border-white/10 rounded-lg px-3 py-2.5">
                    <div className="text-lg font-extrabold text-emerald-400">+{diff.addedAfter.skillsAdded.length}</div>
                    <div className="text-[10px] text-slate-300 font-medium">skills added to <b className="text-white">Skills</b></div>
                  </div>
                  <div className="bg-white/10 border border-white/10 rounded-lg px-3 py-2.5">
                    <div className="text-lg font-extrabold text-emerald-400">+{diff.addedAfter.rephrasedHighlightsCount}</div>
                    <div className="text-[10px] text-slate-300 font-medium">bullets rewritten with <b className="text-white">keywords</b></div>
                  </div>
                  <div className="bg-white/10 border border-white/10 rounded-lg px-3 py-2.5">
                    <div className="text-lg font-extrabold text-emerald-400">+{diff.scoreBoost}%</div>
                    <div className="text-[10px] text-slate-300 font-medium">ATS score gain <b className="text-white">({diff.beforeScore}% → {diff.afterScore}%)</b></div>
                  </div>
                  <div className="bg-white/10 border border-white/10 rounded-lg px-3 py-2.5">
                    <div className="text-lg font-extrabold text-white">{diff.notIntegrable.length}</div>
                    <div className="text-[10px] text-slate-300 font-medium">skipped — <b className="text-white">could not be added</b></div>
                  </div>
                </div>
              </div>

              {/* Skills added */}
              {diff.addedAfter.skillsAdded.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5" /></span>
                      Skills section — {diff.addedAfter.skillsAdded.length} additions
                    </p>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">+{diff.addedAfter.skillsAdded.length} NEW</span>
                  </div>
                  <div className="px-4 py-2 divide-y divide-slate-50">
                    {diff.addedAfter.skillsAdded.map((s) => {
                      const n = countInJd(s, description);
                      const ctx = contextInJd(s, description);
                      return (
                        <div key={s} className="flex items-start gap-3 py-2.5">
                          <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-px">+</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900">{s}</p>
                            <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-2">“{ctx}”</p>
                          </div>
                          {n > 0 && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">required ×{n}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Experience keywords */}
              {diff.addedAfter.keywordsInExperience.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Zap className="w-3.5 h-3.5" /></span>
                      Experience bullets — {diff.addedAfter.rephrasedHighlightsCount} rewrites
                    </p>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{diff.addedAfter.rephrasedHighlightsCount} MODIFIED</span>
                  </div>
                  <div className="px-4 py-2 divide-y divide-slate-50">
                    {diff.addedAfter.keywordsInExperience.slice(0, 10).map((k) => {
                      const n = countInJd(k, description);
                      const ctx = contextInJd(k, description);
                      return (
                        <div key={k} className="flex items-start gap-3 py-2.5">
                          <span className="w-5 h-5 rounded-md bg-amber-50 text-amber-600 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-px">~</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900">{k} <span className="text-[10px] font-medium text-slate-400">→ woven into existing bullet</span></p>
                            <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-2">“{ctx}”</p>
                          </div>
                          {n > 0 && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">required ×{n}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Not integrable */}
              {diff.notIntegrable.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10.5px] font-bold text-slate-500 mb-1">⚠️ Skipped ({diff.notIntegrable.length}) — no honest way to add</p>
                  <p className="text-[10.5px] text-slate-400">{diff.notIntegrable.slice(0, 8).join(', ')}</p>
                </div>
              )}

              {/* Honesty note */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <p className="text-[10.5px] font-bold text-emerald-700 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Honesty guarantee</span>
                </p>
                <p className="text-[11px] text-emerald-800/80 mt-1 leading-relaxed">
                  Every addition comes from <b>your existing CV content</b> — we surface skills you already have but haven't highlighted. We never invent experience. The projected score is the keyword fill-ratio after integration, not a promise of interview success.
                </p>
              </div>

              {/* Download */}
              <div className="flex items-center gap-3 pt-1">
                {!downloadToken ? (
                  <button onClick={handleTailor} disabled={tailoring}
                    className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer transition-colors">
                    {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating Tailored CV…</span></>
                      : <><Sparkles className="w-4 h-4" /><span>Generate Tailored CV</span></>}
                  </button>
                ) : (
                  <button onClick={download}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-blue-600/20 transition-colors">
                    <Download className="w-4 h-4" /><span>Download Tailored CV (PDF)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
