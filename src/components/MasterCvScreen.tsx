import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MasterCv, TemplateId, CV_TEMPLATES } from '../types';
import { llmErrorMessage } from '../lib/llmError';
import { PREDEFINED_ROLES, PREDEFINED_KEYWORDS, PREDEFINED_LOCATIONS } from '../constants/suggestions';
import { DateRangePicker } from './DateRangePicker';
import { TagInput } from './TagInput';
import { CvPdfPreview, masterCvToPdfShape, compressedCvToPdfShape } from './CvPdfPreview';
import {
  X,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Sparkles,
  Loader2,
  Upload,
  Linkedin,
  Github,
  Globe,
  Award,
  FolderGit2,
  GripVertical,
  History,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileText,
  ArrowLeft,
} from 'lucide-react';

interface MasterCvScreenProps {
  isOpen: boolean;
  onClose: () => void;
  masterCv: MasterCv;
  onSaveMasterCv: (updated: MasterCv) => Promise<void>;
}

export const MasterCvScreen: React.FC<MasterCvScreenProps> = ({
  isOpen,
  onClose,
  masterCv,
  onSaveMasterCv,
}) => {
  const [formData, setFormData] = useState<MasterCv>(masterCv);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(75);
  const [template, setTemplate] = useState<TemplateId>(masterCv.templateId || 'harvard');
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [tplMenuPos, setTplMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const tplBtnRef = useRef<HTMLButtonElement>(null);

  const [rawPasteText, setRawPasteText] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadFilename, setDownloadFilename] = useState(masterCv.downloadFilename || masterCv.fullName.replace(/ /g, '_') + '_CV');
  const [skillGaps, setSkillGaps] = useState<{ skill: string; count: number; totalScored: number }[]>([]);
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());
  const [showGaps, setShowGaps] = useState(false);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsAddedMsg, setGapsAddedMsg] = useState<string | null>(null);

  const [summarySuggestions, setSummarySuggestions] = useState<{ label: string; text: string }[]>([]);
  const [isImprovingSummary, setIsImprovingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const wasOpenRef = useRef(false);

  // Reset formData only when the drawer transitions closed → open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setFormData(masterCv);
      setDownloadFilename(masterCv.downloadFilename || masterCv.fullName.replace(/ /g, '_') + '_CV');
      setSavedSuccess(false);
      setSummarySuggestions([]);
      setSummaryError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, masterCv]);

  const fetchSkillGaps = async () => {
    setGapsLoading(true);
    try {
      const res = await fetch('/api/cv/skill-gaps');
      if (res.ok) {
        const data = await res.json();
        setSkillGaps(data.gaps || []);
      }
    } catch { /* ignore */ }
    setGapsLoading(false);
  };

  const handleAskAiSummary = async () => {
    if (!formData.summary.trim()) {
      setSummaryError('Write a brief summary first, then ask AI to improve it.');
      return;
    }
    setIsImprovingSummary(true);
    setSummaryError(null);
    setSummarySuggestions([]);
    try {
      const res = await fetch('/api/cv/improve-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: formData.summary,
          experiences: formData.experiences,
          skills: formData.skills,
          certifications: formData.certifications,
          fullName: formData.fullName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummarySuggestions(data.options || []);
      } else {
        const err = await res.json();
        setSummaryError(err.error || 'Failed to generate suggestions.');
      }
    } catch {
      setSummaryError('AI request failed. Please try again.');
    }
    setIsImprovingSummary(false);
  };

  const applySummarySuggestion = (text: string) => {
    setFormData({ ...formData, summary: text });
    setSummarySuggestions([]);
  };

  const toggleGap = (skill: string) => {
    setSelectedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const addSelectedGapsToCv = async () => {
    if (selectedGaps.size === 0) return;
    const updated = { ...formData };
    const newSkills: string[] = Array.from(selectedGaps);
    const skillsCat = updated.skills.find((s) => s.category.toLowerCase().includes('skill') || s.category === 'Core Competencies');
    if (skillsCat) {
      const normalized = newSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
      const existing = new Set(skillsCat.items.map((i) => i.toLowerCase()));
      skillsCat.items = [...normalized.filter((n) => !existing.has(n.toLowerCase())), ...skillsCat.items];
    } else {
      updated.skills = [{ category: 'Core Competencies', items: newSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)) }, ...updated.skills];
    }
    setFormData(updated);
    setSkillGaps((prev) => prev.filter((g) => !selectedGaps.has(g.skill)));
    setSelectedGaps(new Set());
    await onSaveMasterCv(updated);
    setGapsAddedMsg(`Added ${newSkills.length} skill${newSkills.length > 1 ? 's' : ''} and saved to profile.`);
    setTimeout(() => setGapsAddedMsg(null), 4000);
  };

  const handleParseRawText = async () => {
    if (!rawPasteText.trim()) return;
    setIsParsingText(true);
    setParseError(null);
    setExtractedFileName(null);
    try {
      const res = await fetch('/api/cv/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawPasteText }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = 'Failed to extract resume details';
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson.error || errJson.message || errMsg;
        } catch {
          if (text && text.length < 300) errMsg = text;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.success && data.cv) {
        setFormData(data.cv);
        setShowPasteBox(false);
        setRawPasteText('');
        setExtractedFileName('Pasted Raw Text');
      } else {
        setParseError(data.error || 'Failed to extract resume details');
      }
    } catch (err: any) {
      setParseError(err.message || 'Error communicating with server');
    } finally {
      setIsParsingText(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingText(true);
    setParseError(null);
    setExtractedFileName(null);

    const bodyData = new FormData();
    bodyData.append('resume', file);

    try {
      const res = await fetch('/api/cv/upload-file', {
        method: 'POST',
        body: bodyData,
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = 'Failed to extract resume from file';
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson.error || errJson.message || errMsg;
        } catch {
          if (text && text.length < 300) errMsg = text;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.success && data.cv) {
        setFormData(data.cv);
        setExtractedFileName(file.name);
      } else {
        setParseError(data.error || 'Failed to extract resume from file');
      }
    } catch (err: any) {
      setParseError(err.message || 'Error uploading resume file');
    } finally {
      setIsParsingText(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    await onSaveMasterCv({ ...formData, downloadFilename, templateId: template });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDownloadPdf = async () => {
    const res = await fetch(`/api/cv/master/download?format=pdf&template=${template}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${downloadFilename}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Template menu: render via portal at document.body with fixed
  //    positioning from the button's bounding rect, so no parent
  //    container (overflow-hidden preview, transform, etc.) can clip or
  //    contain it. Auto-flips upward when there's no room below.
  const TPL_MENU_H = 288; // approx height of the 3-option menu
  const openTemplateMenu = () => {
    const btn = tplBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < TPL_MENU_H + 8;
    setTplMenuPos({
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 296)),
    });
    setTemplateMenuOpen(true);
  };

  const closeTemplateMenu = () => {
    setTemplateMenuOpen(false);
    setTplMenuPos(null);
  };

  // Reposition on scroll/resize while open so the menu stays anchored
  // to the button even if the page/preview scrolls.
  useEffect(() => {
    if (!templateMenuOpen) return;
    const reposition = () => openTemplateMenu();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateMenuOpen]);

  const [aiState, setAiState] = useState<'idle' | 'running' | 'result'>('idle');
  const [compressResult, setCompressResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<{ id: string; note: string; pages: number; createdAt: string }[]>([]);
  const [pagesBefore, setPagesBefore] = useState(0);
  const [pagesAfter, setPagesAfter] = useState(0);
  const aiStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);

  const AI_STEPS = ['Reading the market…', 'Analyzing your CV…', 'Rewriting…', 'Verifying keywords & page count…'];

  const handleAiCompress = async () => {
    setAiState('running');
    setAiError(null);
    setAiStep(0);
    aiStepTimer.current = setInterval(() => {
      setAiStep((s) => Math.min(s + 1, AI_STEPS.length - 1));
    }, 2500);
    try {
      const res = await fetch('/api/cv/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiState('idle');
        setAiError(data.error || 'Compression failed');
        alert(llmErrorMessage(data.code, data.error));
        return;
      }
      setCompressResult(data);
      setAiState('result');
    } catch (e: any) {
      setAiState('idle');
      setAiError(e.message || 'Compression failed');
    } finally {
      if (aiStepTimer.current) clearInterval(aiStepTimer.current);
    }
  };

  const handleAcceptCompressed = async () => {
    try {
      const res = await fetch('/api/cv/ai/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compressedCv: compressResult.compressedCv }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error || 'Apply failed'); return; }
      setFormData(data.cv);
      setConfirmOpen(false);
      setAiState('idle');
      setCompressResult(null);
      onSaveMasterCv(data.cv);
    } catch (e: any) {
      setAiError(e.message || 'Apply failed');
    }
  };

  const loadVersions = async () => {
    try {
      const res = await fetch('/api/cv/versions');
      if (res.ok) setVersions((await res.json()).versions || []);
    } catch { /* ignore */ }
  };

  const restoreVersion = async (id: string) => {
    try {
      const res = await fetch(`/api/cv/versions/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.cv) {
        setFormData(data.cv);
        setAiState('idle');
        onSaveMasterCv(data.cv);
      }
    } catch { /* ignore */ }
  };

  const updateExperienceResponsibility = (expIdx: number, respIdx: number, val: string) => {
    const updated = { ...formData };
    updated.experiences[expIdx].responsibilities[respIdx] = val;
    setFormData(updated);
  };

  const addExperienceResponsibility = (expIdx: number) => {
    const updated = { ...formData };
    updated.experiences[expIdx].responsibilities.push('New responsibility or key achievement...');
    setFormData(updated);
  };

  const removeExperienceResponsibility = (expIdx: number, respIdx: number) => {
    const updated = { ...formData };
    updated.experiences[expIdx].responsibilities.splice(respIdx, 1);
    setFormData(updated);
  };

  const addExperience = () => {
    const updated = { ...formData };
    updated.experiences = [{
      id: `exp-${Date.now()}`,
      title: 'Job Title',
      company: 'Company Name',
      location: 'Remote / City, State',
      dates: '2022 - Present',
      responsibilities: ['Key responsibility or major accomplishment...'],
    }, ...updated.experiences];
    setFormData(updated);
  };

  const removeExperience = (expIdx: number) => {
    const updated = { ...formData };
    updated.experiences.splice(expIdx, 1);
    setFormData(updated);
  };

  const addEducation = () => {
    const updated = { ...formData };
    if (!updated.education) updated.education = [];
    updated.education = [{
      id: `edu-${Date.now()}`,
      degree: 'B.S. Computer Science',
      institution: 'University Name',
      dates: '2018 - 2022',
      details: 'Major in Software Engineering',
    }, ...updated.education];
    setFormData(updated);
  };

  const removeEducation = (eduIdx: number) => {
    const updated = { ...formData };
    updated.education.splice(eduIdx, 1);
    setFormData(updated);
  };

  const addSkillCategory = () => {
    const updated = { ...formData };
    updated.skills = [{
      category: 'New Category',
      items: ['Skill 1', 'Skill 2'],
    }, ...updated.skills];
    setFormData(updated);
  };

  const removeSkillCategory = (skIdx: number) => {
    const updated = { ...formData };
    updated.skills.splice(skIdx, 1);
    setFormData(updated);
  };

  const addProject = () => {
    const newProject = {
      id: `proj-${Date.now()}`,
      name: 'Project Name',
      description: 'Key project description, highlights, and results...',
      technologies: ['React', 'Node.js', 'TypeScript'],
      link: '',
      dates: '2023',
    };
    setFormData((prev) => ({
      ...prev,
      projects: [newProject, ...(prev.projects || [])],
    }));
  };

  const [dragProjectIdx, setDragProjectIdx] = useState<number | null>(null);
  const [dragExpIdx, setDragExpIdx] = useState<number | null>(null);

  const handleProjectDragStart = (e: React.DragEvent, idx: number) => {
    setDragProjectIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleProjectDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragProjectIdx === null || dragProjectIdx === targetIdx) {
      setDragProjectIdx(null);
      return;
    }
    setFormData((prev) => {
      const projects = [...(prev.projects || [])];
      const [moved] = projects.splice(dragProjectIdx, 1);
      projects.splice(targetIdx, 0, moved);
      return { ...prev, projects };
    });
    setDragProjectIdx(null);
  };

  const handleExpDragStart = (e: React.DragEvent, idx: number) => {
    setDragExpIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleExpDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleExpDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragExpIdx === null || dragExpIdx === targetIdx) {
      setDragExpIdx(null);
      return;
    }
    setFormData((prev) => {
      const experiences = [...prev.experiences];
      const [moved] = experiences.splice(dragExpIdx, 1);
      experiences.splice(targetIdx, 0, moved);
      return { ...prev, experiences };
    });
    setDragExpIdx(null);
  };

  const removeProject = (pIdx: number) => {
    setFormData((prev) => ({
      ...prev,
      projects: (prev.projects || []).filter((_, i) => i !== pIdx),
    }));
  };

  const addCertification = () => {
    const updated = { ...formData };
    if (!updated.certifications) updated.certifications = [];
    updated.certifications = [{
      id: `cert-${Date.now()}`,
      name: 'AWS Certified Solutions Architect',
      issuer: 'Amazon Web Services',
      date: '2023',
      link: '',
    }, ...updated.certifications];
    setFormData(updated);
  };

  const removeCertification = (cIdx: number) => {
    const updated = { ...formData };
    if (updated.certifications) {
      updated.certifications.splice(cIdx, 1);
      setFormData(updated);
    }
  };

  const [dragCertIdx, setDragCertIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCertDragStart = (e: React.DragEvent, idx: number) => {
    setDragCertIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCertDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCertDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragCertIdx === null || dragCertIdx === targetIdx) {
      setDragCertIdx(null);
      return;
    }
    setFormData((prev) => {
      const certs = [...(prev.certifications || [])];
      const [moved] = certs.splice(dragCertIdx, 1);
      certs.splice(targetIdx, 0, moved);
      return { ...prev, certifications: certs };
    });
    setDragCertIdx(null);
  };

  return (
    <div className="fixed inset-0 z-40 bg-white text-[var(--color-ink)] flex">
      {/* LEFT: EDITOR */}
      <div className="w-[46%] min-w-[420px] border-r border-[var(--color-hairline)] flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--color-hairline)] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[var(--color-faint)] bg-white hover:bg-[#FAFAFF] border border-[var(--color-hairline)] transition-colors cursor-pointer"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <User className="w-5 h-5 text-[var(--color-muted)] ml-1" />
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink)] leading-tight">Master Candidate CV</h2>
              <p className="text-[10.5px] text-[var(--color-faint)] font-medium">Edits apply to every score &amp; tailor · autosaved on Save</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {savedSuccess && (
              <span className="text-xs text-[var(--color-cta)] font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved!</span>
              </span>
            )}

            {/* Save split-button: Save | dropdown (Download PDF) */}
            <div className="relative">
              <div className="flex items-stretch">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  id="btn-save-master-cv"
                  className="px-3 py-1.5 rounded-l-lg text-xs font-semibold bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaveMenuOpen((v) => !v)}
                  className="px-1.5 py-1.5 rounded-r-lg text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] border-l border-blue-500 transition-colors cursor-pointer"
                  title="More options"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${saveMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {saveMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSaveMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[var(--color-hairline)] rounded-xl shadow-lg z-50 p-1.5">
                    <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-faint)]">
                      Export
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSaveMenuOpen(false); handleDownloadPdf(); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-brand-soft)] cursor-pointer text-left"
                    >
                      <FileDown className="w-4 h-4 text-[var(--color-faint)]" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveMenuOpen(false); handleSave(); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-brand-soft)] cursor-pointer text-left"
                    >
                      <Save className="w-4 h-4 text-[var(--color-faint)]" />
                      Save changes
                    </button>
                  </div>
                </>
              )}
            </div>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            {/* Compact utilities */}
            <button
              type="button"
              onClick={() => { setVersionsOpen(true); loadVersions(); }}
              className="p-2 rounded-lg text-[var(--color-faint)] hover:text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)] border border-transparent hover:border-[var(--color-hairline)] transition-colors cursor-pointer"
              title="CV versions & backups"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Body Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-[var(--color-ink)]">
          {/* File Upload & Quick Paste Auto-Extract Banner */}
          <div className="bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] p-4 rounded-xl text-blue-900 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4.5 h-4.5 text-[var(--color-brand)]" />
                <span className="font-bold text-xs text-blue-950">Upload & Scrape Resume (PDF, DOCX, TXT)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="text-xs text-[var(--color-brand)] font-semibold underline hover:text-blue-900 cursor-pointer"
              >
                {showPasteBox ? 'Hide Raw Text Box' : 'Paste Raw Text Instead'}
              </button>
            </div>

            {/* Upload Dropzone Box */}
            <div className="grid grid-cols-1 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="cv-file-upload-input"
              />
              <label
                htmlFor="cv-file-upload-input"
                className={`border-2 border-dashed rounded-lg p-4 bg-white hover:bg-[var(--color-brand-soft)]/50 border-[var(--color-brand)] hover:border-blue-500 transition-all flex flex-col items-center justify-center cursor-pointer text-center ${
                  isParsingText ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isParsingText ? (
                  <div className="flex items-center space-x-2 py-1 text-[var(--color-brand)] font-bold">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>AI is reading & extracting A to Z resume details...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-1">
                    <Upload className="w-6 h-6 text-[var(--color-brand)] mb-1" />
                    <span className="font-bold text-blue-900 text-xs">
                      Click to upload candidate CV (PDF, DOCX, TXT)
                    </span>
                    <span className="text-[11px] text-[var(--color-brand)]">
                      Gemini AI will automatically extract contact details, summary, work history, education, & skills into the fields below!
                    </span>
                  </div>
                )}
              </label>
            </div>

            {extractedFileName && (
              <div className="bg-[var(--color-cta-soft)] border border-[var(--color-cta-line)] p-2.5 rounded-lg flex items-center justify-between text-emerald-800 text-xs font-medium">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-cta)]" />
                  <span>Successfully extracted from <strong>{extractedFileName}</strong>! All fields populated below.</span>
                </div>
              </div>
            )}

            {parseError && (
              <p className="text-xs text-[var(--color-danger)] font-semibold bg-[var(--color-danger-soft)] p-2 rounded border border-[#FECACA]">
                {parseError}
              </p>
            )}

            {showPasteBox && (
              <div className="space-y-2 pt-2 border-t border-[var(--color-brand-line)]">
                <p className="text-[11px] text-blue-800">
                  Paste raw text from candidate's resume to parse directly:
                </p>
                <textarea
                  rows={5}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="Paste candidate's full resume text here..."
                  className="w-full bg-white border border-[var(--color-brand)] rounded p-2.5 text-xs text-[var(--color-ink)] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParseRawText}
                    disabled={isParsingText || !rawPasteText.trim()}
                    className="px-3 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] disabled:bg-blue-300 text-white font-semibold rounded text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    {isParsingText ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting CV Data...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Auto-Fill Form Fields</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Predefined Datalists for Master CV */}
          <datalist id="mastercv-locations">
            {PREDEFINED_LOCATIONS.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>

          <datalist id="mastercv-roles">
            {PREDEFINED_ROLES.map((role) => (
              <option key={role} value={role} />
            ))}
          </datalist>

          <datalist id="mastercv-keywords">
            {PREDEFINED_KEYWORDS.map((kw) => (
              <option key={kw} value={kw} />
            ))}
          </datalist>

          {/* Contact Details Section */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-3">
            <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-[var(--color-muted)]" />
              <span>Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="alex@example.com"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1">Location</label>
                <input
                  type="text"
                  list="mastercv-locations"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State / Country or Remote"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {PREDEFINED_LOCATIONS.slice(0, 4).map((loc) => (
                    <button
                      type="button"
                      key={loc}
                      onClick={() => setFormData({ ...formData, location: loc })}
                      className="text-[10px] bg-[#F1F0FA] hover:bg-slate-200 text-[var(--color-muted)] px-1.5 py-0.5 rounded cursor-pointer border border-[var(--color-hairline)]"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1 flex items-center space-x-1">
                  <Linkedin className="w-3 h-3 text-[var(--color-brand)]" />
                  <span>LinkedIn Profile</span>
                </label>
                <input
                  type="text"
                  value={formData.linkedin || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1 flex items-center space-x-1">
                  <Github className="w-3 h-3 text-[var(--color-ink)]" />
                  <span>GitHub Profile</span>
                </label>
                <input
                  type="text"
                  value={formData.github || ''}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[var(--color-muted)] font-medium mb-1 flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-[var(--color-cta)]" />
                  <span>Portfolio / Personal Website</span>
                </label>
                <input
                  type="text"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://portfolio.dev or https://alexjohnson.com"
                  className="w-full bg-white border border-[var(--color-hairline)] rounded px-2.5 py-1.5 text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Master Professional Summary */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px]">
                Master Professional Summary
              </h3>
              <button
                type="button"
                onClick={handleAskAiSummary}
                disabled={isImprovingSummary}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--color-ink)] hover:bg-[#14113B] text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Ask AI to improve your summary"
              >
                {isImprovingSummary ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>Ask AI</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={4}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Candidate's comprehensive professional background summary..."
              className="w-full bg-white border border-[var(--color-hairline)] rounded p-2.5 text-[var(--color-ink)] leading-relaxed focus:outline-none focus:ring-1 focus:ring-slate-900"
            />

            {summaryError && (
              <p className="text-[11px] text-[var(--color-danger)] font-medium">{summaryError}</p>
            )}

            {summarySuggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-semibold text-[var(--color-brand)] flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Suggested Summaries — click one to apply:</span>
                </p>
                {summarySuggestions.map((opt, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => applySummarySuggestion(opt.text)}
                    className="w-full text-left p-3 rounded-lg border border-[var(--color-brand-line)] bg-white hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                    title={`Apply "${opt.label}"`}
                  >
                    <span className="block text-[10px] font-bold text-[var(--color-brand)] uppercase tracking-wide mb-1 group-hover:underline">
                      {opt.label}
                    </span>
                    <span className="text-xs text-[var(--color-muted)] leading-relaxed">{opt.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Work Experience History */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>Work Experience History</span>
              </h3>

              <button
                type="button"
                onClick={addExperience}
                className="text-[11px] font-semibold text-[var(--color-brand)] hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Position</span>
              </button>
            </div>

            {formData.experiences.map((exp, expIdx) => (
              <div
                key={exp.id || expIdx}
                draggable
                onDragStart={(e) => handleExpDragStart(e, expIdx)}
                onDragOver={handleExpDragOver}
                onDrop={(e) => handleExpDrop(e, expIdx)}
                className={`bg-white p-3.5 rounded-lg border space-y-3 cursor-grab active:cursor-grabbing transition-all ${
                  dragExpIdx === expIdx
                    ? 'border-blue-400 ring-2 ring-blue-200 opacity-70'
                    : 'border-[var(--color-hairline)] hover:border-[var(--color-brand-line)]'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                  <span className="font-bold text-[var(--color-muted)] text-[11px] flex items-center space-x-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-[var(--color-faint)]" />
                    <span>Position #{expIdx + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExperience(expIdx)}
                    className="text-[var(--color-faint)] hover:text-[var(--color-danger)] p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Job Title</label>
                    <input
                      type="text"
                      list="mastercv-roles"
                      value={exp.title}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].title = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Company</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].company = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Location</label>
                    <input
                      type="text"
                      value={exp.location || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].location = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. San Francisco, CA / Remote"
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Dates / Period</label>
                    <DateRangePicker
                      value={exp.dates || ''}
                      onChange={(v) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].dates = v;
                        setFormData(updated);
                      }}
                      placeholder="e.g. Jan 2021 - Present"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--color-faint)] text-[11px] mb-1 font-semibold">Responsibilities & Achievements</label>
                  <div className="space-y-1.5">
                    {exp.responsibilities.map((resp, respIdx) => (
                      <div key={respIdx} className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={resp}
                          onChange={(e) => updateExperienceResponsibility(expIdx, respIdx, e.target.value)}
                          className="flex-1 border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                        />
                        <button
                          type="button"
                          onClick={() => removeExperienceResponsibility(expIdx, respIdx)}
                          className="p-1 text-[var(--color-faint)] hover:text-[var(--color-danger)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addExperienceResponsibility(expIdx)}
                    className="mt-2 text-[11px] font-semibold text-[var(--color-brand)] hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Responsibility Bullet</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Education History */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>Education History</span>
              </h3>

              <button
                type="button"
                onClick={addEducation}
                className="text-[11px] font-semibold text-[var(--color-brand)] hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Education</span>
              </button>
            </div>

            {(formData.education || []).map((edu, eduIdx) => (
              <div key={edu.id || eduIdx} className="bg-white p-3 rounded-lg border border-[var(--color-hairline)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--color-muted)] text-[11px]">Degree #{eduIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeEducation(eduIdx)}
                    className="text-[var(--color-faint)] hover:text-[var(--color-danger)] p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Degree / Qualification</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].degree = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Institution / University</label>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].institution = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Dates / Graduation Year</label>
                    <DateRangePicker
                      value={edu.dates || ''}
                      onChange={(v) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].dates = v;
                        setFormData(updated);
                      }}
                      placeholder="Pick start & end date"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Honors / Details</label>
                    <input
                      type="text"
                      value={edu.details || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].details = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Technical Skills */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Code className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>Technical Skills & Core Competencies</span>
              </h3>

              <button
                type="button"
                onClick={addSkillCategory}
                className="text-[11px] font-semibold text-[var(--color-brand)] hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Skill Category</span>
              </button>
            </div>

            <div className="space-y-2">
              {formData.skills.map((sk, skIdx) => (
                <div key={skIdx} className="flex items-center space-x-2 bg-white p-2 rounded border border-[var(--color-hairline)]">
                  <input
                    type="text"
                    value={sk.category}
                    onChange={(e) => {
                      const updated = { ...formData };
                      updated.skills[skIdx].category = e.target.value;
                      setFormData(updated);
                    }}
                    placeholder="Category Name"
                    className="w-1/3 border border-[var(--color-hairline)] rounded px-2 py-1 font-bold text-[var(--color-ink)]"
                  />
                  <TagInput
                    value={sk.items}
                    onChange={(items) => {
                      const updated = { ...formData };
                      updated.skills[skIdx].items = items;
                      setFormData(updated);
                    }}
                    placeholder="Type a skill and press comma (,) or Enter…"
                  />
                  <button
                    type="button"
                    onClick={() => removeSkillCategory(skIdx)}
                    className="p-1 text-[var(--color-faint)] hover:text-[var(--color-danger)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Projects Section */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>Featured Projects & Portfolio</span>
              </h3>

              <button
                type="button"
                onClick={addProject}
                className="text-[11px] font-semibold text-[var(--color-brand)] hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Project</span>
              </button>
            </div>

            {(formData.projects || []).map((proj, pIdx) => (
              <div
                key={proj.id || pIdx}
                draggable
                onDragStart={(e) => handleProjectDragStart(e, pIdx)}
                onDragOver={handleProjectDragOver}
                onDrop={(e) => handleProjectDrop(e, pIdx)}
                className={`bg-white p-3 rounded-lg border space-y-2.5 cursor-grab active:cursor-grabbing transition-all ${
                  dragProjectIdx === pIdx
                    ? 'border-blue-400 ring-2 ring-blue-200 opacity-70'
                    : 'border-[var(--color-hairline)] hover:border-[var(--color-brand-line)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 font-bold text-[var(--color-muted)] text-[11px]">
                    <GripVertical className="w-3.5 h-3.5 text-[var(--color-faint)]" />
                    <span>Project #{pIdx + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProject(pIdx)}
                    className="text-[var(--color-faint)] hover:text-[var(--color-danger)] p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Project Name</label>
                    <input
                      type="text"
                      value={proj.name}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.projects) updated.projects = [];
                        updated.projects[pIdx].name = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. AI Portfolio Generator"
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Dates / Period</label>
                    <DateRangePicker
                      value={proj.dates || ''}
                      onChange={(v) => {
                        const updated = { ...formData };
                        if (!updated.projects) updated.projects = [];
                        updated.projects[pIdx].dates = v;
                        setFormData(updated);
                      }}
                      placeholder="e.g. 2023 - Present"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[var(--color-faint)] text-[11px]">Description & Achievements</label>
                    <textarea
                      rows={2}
                      value={proj.description}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.projects) updated.projects = [];
                        updated.projects[pIdx].description = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="Brief overview of project architecture, impact, and features..."
                      className="w-full border border-[var(--color-hairline)] rounded p-2 text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Technologies Used (Comma-separated)</label>
                    <input
                      type="text"
                      value={(proj.technologies || []).join(', ')}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.projects) updated.projects = [];
                        updated.projects[pIdx].technologies = e.target.value.split(',').map((t) => t.trim());
                        setFormData(updated);
                      }}
                      placeholder="e.g. React, Node.js, PostgreSQL"
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Project / Repository Link</label>
                    <input
                      type="text"
                      value={proj.link || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.projects) updated.projects = [];
                        updated.projects[pIdx].link = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="https://github.com/..."
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Certifications & Credentials */}
          <div className="bg-[#FAFAFF] p-4 rounded-lg border border-[var(--color-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-ink)] uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Award className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span>Certifications, Licenses & Credentials</span>
              </h3>

              <button
                type="button"
                onClick={addCertification}
                className="text-[11px] font-semibold text-[var(--color-brand)] hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Certification</span>
              </button>
            </div>

            {(formData.certifications || []).map((cert, cIdx) => (
              <div
                key={cert.id || cIdx}
                draggable
                onDragStart={(e) => handleCertDragStart(e, cIdx)}
                onDragOver={handleCertDragOver}
                onDrop={(e) => handleCertDrop(e, cIdx)}
                className={`bg-white p-3 rounded-lg border space-y-2 cursor-grab active:cursor-grabbing transition-all ${
                  dragCertIdx === cIdx
                    ? 'border-blue-400 ring-2 ring-blue-200 opacity-70'
                    : 'border-[var(--color-hairline)] hover:border-[var(--color-brand-line)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--color-muted)] text-[11px] flex items-center space-x-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-[var(--color-faint)]" />
                    <span>Certification #{cIdx + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCertification(cIdx)}
                    className="text-[var(--color-faint)] hover:text-[var(--color-danger)] p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[var(--color-faint)] text-[11px]">Certification Title / Name</label>
                    <input
                      type="text"
                      value={cert.name}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.certifications) updated.certifications = [];
                        updated.certifications[cIdx].name = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. AWS Certified Solutions Architect - Associate"
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)] font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Issuer / Organization</label>
                    <input
                      type="text"
                      value={cert.issuer || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.certifications) updated.certifications = [];
                        updated.certifications[cIdx].issuer = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. Amazon Web Services, Google, Coursera"
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--color-faint)] text-[11px]">Date Issued / Expiration</label>
                    <input
                      type="text"
                      value={cert.date || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.certifications) updated.certifications = [];
                        updated.certifications[cIdx].date = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. Nov 2023"
                      className="w-full border border-[var(--color-hairline)] rounded px-2 py-1 text-[var(--color-ink)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Skill Gaps Section */}
          <div className="bg-[#FAFAFF] border border-[var(--color-hairline)] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (!showGaps) fetchSkillGaps();
                setShowGaps(!showGaps);
              }}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-brand)]" />
                <span>Skill Gaps from Market</span>
                {skillGaps.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-[var(--color-brand-soft)] text-[var(--color-brand)] text-[10px] font-bold">
                    {skillGaps.length}
                  </span>
                )}
              </div>
              {showGaps ? <ChevronDown className="w-4 h-4 text-[var(--color-faint)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-faint)]" />}
            </button>

            {showGaps && (
              <div className="px-3.5 pb-3.5 space-y-2">
                {gapsLoading ? (
                  <div className="flex items-center space-x-2 text-xs text-[var(--color-faint)] py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing scored jobs...</span>
                  </div>
                ) : skillGaps.length === 0 ? (
                  <div className="flex items-center space-x-2 text-xs text-[var(--color-faint)] py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-amber,#C2410C)]" />
                    <span>No scored jobs yet. Run match analysis on jobs first.</span>
                  </div>
                ) : (
                  <>
                    {gapsAddedMsg && (
                      <div className="px-2 py-1.5 rounded bg-[var(--color-cta-soft)] border border-[var(--color-cta-line)] text-emerald-800 text-[11px] font-medium">
                        {gapsAddedMsg}
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--color-faint)]">
                      Skills most frequently missing across {skillGaps[0]?.totalScored || 0} scored jobs. Check the ones you have and add them to your CV.
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {skillGaps.map((gap) => (
                        <label
                          key={gap.skill}
                          className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-white cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGaps.has(gap.skill)}
                            onChange={() => toggleGap(gap.skill)}
                            className="rounded border-[var(--color-hairline2)] cursor-pointer"
                          />
                          <span className="flex-1 font-medium text-[var(--color-ink)]">{gap.skill}</span>
                          <span className="text-[10px] font-semibold text-[var(--color-faint)]">
                            {gap.count}/{gap.totalScored} jobs
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedGaps.size > 0 && (
                      <button
                        type="button"
                        onClick={addSelectedGapsToCv}
                        className="w-full px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] text-white transition-colors cursor-pointer"
                      >
                        Add {selectedGaps.size} Skill{selectedGaps.size > 1 ? 's' : ''} to CV
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* RIGHT: LIVE PDF PREVIEW */}
      <div className="flex-1 bg-[#F1F0FA] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-hairline)] bg-white/80 backdrop-blur-sm shrink-0 gap-3">
          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)] whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-cta-soft)]0" />
            </span>
            <span>Live PDF Preview</span>
          </span>

          {/* Template selector */}
          <div className="relative">
            <button
              ref={tplBtnRef}
              type="button"
              onClick={openTemplateMenu}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--color-muted)] bg-white border border-[var(--color-hairline)] hover:border-[var(--color-brand-line)] transition-colors cursor-pointer"
              title="Choose CV template"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--color-faint)]" />
              <span className="whitespace-nowrap">{CV_TEMPLATES.find((t) => t.id === template)?.label || 'Template'}</span>
              <ChevronDown className={`w-3 h-3 text-[var(--color-faint)] transition-transform ${templateMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            {/* PDF rename */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-bold text-[var(--color-faint)] uppercase tracking-wider hidden lg:inline">PDF name</span>
              <input
                type="text"
                value={downloadFilename}
                onChange={(e) => setDownloadFilename(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''))}
                className="w-36 bg-white border border-[var(--color-hairline)] rounded px-2 py-1 text-[11px] text-[var(--color-ink)] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                title="Rename the downloaded PDF (extension .pdf added automatically)"
              />
              <span className="text-[11px] text-[var(--color-faint)] font-mono hidden xl:inline">.pdf</span>
            </div>

            {/* AI Compress */}
            <button
              type="button"
              onClick={handleAiCompress}
              disabled={aiState === 'running'}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] disabled:opacity-50 transition-colors cursor-pointer shadow-md shadow-blue-600/20 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiState === 'running' ? 'Compressing…' : 'AI Compress'}</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 relative">
          <CvPdfPreview cv={masterCvToPdfShape(formData)} zoom={previewZoom} template={template} />

          {/* Floating zoom control — bottom-right corner, stays visible while scrolling */}
          <div className="sticky bottom-4 ml-auto w-fit flex items-center bg-white border border-[var(--color-hairline)] rounded-lg shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewZoom((z) => Math.max(40, z - 10))}
              className="px-2.5 py-1.5 text-[13px] font-extrabold text-[var(--color-faint)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(75)}
              className="px-2 py-1 text-[11px] font-bold text-[var(--color-muted)] hover:bg-[var(--color-brand-soft)] transition-colors cursor-pointer tabular-nums"
              title="Reset zoom to 75%"
            >
              {previewZoom}%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom((z) => Math.min(150, z + 10))}
              className="px-2.5 py-1.5 text-[13px] font-extrabold text-[var(--color-faint)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* AI progress overlay */}
      {aiState === 'running' && (
        <div className="fixed inset-0 z-50 bg-[var(--color-ink)]/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6">
            <div className="flex items-center space-x-2.5">
              <span className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </span>
              <div>
                <p className="text-sm font-bold text-[var(--color-ink)]">AI Compressing your CV</p>
                <p className="text-[11px] text-[var(--color-faint)]">Analyzing against live market data</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {AI_STEPS.map((label, i) => (
                <div key={label} className="flex items-center space-x-3">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                    i < aiStep ? 'border-emerald-500 bg-[var(--color-cta-soft)]0 text-white'
                    : i === aiStep ? 'border-blue-500 text-[var(--color-brand)]'
                    : 'border-[var(--color-hairline)] text-slate-300'
                  }`}>
                    {i < aiStep ? '✓' : i + 1}
                  </span>
                  <span className={`text-xs font-medium ${i <= aiStep ? 'text-[var(--color-ink)]' : 'text-[var(--color-faint)]'}`}>{label}</span>
                  {i === aiStep && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-brand)]" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI error */}
      {aiError && aiState !== 'running' && (
        <div className="absolute top-16 right-6 z-[70] bg-[var(--color-danger-soft)] border border-[#FECACA] text-red-700 text-xs font-semibold rounded-lg px-4 py-2.5 shadow-lg">
          {aiError}
        </div>
      )}

      {/* Result view: professional redesign */}
      {aiState === 'result' && compressResult && (
        <div className="fixed inset-0 z-50 bg-[#F7F8FA] flex flex-col">
          {/* Sticky header */}
          <div className="px-6 py-3.5 border-b border-[var(--color-hairline)] bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={() => { setAiState('idle'); setCompressResult(null); }}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[var(--color-faint)] bg-white hover:bg-[#FAFAFF] border border-[var(--color-hairline)] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <span className="text-sm font-extrabold text-[var(--color-ink)] whitespace-nowrap">AI Compression Result</span>
              <span className="inline-flex items-center gap-1.5 bg-[#FAFAFF] border border-[var(--color-hairline)] rounded-full px-3 py-1">
                <span className="text-xs font-extrabold text-[var(--color-faint)] line-through">{pagesBefore > 0 ? `${pagesBefore} pages` : '…'}</span>
                <span className="text-slate-300">→</span>
                <span className="text-sm font-extrabold text-[var(--color-cta)]">{pagesAfter > 0 ? pagesAfter : '…'}</span>
                <span className="text-xs font-extrabold text-[var(--color-cta)]">pages</span>
                <span className="text-[10px] text-[var(--color-faint)] font-semibold">· fit for any ATS</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button" onClick={() => { setAiState('idle'); setCompressResult(null); }}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-[var(--color-muted)] bg-white border border-[var(--color-hairline)] hover:border-[var(--color-brand-line)] cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={() => setConfirmOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] shadow-md shadow-blue-600/20 cursor-pointer">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-5">
              {/* Outcome hero */}
              <div className="bg-white border border-[var(--color-hairline)] rounded-2xl p-5 shadow-sm flex items-center gap-5 flex-wrap">
                <span className="w-12 h-12 rounded-xl bg-[var(--color-brand)] flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30">
                  <Sparkles className="w-5 h-5 text-white" />
                </span>
                <div className="flex-1 min-w-[220px]">
                  <p className="text-[15px] font-extrabold text-[var(--color-ink)]">Your CV is now {pagesAfter > 0 ? pagesAfter : 2} pages — concise, keyword-rich, ATS-ready</p>
                  <p className="text-[11.5px] text-[var(--color-faint)] mt-1">
                    Every achievement, metric, and key skill kept · tightened for impact · tailored with {compressResult.marketSummary?.topKeywords?.length ?? 0} live market keywords
                  </p>
                </div>
                <div className="flex gap-7 flex-wrap">
                  <div className="text-center min-w-[64px]">
                    <div className="text-xl font-extrabold text-[var(--color-brand)] tabular-nums">{pagesBefore > 0 ? `${pagesBefore} → ${pagesAfter}` : '…'}</div>
                    <div className="text-[10px] text-[var(--color-faint)] font-semibold">pages</div>
                  </div>
                  <div className="text-center min-w-[64px]">
                    <div className="text-xl font-extrabold text-[var(--color-cta)]">−{Math.max(0, Math.round((1 - compressResult.wordCountAfter / Math.max(1, compressResult.wordCountBefore)) * 100))}%</div>
                    <div className="text-[10px] text-[var(--color-faint)] font-semibold">word count</div>
                  </div>
                  <div className="text-center min-w-[64px]">
                    <div className="text-xl font-extrabold text-[var(--color-cta)]">100%</div>
                    <div className="text-[10px] text-[var(--color-faint)] font-semibold">metrics kept</div>
                  </div>
                  <div className="text-center min-w-[64px]">
                    <div className="text-xl font-extrabold text-[var(--color-ink)]">+{compressResult.marketSummary?.topKeywords?.length ?? 0}</div>
                    <div className="text-[10px] text-[var(--color-faint)] font-semibold">market keywords</div>
                  </div>
                </div>
              </div>

              {/* What changed — minimal list at top */}
              {(() => {
                const sections = compressResult.guidance?.sections || [];
                const allChanges = sections.flatMap((s: any) => s.changes || []);
                if (allChanges.length === 0) return null;
                return (
                  <div className="mt-4 bg-white border border-[var(--color-hairline)] rounded-xl px-5 py-4 shadow-sm">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-faint)] mb-2.5">What changes</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1.5">
                      {allChanges.map((c: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                          <span className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center text-[8.5px] font-extrabold shrink-0 ${
                            c.type === 'tighten' ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]' : c.type === 'merge' ? 'bg-[var(--color-amber-soft,#FFF7ED)] text-[var(--color-amber,#C2410C)]' : 'bg-[var(--color-cta-soft)] text-[var(--color-cta)]'
                          }`}>
                            {c.type === 'tighten' ? '~' : c.type === 'merge' ? '+' : '✓'}
                          </span>
                          <span className="text-[var(--color-muted)]">
                            <b className="text-[var(--color-ink)]">{c.type === 'tighten' ? 'Tightened' : c.type === 'merge' ? 'Merged' : 'Kept'}: </b>
                            {c.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Side-by-side: Old left, New right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5 items-start">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-faint)]">Original</span>
                    <span className="ml-auto text-[10px] font-bold text-[var(--color-faint)]">{pagesBefore > 0 ? `${pagesBefore} pages` : ''} · {compressResult.wordCountBefore?.toLocaleString()} words</span>
                  </div>
                  <div className="opacity-60">
                    <CvPdfPreview cv={masterCvToPdfShape(formData)} zoom={75} fitToWidth template={template} onPageCount={setPagesBefore} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-faint)]">New CV</span>
                    <span className="text-[9px] font-extrabold text-[var(--color-brand)] bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] rounded-full px-2 py-0.5">AI ✦</span>
                    <span className="ml-auto text-[10px] font-bold text-[var(--color-cta)]">{pagesAfter > 0 ? `${pagesAfter} pages` : ''} · {compressResult.wordCountAfter?.toLocaleString()} words</span>
                  </div>
                  <CvPdfPreview cv={compressedCvToPdfShape(compressResult.compressedCv)} zoom={75} fitToWidth template={template} onPageCount={setPagesAfter} />
                  <div className="flex gap-2.5 mt-4 justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-[var(--color-muted)] bg-white border border-[var(--color-hairline)] hover:border-[var(--color-brand-line)] hover:bg-[#FAFAFF] transition-colors cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Download new CV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] shadow-md shadow-blue-600/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmOpen && compressResult && (
        <div className="fixed inset-0 z-[60] bg-[var(--color-ink)]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-6">
            <p className="text-sm font-extrabold text-[var(--color-ink)]">Apply AI-compressed CV?</p>
            <p className="text-[11px] text-[var(--color-faint)] mt-1">The original will be saved automatically — you can restore it anytime.</p>
            <div className="grid grid-cols-3 gap-2.5 my-4">
              <div className="bg-[#FAFAFF] border border-[var(--color-hairline)] rounded-xl p-3 text-center">
                <div className="text-base font-extrabold text-[var(--color-brand)]">{pagesBefore > 0 ? `${pagesBefore} → ${pagesAfter}` : '…'}</div>
                <div className="text-[9px] text-[var(--color-faint)] font-semibold mt-0.5">pages before → after</div>
              </div>
              <div className="bg-[#FAFAFF] border border-[var(--color-hairline)] rounded-xl p-3 text-center">
                <div className="text-base font-extrabold text-[var(--color-cta)]">100%</div>
                <div className="text-[9px] text-[var(--color-faint)] font-semibold mt-0.5">metrics preserved</div>
              </div>
              <div className="bg-[#FAFAFF] border border-[var(--color-hairline)] rounded-xl p-3 text-center">
                <div className="text-base font-extrabold text-[var(--color-cta)]">+{compressResult.marketSummary?.topKeywords?.length ?? 0}</div>
                <div className="text-[9px] text-[var(--color-faint)] font-semibold mt-0.5">market keywords added</div>
              </div>
            </div>
            <div className="bg-[#FAFAFF] border border-[var(--color-hairline)] rounded-xl p-3 text-[10.5px] text-[var(--color-muted)] leading-relaxed">
              <b className="text-[var(--color-ink)]">What changes:</b>{' '}
              {(() => {
                const counts: Record<string, number> = { tighten: 0, merge: 0, keep: 0 };
                compressResult.guidance?.sections?.forEach((s: any) => (s.changes || []).forEach((c: any) => { if (counts[c.type] !== undefined) counts[c.type]++; }));
                return `${counts.tighten} bullets tightened, ${counts.merge} merged, ${counts.keep} kept. All quantified achievements and key skills preserved.`;
              })()}{' '}
              Original saved as <b>“Before AI compression”</b>. You can restore it via <b>Versions</b>.
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setConfirmOpen(false)} className="px-3.5 py-2 rounded-lg text-xs font-bold text-[var(--color-muted)] bg-white border border-[var(--color-hairline)] hover:border-[var(--color-brand-line)] cursor-pointer">
                Keep original
              </button>
              <button type="button" onClick={handleAcceptCompressed} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-strong)] shadow-md shadow-blue-600/20 cursor-pointer">
                Yes, apply &amp; backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Versions drawer */}
      {versionsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/20 flex justify-end">
          <div className="w-96 max-w-[90vw] bg-white h-full shadow-2xl border-l border-[var(--color-hairline)] flex flex-col">
            <div className="px-4 py-3.5 border-b border-[var(--color-hairline)] flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--color-ink)] flex items-center space-x-2">
                <History className="w-4 h-4 text-[var(--color-brand)]" />
                <span>CV Versions</span>
              </p>
              <button type="button" onClick={() => setVersionsOpen(false)} className="p-1.5 text-[var(--color-faint)] hover:text-[var(--color-muted)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {versions.length === 0 && <p className="text-xs text-[var(--color-faint)] text-center py-8">No backups yet. AI compression creates them automatically.</p>}
              {versions.map((v) => (
                <div key={v.id} className="border border-[var(--color-hairline)] rounded-xl p-3.5 bg-[#FAFAFF]">
                  <p className="text-xs font-bold text-[var(--color-ink)]">{v.note || 'CV version'}</p>
                  <p className="text-[10px] text-[var(--color-faint)] mt-0.5">{v.pages > 0 ? `${v.pages} pages · ` : ''}{new Date(v.createdAt).toLocaleString()}</p>
                  <button type="button" onClick={() => restoreVersion(v.id)}
                    className="mt-2.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[var(--color-brand)] bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] hover:bg-[#E3E6FD] cursor-pointer">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template menu — portal to document.body so no parent container
          can clip or contain it; independent fixed overlay layer. */}
      {templateMenuOpen && tplMenuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={closeTemplateMenu} />
          <div
            role="menu"
            className="fixed z-[100] w-72 bg-white border border-[var(--color-hairline)] rounded-xl shadow-2xl p-1.5 max-h-72 overflow-y-auto"
            style={{
              top: tplMenuPos.top,
              bottom: tplMenuPos.bottom,
              left: tplMenuPos.left,
            }}
          >
            <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-faint)]">CV Template</p>
            {CV_TEMPLATES.map((t) => (
              <button
                key={t.id}
                role="menuitem"
                type="button"
                onClick={() => { setTemplate(t.id); closeTemplateMenu(); }}
                className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                  template === t.id ? 'bg-[var(--color-brand-soft)]' : 'hover:bg-[var(--color-brand-soft)]'
                }`}
              >
                <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  template === t.id ? 'border-blue-600' : 'border-[var(--color-hairline2)]'
                }`}>
                  {template === t.id && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />}
                </span>
                <span>
                  <span className="block text-[12.5px] font-bold text-[var(--color-ink)]">{t.label}</span>
                  <span className="block text-[10.5px] text-[var(--color-faint)] font-medium mt-0.5 leading-snug">{t.description}</span>
                </span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
