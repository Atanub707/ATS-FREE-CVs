import React, { useState } from 'react';
import { X, Loader2, Sparkles, Download, FileText, Zap, AlertTriangle, CheckCircle2, TrendingUp, ArrowRight } from 'lucide-react';

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
  const matched = result?.gapAnalysis?.matchingSkills || [];
  const totalRequired = matched.length + missing.length;

  const ringC = 2 * Math.PI * 32;

  return (
    <div className="fixed inset-0 z-40 bg-white text-slate-900 flex">
      {/* ═══ LEFT: INPUTS ONLY (never changes) ═══ */}
      <div className="w-[42%] min-w-[420px] border-r border-slate-200 flex flex-col bg-white">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Job Description Input</h2>
              <p className="text-[10.5px] text-slate-400 font-medium">Paste the JD — insights appear on the right side</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4 flex flex-col">
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Role Name *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior DevOps Engineer"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Company Name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="mt-4 flex-1 flex flex-col min-h-[260px]">
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Job Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={16}
              className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none font-mono leading-relaxed"
            />
            <div className="text-right text-[10px] font-semibold text-slate-400 mt-1.5">
              {description.length.toLocaleString()} chars
            </div>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 mt-3">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={loading || !title.trim() || !description.trim()}
            className="mt-4 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-blue-600/20 transition-colors shrink-0"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Analyzing against your CV…</span></>
              : <><Sparkles className="w-4 h-4" /><span>Analyze Match</span></>}
          </button>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 shrink-0">
          <p className="text-[10px] text-slate-400 font-medium flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Left side stays as-is — all results land on the right</span>
          </p>
        </div>
      </div>

      {/* ═══ RIGHT: ALL INSIGHTS ═══ */}
      <div className="flex-1 bg-slate-100 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold text-slate-900">Insights</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">Analysis → Tailoring</span>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400">
              {[
                { n: 1, label: 'Analyze', on: !!result },
                { n: 2, label: 'Tailor', on: !!diff },
                { n: 3, label: 'Download', on: !!downloadToken },
              ].map((s, i) => (
                <React.Fragment key={s.n}>
                  {i > 0 && <span className="text-slate-300">→</span>}
                  <span className={`flex items-center space-x-1 ${s.on ? 'text-blue-600' : ''}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${s.on ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{s.n}</span>
                    <span>{s.label}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Placeholder */}
          {!result && (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl min-h-[420px] flex items-center justify-center text-center px-8">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-slate-300 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-600">Insights will appear here</h3>
                <p className="text-[11.5px] text-slate-400 mt-1.5 leading-relaxed">
                  Score, skill gaps, recommendations, and the tailoring diff —<br />
                  all shown on this side after you click <b className="text-slate-500">Analyze Match</b>.
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-5 animate-[fadeIn_.35s_ease]">
              {/* Score card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-5">
                <div className="relative w-[76px] h-[76px] shrink-0">
                  <svg width="76" height="76" viewBox="0 0 76 76" className="transform -rotate-90">
                    <circle cx="38" cy="38" r="32" fill="none" stroke="#EFF1F5" strokeWidth="7" />
                    <circle
                      cx="38" cy="38" r="32" fill="none"
                      stroke={score >= 75 ? '#0FA968' : score >= 50 ? '#2F54EB' : score >= 30 ? '#D97706' : '#DC2626'}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={ringC}
                      strokeDashoffset={ringC * (1 - score / 100)}
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1)' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-lg font-extrabold ${color}`}>{score}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-extrabold text-slate-900">{verdict}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{matched.length} of {totalRequired} required skills already present in your CV</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[9.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                      Role: {title}
                    </span>
                    <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      {matched.length} matched
                    </span>
                    <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      {missing.length} missing
                    </span>
                  </div>
                </div>
              </div>

              {/* Skill coverage */}
              <div>
                <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center space-x-2">
                  <span>Skill Coverage</span><span className="flex-1 h-px bg-slate-200" />
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Matched */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-[11.5px] font-extrabold text-slate-900 flex items-center space-x-2 mb-2.5">
                      <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                      Already Matched ({matched.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {matched.slice(0, 20).map((s: string) => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Missing with why-tooltips */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-[11.5px] font-extrabold text-slate-900 flex items-center space-x-2 mb-2.5">
                      <span className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                      Missing — we will add ({missing.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {missing.map((s: string) => {
                        const n = countInJd(s, description);
                        return (
                          <span key={s} className="relative group px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-red-50 text-red-700 border border-red-200 cursor-help">
                            {s}
                            {n > 0 && <sup className="ml-0.5 text-[8.5px] font-bold text-red-400">×{n}</sup>}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 bg-slate-900 text-slate-100 text-[10px] font-medium rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                              <b className="text-emerald-400">Why add:</b> {n > 0 ? `mentioned ${n}× in JD — ` : ''}placed in the Skills section at full weight.
                            </span>
                          </span>
                        );
                      })}
                      {missingKw.length > 0 && (
                        <p className="w-full text-[10px] text-slate-400 pt-1">
                          + {missingKw.slice(0, 8).join(', ')} keywords woven into experience bullets
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {result.gapAnalysis?.keyRecommendations?.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center space-x-2">
                    <span>Recommendations</span><span className="flex-1 h-px bg-slate-200" />
                  </p>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <ul className="space-y-1">
                      {result.gapAnalysis.keyRecommendations.map((r: string, i: number) => (
                        <li key={i} className="text-[11.5px] text-slate-600 flex gap-2.5 py-1.5 border-b border-slate-50 last:border-b-0">
                          <span className="w-[18px] h-[18px] rounded-md bg-blue-50 text-blue-700 text-[9.5px] font-extrabold flex items-center justify-center shrink-0 mt-px">{i + 1}</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Tailor CTA */}
              {!diff && (
                <div className="bg-slate-900 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
                  <span className="w-10 h-10 rounded-xl bg-blue-500/25 text-blue-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold text-white">Your CV is {score}% match — we can improve it</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tailoring adds {missing.length} missing skills &amp; weaves {missingKw.length} keywords into bullets.</p>
                  </div>
                  <button
                    onClick={handleTailor}
                    disabled={tailoring}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors shadow-md shadow-blue-600/30"
                  >
                    {tailoring ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Tailoring…</span></>
                      : <><Sparkles className="w-3.5 h-3.5" /><span>Tailor CV</span></>}
                  </button>
                </div>
              )}

              {/* Diff after tailoring */}
              {diff && (
                <div className="space-y-4 animate-[fadeIn_.35s_ease]">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-blue-600 mb-3">✦ What we added — and why</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                        <div className="text-lg font-extrabold text-emerald-600">+{diff.addedAfter.skillsAdded.length}</div>
                        <div className="text-[9.5px] text-slate-500 font-medium">skills added to <b className="text-slate-700">Skills</b></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                        <div className="text-lg font-extrabold text-emerald-600">+{diff.addedAfter.rephrasedHighlightsCount}</div>
                        <div className="text-[9.5px] text-slate-500 font-medium">bullets rewritten with <b className="text-slate-700">keywords</b></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                        <div className="text-lg font-extrabold text-emerald-600">+{diff.scoreBoost}%</div>
                        <div className="text-[9.5px] text-slate-500 font-medium">ATS score gain <b className="text-slate-700">({diff.beforeScore}% → {diff.afterScore}%)</b></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                        <div className="text-lg font-extrabold text-slate-800">{diff.notIntegrable.length}</div>
                        <div className="text-[9.5px] text-slate-500 font-medium">skipped — <b className="text-slate-700">could not be added</b></div>
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
                                {ctx && <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-2">“{ctx}”</p>}
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

                  {/* Experience rewrites */}
                  {diff.addedAfter.rephrasedHighlightsCount > 0 && (
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
                                {ctx && <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-2">“{ctx}”</p>}
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
                  <button onClick={download}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-blue-600/20 transition-colors">
                    <Download className="w-4 h-4" /><span>Download Tailored CV (PDF)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
