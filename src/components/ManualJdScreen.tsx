import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Loader2, Sparkles, Download, FileText, CheckCircle2, ArrowRight, History, Trash2, AlertTriangle, TrendingUp, Plus, PenLine, Ban, ChevronsLeftRight, Wand2, Eye, PencilLine } from 'lucide-react';
import { llmErrorMessage } from '../lib/llmError';
import { MasterCv } from '../types';
import { CvPdfPreview, masterCvToPdfShape, compressedCvToPdfShape, PdfCvShape } from './CvPdfPreview';

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

// ── Preview Stage · editable CV model ───────────────────────────────────────
// The Tailor stage produces a PdfCvShape. The Preview stage lets the user edit
// it — triggering the model, they get a working inline editor. Every item
// carries an `ai` flag so a one-tap toggle can hide everything the AI added
// (skills + rewritten bullets) and show the user's own content.

export interface EditableItem {
  id: string;
  text: string;
  ai: boolean;
}

export interface EditableExp {
  id: string;
  title: string;
  company: string;
  location?: string;
  dates: string;
  bullets: EditableItem[];
}

export interface EditableCv {
  candidateName: string;
  targetRole?: string;
  contactInfo: Record<string, string>;
  summary: string;
  skills: EditableItem[];
  coreCompetencies: string[];
  experiences: EditableExp[];
  projects: any[];
  education: any[];
  certifications: any[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

// Build the editable model from the tailored CV + the AI diff. Skills the AI
// added (`skillsAdded`) and bullets it rewrote (`bulletRewrites`) get ai:true —
// everything else is the user's original content and is never touched.
export function buildEditableCv(cv: PdfCvShape, diff: DiffPayload | null): EditableCv {
  const aiSkills = new Set((diff?.addedAfter?.skillsAdded || []).map((s) => s.toLowerCase().trim()));
  const aiBullets = new Set((diff?.bulletRewrites || []).map((r) => (r.rewritten || '').toLowerCase().trim()));

  const skills: EditableItem[] = [];
  for (const cat of cv.technicalSkills || []) {
    for (const s of cat.skills || []) {
      skills.push({ id: uid(), text: s, ai: aiSkills.has(String(s).toLowerCase().trim()) });
    }
  }

  const experiences: EditableExp[] = (cv.workExperience || []).map((we) => ({
    id: uid(),
    title: we.title || '',
    company: we.company || '',
    location: we.location,
    dates: we.dates || '',
    bullets: (we.highlights || []).map((h) => ({
      id: uid(),
      text: h,
      ai: aiBullets.has(String(h).toLowerCase().trim()),
    })),
  }));

  return {
    candidateName: cv.candidateName || '',
    targetRole: cv.targetRole || '',
    contactInfo: cv.contactInfo || {},
    summary: cv.professionalSummary || '',
    skills,
    coreCompetencies: cv.coreCompetencies || [],
    experiences,
    projects: cv.projects || [],
    education: cv.education || [],
    certifications: cv.certifications || [],
  };
}

// Convert the (possibly edited, possibly AI-hidden) model back to a PdfCvShape
// for the live preview and the edited-CV downloads.
export function editableCvToPdfShape(cv: EditableCv, hideAI: boolean): PdfCvShape {
  const keep = (x: EditableItem) => (hideAI && x.ai ? false : true);
  return {
    candidateName: cv.candidateName || 'CANDIDATE NAME',
    targetRole: cv.targetRole,
    contactInfo: cv.contactInfo || {},
    professionalSummary: cv.summary || '',
    technicalSkills: [{ category: 'Technical', skills: cv.skills.filter(keep).map((s) => s.text) }],
    coreCompetencies: cv.coreCompetencies?.length ? cv.coreCompetencies : undefined,
    workExperience: cv.experiences
      .filter((e) => e.title || e.company)
      .map((e) => ({
        title: e.title,
        company: e.company,
        location: e.location,
        dates: e.dates,
        highlights: e.bullets.filter(keep).map((b) => b.text),
      })),
    projects: cv.projects || [],
    education: cv.education || [],
    certifications: cv.certifications || [],
  };
}

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
  // Preview stage: editable model built from the tailored CV, plus the live
  // PdfCvShape derived from the current edits (drives the right-hand preview
  // and the edited-CV downloads). `hideAI` toggles AI-tagged content off.
  const [editableCv, setEditableCv] = useState<EditableCv | null>(null);
  const [hideAI, setHideAI] = useState(false);
  const [editableNewCv, setEditableNewCv] = useState<PdfCvShape | null>(null);
  // View step — lets users click a completed step in the stepper to go back.
  // Auto-follows the derived step whenever the flow advances.
  const [viewStep, setViewStep] = useState<1 | 2 | 3 | 4>(1);
  const draggingRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const oldScrollRef = useRef<HTMLDivElement>(null);
  const newScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  useEffect(() => {
    if (isOpen && historyOpen) loadHistory();
  }, [isOpen, historyOpen]);

  // Keep the view step in sync with the flow's natural progression.
// Once the tailored CV loads, advance the user to the new Preview Stage (4);
// the Tailor step stays clickable so the diff review is never lost.
  useEffect(() => {
    const s: 1 | 2 | 3 | 4 = !result ? 1 : !diff ? (tailoring ? 3 : 2) : tailoredCv && !tailoring ? 4 : 3;
    setViewStep(s);
  }, [result, diff, tailoring, tailoredCv]);

  // Preview Stage: as soon as the tailored CV is available AND editing changes
  // happen, derive the live preview shape used by the right-hand sheet + the
  // edited downloads.
  const savedDiffRef = useRef<DiffPayload | null>(null);
  useEffect(() => { savedDiffRef.current = diff; }, [diff]);

  // Build the editable model once the tailored CV graph opens.
  useEffect(() => {
    if (tailoredCv && !editableCv) {
      const shape = compressedCvToPdfShape(tailoredCv);
      setEditableCv(buildEditableCv(shape, savedDiffRef.current));
    }
  }, [tailoredCv, editableCv]);

  useEffect(() => {
    if (editableCv) setEditableNewCv(editableCvToPdfShape(editableCv, hideAI));
  }, [editableCv, hideAI]);

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

  // Template selector for the preview + PDF download (defaults to the
  // Master CV's template). Declared here — BEFORE the isOpen guard — so
  // the hook count never changes between renders.
  const [previewTemplate, setPreviewTemplate] = useState<'harvard' | 'jake' | 'atanu' | 'atanu-pro'>(masterCv?.templateId || 'harvard');

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
      setEditableCv(null); setEditableNewCv(null); setHideAI(false);
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
    setLoading(true); setError(''); setTailorError(false); setResult(null); setDiff(null); setDownloadToken(null); setTailoredCv(null); setCvLoadFailed(false); setEditableCv(null); setEditableNewCv(null); setHideAI(false);
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

  // ── Preview Stage · edit handlers ────────────────────────────────
  // Every mutator rebuilds the derived PdfCvShape so the live sheet + the
  // edited downloads always reflect the current edits.
  const commitEdits = (next: EditableCv) => {
    setEditableCv(next);
    setEditableNewCv(editableCvToPdfShape(next, hideAI));
  };

  const setSummary = (v: string) => { if (editableCv) commitEdits({ ...editableCv, summary: v }); };
  const toggleSkill = (sid: string) => {
    if (!editableCv) return;
    commitEdits({ ...editableCv, skills: editableCv.skills.filter((s) => s.id !== sid) });
  };
  const addSkill = (text: string) => {
    if (!editableCv || !text.trim()) return;
    commitEdits({ ...editableCv, skills: [...editableCv.skills, { id: `sk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: text.trim(), ai: false }] });
  };
  const setExpTitle = (eid: string, v: string) => {
    if (!editableCv) return;
    commitEdits({ ...editableCv, experiences: editableCv.experiences.map((e) => (e.id === eid ? { ...e, title: v } : e)) });
  };
  const setBullet = (bid: string, v: string) => {
    if (!editableCv) return;
    commitEdits({ ...editableCv, experiences: editableCv.experiences.map((e) => ({ ...e, bullets: e.bullets.map((b) => (b.id === bid ? { ...b, text: v } : b)) })) });
  };
  const toggleBullet = (bid: string) => {
    if (!editableCv) return;
    commitEdits({ ...editableCv, experiences: editableCv.experiences.map((e) => ({ ...e, bullets: e.bullets.filter((b) => b.id !== bid) })) });
  };
  const addBullet = (eid: string, text: string) => {
    if (!editableCv || !text.trim()) return;
    commitEdits({ ...editableCv, experiences: editableCv.experiences.map((e) => (e.id === eid ? { ...e, bullets: [...e.bullets, { id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: text.trim(), ai: false }] } : e)) });
  };
  const toggleHideAI = () => {
    const next = !hideAI;
    setHideAI(next);
    if (editableCv) setEditableNewCv(editableCvToPdfShape(editableCv, next));
  };

  // The edited CV downloads come from the CURRENT edits (Preview Stage), not
  // the server's tailored copy.
  const downloadEdited = async (format: 'pdf' | 'txt') => {
    if (!editableNewCv) return;
    try {
      const res = await fetch('/api/analyze-jd/preview-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv: editableNewCv, format, template: previewTemplate }),
      });
      if (!res.ok) { alert('Could not generate the file.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(editableNewCv.candidateName || 'CV').replace(/ /g, '_')}_edited.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Download failed: ' + e.message);
    }
  };

  const previewDragActive = viewStep === 4 && !!editableNewCv && !!tailoredCv;

  const missing = result?.gapAnalysis?.missingSkills || [];
  const missingKw = result?.gapAnalysis?.missingKeywords || [];
  const matchedSkills = result?.gapAnalysis?.matchingSkills || [];
  const additions = normalizeAdditions(missing, missingKw, description);
  const CHIP_CAP = 8;
  const visibleMatched = showAllMatched ? matchedSkills : matchedSkills.slice(0, CHIP_CAP);
  const visibleAdditions = showAllAdditions ? additions : additions.slice(0, CHIP_CAP);
  const displayScore = result?.matchScore ?? 0;
  const step = !result ? 1 : !diff ? (tailoring ? 3 : 2) : tailoredCv && !tailoring ? 4 : 3;
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
    { bg: 'bg-[var(--color-brand-soft)]', border: 'border-[var(--color-brand-line)]', text: 'text-[var(--color-brand)]', checkBg: 'bg-[var(--color-brand)]' },
    { bg: 'bg-[var(--color-brand-soft)]', border: 'border-[var(--color-brand-line)]', text: 'text-[var(--color-brand)]', checkBg: 'bg-purple-600' },
    { bg: 'bg-[var(--color-cta-soft)]', border: 'border-[var(--color-cta-line)]', text: 'text-[var(--color-cta)]', checkBg: 'bg-[var(--color-cta)]' },
    { bg: 'bg-[var(--color-amber-soft,#FFF7ED)]', border: 'border-[var(--color-amber-line,#FED7AA)]', text: 'text-[var(--color-amber,#C2410C)]', checkBg: 'bg-orange-600' },
    { bg: 'bg-[var(--color-danger-soft)]', border: 'border-[#FECACA]', text: 'text-red-700', checkBg: 'bg-[var(--color-danger)]' },
    { bg: 'bg-[var(--color-brand-soft)]', border: 'border-[var(--color-brand-line)]', text: 'text-[var(--color-brand)]', checkBg: 'bg-cyan-600' },
    { bg: 'bg-[#FDF2F8]', border: 'border-[#F5D0FE]', text: 'text-[#DB2777]', checkBg: 'bg-pink-600' },
  ];
  const skillColor = (name: string) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return SKILL_PALETTE[h % SKILL_PALETTE.length];
  };

  const analysisStatus: 'idle' | 'loading' | 'success' | 'error' = loading ? 'loading' : result ? 'success' : error ? 'error' : 'idle';
  const generateStatus: 'idle' | 'loading' | 'success' | 'error' = tailoring ? 'loading' : tailorError ? 'error' : diff ? 'success' : 'idle';

  const inputCls = 'w-full min-h-[46px] border border-[var(--color-hairline)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--color-ink)] placeholder-slate-400 bg-white focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand)]/12 outline-none transition-colors';
  const btnBase = 'w-full min-h-[48px] rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40';

  const stepBadge = (n: number) => (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[13px] font-bold shrink-0 ${step >= n ? 'bg-[var(--color-ink)] text-white' : 'bg-[#F1F5F9] text-[var(--color-faint)]'}`}>{n}</span>
  );

  const loadingOverlay = (text: string) => (
    <div className="absolute inset-0 z-10 bg-white/90 flex flex-col items-center justify-center gap-3">
      <div className="w-[30px] h-[30px] border-[3px] border-[var(--color-hairline)] border-t-slate-900 rounded-full animate-spin" />
      <p className="text-[12px] font-semibold text-[var(--color-faint)]">{text}</p>
    </div>
  );

  const panelCls = (n: number) =>
    `absolute inset-0 p-5 overflow-y-auto transition-all duration-[450ms] ease-[cubic-bezier(.25,.8,.3,1)] ${
      viewStep === n ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-10 pointer-events-none'
    }`;

  const originalCv = masterCv ? masterCvToPdfShape(masterCv) : null;
  const newCv = tailoredCv ? compressedCvToPdfShape(tailoredCv) : null;

  // Keep the ORIGINAL and TAILORED sheets at the same scroll position so the
  // slider always compares matching areas of the two CVs.
  const syncScroll = (from: HTMLDivElement, to: HTMLDivElement | null) => {
    if (!to || syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#FAFAF9] text-[var(--color-muted)] flex flex-col font-sans">
      {/* Page header */}
      <header className="px-5 sm:px-8 py-4 border-b border-[var(--color-hairline)] bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-[var(--color-muted)] bg-white border border-[var(--color-hairline)] hover:bg-[#FAFAF9] transition-colors cursor-pointer shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[var(--color-ink)] leading-tight">Manual JD</h1>
            <p className="text-[10.5px] text-[var(--color-faint)] font-medium">Paste a job description — get a tailored CV in 3 simple steps.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={openHistory} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-[var(--color-muted)] bg-white border border-[var(--color-hairline)] hover:bg-[#FAFAF9] transition-colors cursor-pointer">
            <History className="w-4 h-4" /> History
          </button>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[var(--color-faint)] hover:bg-[var(--color-brand-soft)] transition-colors cursor-pointer">
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
          { n: 4 as const, label: 'Preview', on: step >= 4 && !tailoring, reachable: !!editableNewCv },
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
                  s.on ? 'bg-[var(--color-ink)] border-slate-900 text-white' : isCurrent ? 'bg-[var(--color-brand)] border-blue-600 text-white' : 'bg-white border-[var(--color-hairline)] text-[var(--color-faint)]'
                } ${canClick ? 'cursor-pointer hover:opacity-85' : 'cursor-default'}`}
              >
                <span className={`w-4.5 h-4.5 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${s.on || isCurrent ? 'bg-white/25' : 'bg-[#F1F5F9] text-[var(--color-faint)]'}`}>{s.on ? '✓' : s.n}</span>
                {s.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {error && <p className="px-5 sm:px-8 pt-3 text-[12px] text-[var(--color-danger)]">{error}</p>}

      {/* ── 50/50 stage: left = workspace, right = CV comparison ── */}
      <div className="flex-1 min-h-0 p-4 sm:p-5 flex gap-0">
        {/* LEFT · Workspace */}
        <section className="flex-1 min-w-0 bg-white border border-[var(--color-hairline)] rounded-l-[14px] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--color-hairline)] bg-[#FAFAF9]/80 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-faint)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Workspace
            </span>
            <span className="text-[10.5px] font-bold text-[var(--color-faint)] bg-white border border-[var(--color-hairline)] rounded-full px-2 py-0.5">Step {viewStep} of 4</span>
          </div>

          <div className="relative flex-1 min-h-0 overflow-hidden bg-white">
            {/* PANEL 1 · Add JD */}
            <div className={panelCls(1)}>
              <h2 className="text-[16px] font-bold text-[var(--color-ink)] mb-4 flex items-center justify-between gap-2">
                Add job description {stepBadge(1)}
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="mj-role" className="block text-[13px] font-semibold text-[var(--color-muted)] mb-1.5">Role name</label>
                  <input id="mj-role" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DevOps Engineer" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="mj-company" className="block text-[13px] font-semibold text-[var(--color-muted)] mb-1.5">Company</label>
                  <input id="mj-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="mj-description" className="block text-[13px] font-semibold text-[var(--color-muted)] mb-1.5">Job description</label>
                  <textarea id="mj-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={9}
                    placeholder="Paste the full job description…" className={`${inputCls} min-h-[150px] resize-none leading-relaxed`} />
                  <p className="text-right text-xs text-[var(--color-faint)] mt-1">{description.length.toLocaleString()} chars</p>
                </div>
                <button onClick={handleAnalyze} disabled={loading || !title.trim() || !description.trim()} aria-live="polite"
                  className={`${btnBase} ${analysisStatus === 'error' ? 'bg-white border border-[#FECACA] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]' : 'bg-[var(--color-ink)] hover:bg-[#14113B] text-white'}`}>
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
                <h2 className="text-[16px] font-bold text-[var(--color-ink)] mb-3 flex items-center justify-between gap-2 shrink-0">
                  Analysis {stepBadge(2)}
                </h2>
                {!result ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[var(--color-hairline)] flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[var(--color-faint)]" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-faint)]">Click Analyze Match to begin</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
                      <div className="flex items-center gap-4 p-4 bg-[#FAFAF9] border border-[var(--color-hairline)] rounded-xl">
                        <div className="text-[40px] font-bold text-[var(--color-brand)] leading-none shrink-0">{displayScore}%</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[var(--color-ink)]">
                            {matchedSkills.length} of {additions.length + matchedSkills.length} skills matched
                          </div>
                          <div className="text-xs text-[var(--color-faint)] mt-0.5">Excellent fit — you're missing a few skills to reach 100%</div>
                        </div>
                      </div>

                      <div className="border border-[var(--color-hairline)] rounded-xl p-3.5 bg-[#FAFAF9]/70">
                        <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-2">Tailoring changes</h3>
                        <div className="space-y-1.5 text-[12px] leading-relaxed">
                          <p className="text-[var(--color-muted)]">
                            <span className="font-bold text-[var(--color-cta)]">+ Add:</span>{' '}
                            {selectedSkills.size > 0 ? [...selectedSkills].join(' · ') : 'nothing selected'}
                          </p>
                          <p className="text-[var(--color-muted)]">
                            <span className="font-bold text-[var(--color-brand)]">✎ Rewrite:</span> existing experience bullets to naturally integrate the additions
                          </p>
                          <p className="text-[var(--color-faint)]">
                            <span className="font-bold">✓ Preserve:</span> Job titles · Employers · Dates
                          </p>
                        </div>
                      </div>

                      {matchedSkills.length > 0 && (
                        <div>
                          <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
                            Already matched
                            <span className="text-[11px] font-bold text-[var(--color-faint)] bg-[#F1F5F9] rounded-lg px-1.5 py-0.5">{matchedSkills.length}</span>
                            {matchedSkills.length > CHIP_CAP && (
                              <button onClick={() => setShowAllMatched((v) => !v)} className="ml-auto text-[11.5px] font-bold text-[var(--color-brand)] hover:text-[var(--color-brand)] cursor-pointer">
                                {showAllMatched ? 'Show less' : `+${matchedSkills.length - CHIP_CAP} more`}
                              </button>
                            )}
                          </h3>
                          <div className="flex flex-wrap gap-2 min-w-0">
                            {visibleMatched.map((s) => (
                              <span key={s} className="inline-flex items-center gap-[7px] px-[11px] py-1.5 rounded-[9px] text-[13px] font-semibold border bg-[var(--color-cta-soft)] border-[var(--color-cta-line)] text-[var(--color-cta)] max-w-full">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="break-words min-w-0">{s}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
                          Recommended additions
                          <span className="text-[11px] font-bold text-[var(--color-faint)] bg-[#F1F5F9] rounded-lg px-1.5 py-0.5">{additions.length}</span>
                          {additions.length > CHIP_CAP && (
                            <button onClick={() => setShowAllAdditions((v) => !v)} className="ml-auto text-[11.5px] font-bold text-[var(--color-brand)] hover:text-[var(--color-brand)] cursor-pointer">
                              {showAllAdditions ? 'Show less' : `+${additions.length - CHIP_CAP} more`}
                            </button>
                          )}
                        </h3>
                        {additions.length === 0 ? (
                          <p className="text-xs text-[var(--color-faint)]">No missing skills detected — your CV already covers this JD well.</p>
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
                                  className={`inline-flex items-center gap-[7px] px-[11px] py-1.5 rounded-[9px] text-[13px] font-semibold border cursor-pointer transition-colors max-w-full wrap-anywhere ${on ? `${c.bg} ${c.border} ${c.text}` : 'bg-white border-[var(--color-hairline)] text-[var(--color-faint)] hover:border-[var(--color-brand-line)]'}`}>
                                  <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${on ? `${c.checkBg} text-white border-transparent` : 'border border-[var(--color-hairline2)] text-transparent'}`}>{on ? '✓' : ''}</span>
                                  <span className="break-words min-w-0">{g.display}</span>
                                  {g.count > 1 && <span className={`text-[11px] shrink-0 ${on ? 'opacity-60' : 'text-[var(--color-faint)]'}`}>×{g.count}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-[var(--color-faint)]">Tap a chip to include or exclude it. Only your selected additions are applied — never all keywords.</p>
                    </div>

                    <div className="shrink-0 pt-3 mt-3 border-t border-[var(--color-hairline)]/80">
                      <button onClick={() => handleTailor()} disabled={tailoring || selectedSkills.size === 0} aria-live="polite"
                        title={generateStatus === 'success' ? 'Regenerate CV with the selected skills' : undefined}
                        className={`${btnBase} ${generateStatus === 'error' ? 'bg-white border border-[#FECACA] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]' : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] text-white'}`}>
                        {tailoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Tailoring CV…</>
                          : generateStatus === 'error' ? <><AlertTriangle className="w-4 h-4" /> Try Again</>
                          : generateStatus === 'success' ? <><CheckCircle2 className="w-4 h-4" /> CV Generated</>
                          : <><FileText className="w-4 h-4" /> Tailor CV <ArrowRight className="w-4 h-4" /></>}
                      </button>
                      {tailorError && error && <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>}
                      <p className="text-xs text-[var(--color-faint)] text-center mt-2">AI will tailor your CV with the selected additions</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* PANEL 3 · ATS result */}
            <div className={panelCls(3)}>
              {tailoring && loadingOverlay('Tailoring your CV…')}
              <div className={`flex flex-col h-full min-h-0 transition-opacity duration-200 ${tailoring ? 'opacity-10' : 'opacity-100'}`}>
                <h2 className="text-[16px] font-bold text-[var(--color-ink)] mb-3 flex items-center justify-between gap-2 shrink-0">
                  Tailoring updates {stepBadge(3)}
                </h2>
                {!diff ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[var(--color-hairline)] flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-[var(--color-faint)]" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-faint)]">Tailor your CV to see updates</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
                      <div className="flex items-center gap-4 p-4 bg-[#FAFAF9] border border-[var(--color-hairline)] rounded-xl">
                        <div className="text-[36px] font-bold text-[var(--color-cta)] leading-none shrink-0">{diff.afterScore}%</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[var(--color-ink)]">
                            ATS score after tailoring <span className="text-[11px] font-extrabold text-[var(--color-cta)] bg-[var(--color-cta-soft)] border border-[var(--color-cta-line)] rounded-lg px-1.5 py-0.5 ml-1">+{diff.scoreBoost}%</span>
                          </div>
                          <div className="text-xs text-[var(--color-faint)] mt-0.5">{diff.beforeScore}% before → {diff.afterScore}% after</div>
                          <div className="h-1.5 rounded-full bg-slate-200 relative overflow-hidden mt-2">
                            <div className="absolute inset-y-0 bg-[var(--color-cta-soft)]0" style={{ left: `${diff.beforeScore}%`, width: `${Math.max(0, diff.afterScore - diff.beforeScore)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-2.5 bg-[#FAFAF9] border border-[var(--color-hairline)] rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[var(--color-cta-soft)] border border-[var(--color-cta-line)] flex items-center justify-center shrink-0">
                            <Plus className="w-4 h-4 text-[var(--color-cta)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-bold text-[var(--color-cta)] leading-none">+{reviewSkills.length}</div>
                            <div className="text-[9.5px] text-[var(--color-faint)] mt-1 leading-tight">Skills added</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-[#FAFAF9] border border-[var(--color-hairline)] rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[var(--color-cta-soft)] border border-[var(--color-cta-line)] flex items-center justify-center shrink-0">
                            <PenLine className="w-4 h-4 text-[var(--color-cta)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-bold text-[var(--color-cta)] leading-none">+{reviewBullets.length}</div>
                            <div className="text-[9.5px] text-[var(--color-faint)] mt-1 leading-tight">Bullets rewritten</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-[#FAFAF9] border border-[var(--color-hairline)] rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] border border-[var(--color-hairline)] flex items-center justify-center shrink-0">
                            <Ban className="w-4 h-4 text-[var(--color-faint)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[16px] font-bold text-[var(--color-faint)] leading-none">{diff.notIntegrable?.length || 0}</div>
                            <div className="text-[9.5px] text-[var(--color-faint)] mt-1 leading-tight">Skipped — no honest way to add</div>
                          </div>
                        </div>
                      </div>

                      {reviewSkills.length > 0 && (
                        <div>
                          <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
                            What's been added
                            <span className="text-[11px] font-bold text-[var(--color-faint)] bg-[#F1F5F9] rounded-lg px-1.5 py-0.5">{reviewSkills.length}</span>
                            {reviewSkills.length > ADDED_CAP && (
                              <button onClick={() => setShowAllAddedSkills((v) => !v)} className="ml-auto text-[11.5px] font-bold text-[var(--color-brand)] hover:text-[var(--color-brand)] cursor-pointer">
                                {showAllAddedSkills ? 'Show less' : `+${reviewSkills.length - ADDED_CAP} more`}
                              </button>
                            )}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 min-w-0">
                            {visibleAddedSkills.map((s) => (
                              <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-semibold bg-[var(--color-cta-soft)] border border-[var(--color-cta-line)] text-[var(--color-cta)] max-w-full">
                                <Plus className="w-3 h-3 shrink-0" />
                                <span className="break-words min-w-0">{s}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {reviewBullets.length > 0 && (
                        <div>
                          <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
                            What's been rewritten
                            <span className="text-[11px] font-bold text-[var(--color-faint)] bg-[#F1F5F9] rounded-lg px-1.5 py-0.5">{reviewBullets.length}</span>
                            {reviewBullets.length > REWRITE_CAP && (
                              <button onClick={() => setShowAllRewrites((v) => !v)} className="ml-auto text-[11.5px] font-bold text-[var(--color-brand)] hover:text-[var(--color-brand)] cursor-pointer">
                                {showAllRewrites ? 'Show less' : `+${reviewBullets.length - REWRITE_CAP} more`}
                              </button>
                            )}
                          </h3>
                          <div className="space-y-1.5">
                            {visibleRewrites.map((br, bi) => (
                              <div key={`rw:${bi}`} className="bg-[#FAFAF9] border border-[var(--color-hairline)] rounded-lg px-2.5 py-2">
                                <div className="flex items-start gap-2">
                                  <PenLine className="w-3.5 h-3.5 text-[var(--color-cta)] mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Before</p>
                                    <p className="text-[11.5px] text-[var(--color-faint)] line-through leading-relaxed break-words mt-0.5" style={clamp1}>{br.original}</p>
                                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--color-cta)] mt-1.5">After</p>
                                    <p className="text-[12px] text-[var(--color-muted)] leading-relaxed break-words mt-0.5" style={clamp2}>{br.rewritten}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border border-[var(--color-hairline)] rounded-xl px-3.5 py-2.5 bg-[#FAFAF9]/70">
                        <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-1.5">What's preserved</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {['Job titles', 'Employers', 'Employment dates'].map((x) => (
                            <span key={x} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-muted)]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-cta)] shrink-0" /> {x}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[12.5px] font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
                          Review changes — remove what you don't like
                          <span className="text-[11px] font-bold text-[var(--color-faint)] bg-[#F1F5F9] rounded-lg px-1.5 py-0.5">{reviewItems.length}</span>
                        </h3>
                        <div className="divide-y divide-slate-100">
                          {visibleReview.map((item) => {
                            const removed = removedPoints.has(item.key);
                            return item.kind === 'skill' ? (
                              <div key={item.key} className={`flex items-center gap-2.5 py-1.5 ${removed ? 'opacity-40' : ''}`}>
                                <div className="flex-1 text-[12.5px] text-[var(--color-muted)] min-w-0 break-words">
                                  {removed ? <span className="line-through text-[var(--color-faint)]">Added skill {item.label}</span> : <>Added skill <b className="text-[var(--color-cta)]">{item.label}</b></>}
                                </div>
                                <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(item.key); return n; })() : new Set(p).add(item.key))}
                                  aria-label={removed ? `Restore ${item.label}` : `Remove ${item.label}`}
                                  className={`w-7 h-7 rounded-lg border text-[12px] font-bold cursor-pointer transition-colors shrink-0 ${removed ? 'bg-[var(--color-cta-soft)] border-[var(--color-cta-line)] text-[var(--color-cta)]' : 'bg-[var(--color-danger-soft)] border-[#FECACA] text-[var(--color-danger)] hover:bg-[#FDE8E8]'}`}>
                                  {removed ? '↺' : '✕'}
                                </button>
                              </div>
                            ) : (
                              <div key={item.key} className={`flex items-start gap-2.5 py-1.5 ${removed ? 'opacity-40' : ''}`}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10.5px] text-[var(--color-faint)] line-through leading-relaxed break-words" style={clamp1}>{item.original}</p>
                                  <p className={`text-[12px] leading-relaxed break-words mt-0.5 ${removed ? 'line-through text-[var(--color-faint)]' : 'text-[var(--color-muted)]'}`} style={clamp2} title={item.label}>{item.label}</p>
                                </div>
                                <button onClick={() => setRemovedPoints((p) => removed ? (() => { const n = new Set(p); n.delete(item.key); return n; })() : new Set(p).add(item.key))}
                                  aria-label={removed ? 'Restore change' : 'Remove change'}
                                  className={`w-7 h-7 rounded-lg border text-[12px] font-bold cursor-pointer transition-colors shrink-0 ${removed ? 'bg-[var(--color-cta-soft)] border-[var(--color-cta-line)] text-[var(--color-cta)]' : 'bg-[var(--color-danger-soft)] border-[#FECACA] text-[var(--color-danger)] hover:bg-[#FDE8E8]'}`}>
                                  {removed ? '↺' : '✕'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {reviewItems.length > REVIEW_CAP && (
                          <button onClick={() => setShowAllReview((v) => !v)} className="w-full mt-2 py-1.5 rounded-lg border border-[var(--color-hairline)] text-[11.5px] font-bold text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] cursor-pointer transition-colors">
                            {showAllReview ? 'Show less' : `+${reviewItems.length - REVIEW_CAP} more additions`}
                          </button>
                        )}
                        {reviewItems.length === 0 && (
                          <p className="text-xs text-[var(--color-faint)]">No changes to review.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* PANEL 4 · Preview · edit */}
            <div className={panelCls(4)}>
              {!editableCv ? (
                <div className="flex-1 flex items-center justify-center text-center px-6">
                  <div>
                    <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[var(--color-hairline)] flex items-center justify-center">
                      <PencilLine className="w-6 h-6 text-[var(--color-faint)]" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-faint)]">Tailor your CV to unlock the editor</p>
                    <p className="text-[11px] text-slate-300 mt-1">The AI-prepared CV becomes a fully editable draft here</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full min-h-0">
                  <div className="shrink-0 flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-[16px] font-bold text-[var(--color-ink)] flex items-center gap-2">
                      Preview · make it yours {stepBadge(4)}
                    </h2>
                    <button
                      type="button"
                      onClick={toggleHideAI}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold border transition-colors cursor-pointer ${
                        hideAI ? 'bg-white border-[var(--color-hairline)] text-[var(--color-ink)]' : 'bg-[var(--color-brand-soft)] border-[var(--color-brand-line)] text-[var(--color-brand)]'
                      }`}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      {hideAI ? 'Show AI content' : 'Hide AI content'}
                    </button>
                  </div>
                  <div className="text-[10.5px] font-semibold text-[var(--color-faint)] -mt-2 mb-3">
                    {hideAI
                      ? `Hiding ${editableCv.skills.filter((s) => s.ai).length + editableCv.experiences.reduce((a, e) => a + e.bullets.filter((b) => b.ai).length, 0)} AI items — only your own content is shown`
                      : 'Items a ✦ mark were added or rewritten by AI for this job — delete what you don\u2019t want'}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                    {/* Summary */}
                    <div className="border border-[var(--color-hairline)] rounded-xl bg-[#FAFAF9]/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[12.5px] font-bold text-[var(--color-ink)]">Professional Summary</h3>
                        <span className="text-[10px] font-bold text-[var(--color-faint)] bg-white border border-[var(--color-hairline)] rounded-md px-1.5 py-0.5">editable</span>
                      </div>
                      <textarea
                        value={editableCv.summary}
                        onChange={(e) => setSummary(e.target.value)}
                        rows={4}
                        className="w-full border border-[var(--color-hairline)] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed text-[var(--color-muted)] bg-white outline-none focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand)]/12 transition-colors resize-y"
                      />
                    </div>

                    {/* Skills */}
                    <div className="border border-[var(--color-hairline)] rounded-xl bg-[#FAFAF9]/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[12.5px] font-bold text-[var(--color-ink)]">Key Skills</h3>
                        <button
                          type="button"
                          onClick={() => { const v = prompt('Add your own skill:'); if (v?.trim()) addSkill(v); }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-[var(--color-brand)] bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] hover:bg-[#DBEAFE] cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {editableCv.skills.filter((s) => !hideAI || !s.ai).map((s) => (
                          <span key={s.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-semibold border ${hideAI ? 'bg-white border-[var(--color-hairline)] text-[var(--color-muted)]' : s.ai ? 'bg-[#F5F3FF] border-[#E9D5FF] text-[var(--color-brand)]' : 'bg-white border-[var(--color-hairline)] text-[var(--color-muted)]'}`}>
                            {s.ai && !hideAI && <Wand2 className="w-3 h-3 text-purple-500" />}
                            {s.text}
                            <button
                              type="button"
                              onClick={() => toggleSkill(s.id)}
                              aria-label={`Remove ${s.text}`}
                              className="ml-0.5 w-4.5 h-4.5 rounded-md border text-[10px] font-bold cursor-pointer transition-colors shrink-0 bg-white border-[var(--color-hairline)] text-[var(--color-faint)] hover:text-[var(--color-danger)] hover:border-[#FECACA]"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {editableCv.skills.filter((s) => !hideAI || !s.ai).length === 0 && (
                          <p className="text-[11px] text-[var(--color-faint)]">No visible skills — add your own.</p>
                        )}
                      </div>
                    </div>

                    {/* Experience */}
                    {editableCv.experiences.filter((e) => !hideAI || e.bullets.some((b) => !b.ai) || e.title || e.company).map((exp) => (
                      <div key={exp.id} className="border border-[var(--color-hairline)] rounded-xl bg-[#FAFAF9]/50 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <input
                            value={exp.title}
                            onChange={(e) => setExpTitle(exp.id, e.target.value)}
                            placeholder="Job title"
                            className="flex-1 min-w-0 border border-transparent rounded-lg px-2 py-1 text-[13px] font-bold text-[var(--color-ink)] bg-transparent outline-none focus:border-[var(--color-brand)] focus:bg-white transition-colors"
                          />
                          <span className="text-[10px] font-semibold text-[var(--color-faint)] whitespace-nowrap">{exp.company} · {exp.dates}</span>
                        </div>
                        <div className="space-y-1.5">
                          {exp.bullets.filter((b) => !hideAI || !b.ai).map((b) => (
                            <div key={b.id} className="flex items-start gap-2">
                              <span className="mt-2 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                              <input
                                value={b.text}
                                onChange={(e) => setBullet(b.id, e.target.value)}
                                className="flex-1 min-w-0 border border-transparent rounded-lg px-2 py-1 text-[12px] text-[var(--color-muted)] bg-transparent outline-none focus:border-[var(--color-brand)] focus:bg-white transition-colors"
                              />
                              {b.ai && !hideAI && <Wand2 className="w-3 h-3 text-purple-500 mt-1.5 shrink-0" />}
                              <button
                                type="button"
                                onClick={() => toggleBullet(b.id)}
                                aria-label="Remove bullet"
                                className="mt-1 w-5 h-5 rounded-md border text-[9px] font-bold cursor-pointer transition-colors shrink-0 bg-white border-[var(--color-hairline)] text-[var(--color-faint)] hover:text-[var(--color-danger)] hover:border-[#FECACA]"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {exp.bullets.filter((b) => !hideAI || !b.ai).length === 0 && (
                            <p className="text-[11px] text-[var(--color-faint)]">No visible bullets for this role.</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { const v = prompt('Add your own bullet point:'); if (v?.trim()) addBullet(exp.id, v); }}
                          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--color-brand)] hover:text-[var(--color-brand)] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add your own bullet
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT · CV Preview — original + tailored with sliding comparison */}
        <section className="flex-1 min-w-0 bg-white border border-[var(--color-hairline)] border-l-0 rounded-r-[14px] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--color-hairline)] bg-[#FAFAF9]/80 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-faint)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-soft)]0" /> CV Preview
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-white border border-[var(--color-hairline)] rounded-full p-0.5">
                {([
                  { id: 'harvard', label: 'Harvard' },
                  { id: 'jake', label: 'Jake' },
                  { id: 'atanu', label: 'Atanu' }, { id: 'atanu-pro', label: 'Atanu Pro' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewTemplate(t.id)}
                    title={`Preview and download in the ${t.label} template`}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors cursor-pointer ${
                      previewTemplate === t.id ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-faint)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={previewDragActive ? () => downloadEdited('pdf') : () => download('pdf')}
                disabled={previewDragActive ? !editableNewCv : !downloadToken}
                title={previewDragActive ? 'Download the EDITED CV as PDF (in the selected template)' : downloadToken ? 'Download the tailored CV as PDF (in the selected template)' : 'Tailor your CV first to download'}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--color-ink)] text-white hover:bg-slate-700"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
              {previewDragActive && (
                <button
                  type="button"
                  onClick={() => downloadEdited('txt')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors cursor-pointer bg-white border border-[var(--color-hairline)] text-[var(--color-muted)] hover:bg-slate-50"
                >
                  <FileText className="w-3 h-3" /> TXT
                </button>
              )}
              <span className="text-[10.5px] font-bold text-[var(--color-faint)] bg-white border border-[var(--color-hairline)] rounded-full px-2 py-0.5">
                {previewDragActive ? 'Your edited CV' : tailoredCv ? 'Drag to compare' : 'Original CV'}
              </span>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 bg-[#F1F5F9]" ref={wrapRef}>
            {previewDragActive && editableNewCv ? (
              <div className="absolute inset-0 overflow-y-auto bg-[#F1F5F9] p-3">
                <CvPdfPreview cv={editableNewCv} template={previewTemplate} fitToWidth />
              </div>
            ) : !tailoredCv ? (
              originalCv ? (
                <div className="absolute inset-0 overflow-y-auto">
                  <CvPdfPreview cv={originalCv} template={previewTemplate} fitToWidth />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-faint)]">
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
                  className="absolute inset-0 overflow-y-auto bg-[#F1F5F9]"
                >
                  {originalCv && <CvPdfPreview cv={originalCv} template={previewTemplate} fitToWidth />}
                </div>
                {/* TAILORED layer (clipped by the slider) */}
                {newCv && (
                  <div
                    ref={newScrollRef}
                    onScroll={(e) => syncScroll(e.currentTarget, oldScrollRef.current)}
                    className="absolute inset-0 overflow-y-auto bg-[#F1F5F9]"
                    style={{ clipPath: `inset(0 0 0 ${cut}%)` }}
                  >
                    <CvPdfPreview cv={newCv} template={previewTemplate} fitToWidth />
                  </div>
                )}
                {/* Handle */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-[var(--color-brand)] z-10 cursor-ew-resize"
                  style={{ left: `${cut}%` }}
                  onPointerDown={(e) => { e.preventDefault(); draggingRef.current = true; }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-md">
                    <ChevronsLeftRight className="w-4 h-4 text-[var(--color-brand)]" />
                  </div>
                </div>
                {/* Tags */}
                <span className="absolute top-3 left-3 z-10 text-[10px] font-extrabold tracking-wide text-[var(--color-faint)] bg-white/95 border border-[var(--color-hairline)] rounded-full px-2.5 py-1 shadow-sm">ORIGINAL</span>
                <span className="absolute top-3 right-3 z-10 text-[10px] font-extrabold tracking-wide text-[var(--color-brand)] bg-[var(--color-brand-soft)]/95 border border-[var(--color-brand-line)] rounded-full px-2.5 py-1 shadow-sm">TAILORED</span>
                {cvLoadFailed && (
                  <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
                    <span className="text-[10.5px] font-semibold text-[var(--color-amber,#C2410C)] bg-[var(--color-amber-soft,#FFF7ED)]/95 border border-[var(--color-amber-line,#FED7AA)] rounded-full px-3 py-1.5 shadow-sm">
                      Tailored CV unavailable — download it from the workspace
                    </span>
                  </div>
                )}
                {!cvLoadFailed && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[10.5px] font-semibold text-[var(--color-muted)] bg-white/95 border border-[var(--color-hairline)] rounded-full px-3 py-1.5 shadow-sm whitespace-nowrap">
                    ↔ Drag to slide between Original &amp; Tailored
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-[var(--color-faint)] pb-3 pt-2 shrink-0">
        © 2025 Tailor CV by Atanu. All rights reserved.
      </footer>

      {/* History overlay */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
          <div className="w-full max-w-md bg-white h-full flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--color-hairline)] flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--color-ink)]">Manual JD history</h2>
              <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-lg text-[var(--color-faint)] hover:bg-[var(--color-brand-soft)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {historyMsg && <p className="text-[11.5px] font-semibold text-[var(--color-brand)]">{historyMsg}</p>}
              {historyLoading && <p className="text-[12px] text-[var(--color-faint)]">Loading…</p>}
              {!historyLoading && history.length === 0 && <p className="text-[12px] text-[var(--color-faint)] text-center py-10">No analyses yet.</p>}
              {history.map((h) => (
                <div key={h.id} onClick={() => restoreAnalysis(h.id)} className={`border rounded-xl p-3 cursor-pointer transition-colors ${historyId === h.id ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]/60' : 'border-[var(--color-hairline)] hover:border-[var(--color-brand)] hover:bg-[#FAFAF9]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--color-ink)] truncate">{h.role || 'Untitled role'}</p>
                      <p className="text-[10.5px] text-[var(--color-faint)] truncate mt-0.5">
                        {h.company || '—'} · {new Date(h.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${h.score >= 75 ? 'bg-[var(--color-cta-soft)] text-[var(--color-cta)]' : h.score >= 50 ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : 'bg-[var(--color-amber-soft,#FFF7ED)] text-[var(--color-amber,#C2410C)]'}`}>
                        {h.score}%
                      </span>
                      {h.hasTailoredCv && <span className="text-[9px] font-bold text-[var(--color-cta)] bg-[var(--color-cta-soft)] rounded-lg px-1.5 py-0.5">Tailored</span>}
                      <button onClick={(e) => deleteHistoryEntry(h.id, e)} className="p-1 rounded-md text-slate-300 hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors cursor-pointer" title="Delete">
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
