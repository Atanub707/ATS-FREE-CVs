import React, { useState } from 'react';
import { X, Loader2, Sparkles, Download, FileText } from 'lucide-react';

export const ManualJdModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true); setError(''); setResult(null); setDownloadToken(null);
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
    setTailoring(true); setError(''); setDownloadToken(null);
    try {
      const res = await fetch('/api/analyze-jd/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), company: company.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Tailoring failed'); return; }
      setDownloadToken(data.downloadToken);
    } catch (e: any) { setError(e.message); }
    finally { setTailoring(false); }
  };

  const download = (format: string) => {
    if (!downloadToken) return;
    window.open(`/api/analyze-jd/download?token=${downloadToken}&format=${format}`, '_blank');
  };

  const score = result?.matchScore ?? 0;
  const color = score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-blue-600' : score >= 30 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Manual Job Description</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Senior DevOps Engineer"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                    placeholder="e.g. Google"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Description *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={12}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-y font-mono" />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button onClick={handleAnalyze} disabled={loading || !title.trim() || !description.trim()}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Analyzing...</span></>
                  : <><Sparkles className="w-4 h-4" /><span>Analyze Match</span></>}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-600">ATS Match Score</span>
                <div className={`text-4xl font-extrabold ${color} mt-1`}>{score}%</div>
              </div>

              {result.gapAnalysis?.matchingSkills?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Matching Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {result.gapAnalysis.matchingSkills.slice(0, 10).map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.gapAnalysis?.missingSkills?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1">❌ Missing Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {result.gapAnalysis.missingSkills.slice(0, 10).map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.gapAnalysis?.keyRecommendations?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">📌 Recommendations</p>
                  <ul className="space-y-1">
                    {result.gapAnalysis.keyRecommendations.map((r: string, i: number) => (
                      <li key={i} className="text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              {!downloadToken ? (
                <button onClick={handleTailor} disabled={tailoring}
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer">
                  {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating Tailored CV...</span></>
                    : <><Sparkles className="w-4 h-4" /><span>Generate Tailored CV</span></>}
                </button>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-800">Tailored CV Ready</span>
                    </div>
                    <p className="text-[11px] text-indigo-600 mt-1">Your CV has been optimized for this job. Update your Master CV first to incorporate recommendations, then download.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => download('pdf')} className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 cursor-pointer">
                      <Download className="w-3.5 h-3.5" /><span>Download PDF</span>
                    </button>
                  </div>
                </>
              )}

              <div className="flex justify-center pt-1">
                <button onClick={() => { setResult(null); setDownloadToken(null); setTitle(''); setCompany(''); setDescription(''); setError(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer">
                  Start New Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
