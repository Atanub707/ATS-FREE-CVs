import React, { useState, useEffect, useRef } from 'react';
import { MasterCv } from '../types';
import { PREDEFINED_ROLES, PREDEFINED_KEYWORDS, PREDEFINED_LOCATIONS } from '../constants/suggestions';
import { CvPdfPreview, masterCvToPdfShape } from './CvPdfPreview';
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
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileDown,
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
  if (!isOpen) return null;

  const [formData, setFormData] = useState<MasterCv>(masterCv);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<50 | 75 | 100>(75);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveMasterCv({ ...formData, downloadFilename });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
    <div className="fixed inset-0 z-40 bg-white text-slate-900 flex">
      {/* LEFT: EDITOR */}
      <div className="w-[46%] min-w-[420px] border-r border-slate-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <User className="w-5 h-5 text-slate-700 ml-1" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Master Candidate CV</h2>
              <p className="text-[10.5px] text-slate-400 font-medium">Edits apply to every score &amp; tailor · autosaved on Save</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved!</span>
              </span>
            )}

            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={downloadFilename}
                onChange={(e) => setDownloadFilename(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                className="w-24 bg-white border border-slate-200 rounded px-2 py-1.5 text-[11px] text-slate-800 font-mono"
                title="Filename (without extension)"
              />
              <button
                onClick={async () => {
                  const res = await fetch('/api/cv/master/download?format=pdf');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${downloadFilename}.pdf`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                id="btn-save-master-cv"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Editor Body Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-800">
          {/* File Upload & Quick Paste Auto-Extract Banner */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-900 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4.5 h-4.5 text-blue-600" />
                <span className="font-bold text-xs text-blue-950">Upload & Scrape Resume (PDF, DOCX, TXT)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="text-xs text-blue-700 font-semibold underline hover:text-blue-900 cursor-pointer"
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
                className={`border-2 border-dashed rounded-lg p-4 bg-white hover:bg-blue-50/50 border-blue-300 hover:border-blue-500 transition-all flex flex-col items-center justify-center cursor-pointer text-center ${
                  isParsingText ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isParsingText ? (
                  <div className="flex items-center space-x-2 py-1 text-blue-700 font-bold">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>AI is reading & extracting A to Z resume details...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-1">
                    <Upload className="w-6 h-6 text-blue-600 mb-1" />
                    <span className="font-bold text-blue-900 text-xs">
                      Click to upload candidate CV (PDF, DOCX, TXT)
                    </span>
                    <span className="text-[11px] text-blue-600">
                      Gemini AI will automatically extract contact details, summary, work history, education, & skills into the fields below!
                    </span>
                  </div>
                )}
              </label>
            </div>

            {extractedFileName && (
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center justify-between text-emerald-800 text-xs font-medium">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Successfully extracted from <strong>{extractedFileName}</strong>! All fields populated below.</span>
                </div>
              </div>
            )}

            {parseError && (
              <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-200">
                {parseError}
              </p>
            )}

            {showPasteBox && (
              <div className="space-y-2 pt-2 border-t border-blue-200">
                <p className="text-[11px] text-blue-800">
                  Paste raw text from candidate's resume to parse directly:
                </p>
                <textarea
                  rows={5}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="Paste candidate's full resume text here..."
                  className="w-full bg-white border border-blue-300 rounded p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParseRawText}
                    disabled={isParsingText || !rawPasteText.trim()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
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
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-slate-600" />
              <span>Contact Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="alex@example.com"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Location</label>
                <input
                  type="text"
                  list="mastercv-locations"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State / Country or Remote"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {PREDEFINED_LOCATIONS.slice(0, 4).map((loc) => (
                    <button
                      type="button"
                      key={loc}
                      onClick={() => setFormData({ ...formData, location: loc })}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer border border-slate-200"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1 flex items-center space-x-1">
                  <Linkedin className="w-3 h-3 text-blue-600" />
                  <span>LinkedIn Profile</span>
                </label>
                <input
                  type="text"
                  value={formData.linkedin || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1 flex items-center space-x-1">
                  <Github className="w-3 h-3 text-slate-800" />
                  <span>GitHub Profile</span>
                </label>
                <input
                  type="text"
                  value={formData.github || ''}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1 flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-emerald-600" />
                  <span>Portfolio / Personal Website</span>
                </label>
                <input
                  type="text"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://portfolio.dev or https://alexjohnson.com"
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Master Professional Summary */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Master Professional Summary
              </h3>
              <button
                type="button"
                onClick={handleAskAiSummary}
                disabled={isImprovingSummary}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
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
              className="w-full bg-white border border-slate-200 rounded p-2.5 text-slate-900 leading-relaxed focus:outline-none focus:ring-1 focus:ring-slate-900"
            />

            {summaryError && (
              <p className="text-[11px] text-red-600 font-medium">{summaryError}</p>
            )}

            {summarySuggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-semibold text-indigo-700 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Suggested Summaries — click one to apply:</span>
                </p>
                {summarySuggestions.map((opt, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => applySummarySuggestion(opt.text)}
                    className="w-full text-left p-3 rounded-lg border border-indigo-200 bg-white hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer group"
                    title={`Apply "${opt.label}"`}
                  >
                    <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1 group-hover:underline">
                      {opt.label}
                    </span>
                    <span className="text-xs text-slate-700 leading-relaxed">{opt.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Work Experience History */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-600" />
                <span>Work Experience History</span>
              </h3>

              <button
                type="button"
                onClick={addExperience}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
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
                    ? 'border-indigo-400 ring-2 ring-indigo-200 opacity-70'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-700 text-[11px] flex items-center space-x-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                    <span>Position #{expIdx + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExperience(expIdx)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 text-[11px]">Job Title</label>
                    <input
                      type="text"
                      list="mastercv-roles"
                      value={exp.title}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].title = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Company</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].company = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Location</label>
                    <input
                      type="text"
                      value={exp.location || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].location = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. San Francisco, CA / Remote"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Dates / Period</label>
                    <input
                      type="text"
                      value={exp.dates || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.experiences[expIdx].dates = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. Jan 2021 - Present"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 text-[11px] mb-1 font-semibold">Responsibilities & Achievements</label>
                  <div className="space-y-1.5">
                    {exp.responsibilities.map((resp, respIdx) => (
                      <div key={respIdx} className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={resp}
                          onChange={(e) => updateExperienceResponsibility(expIdx, respIdx, e.target.value)}
                          className="flex-1 border border-slate-200 rounded px-2 py-1 text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => removeExperienceResponsibility(expIdx, respIdx)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addExperienceResponsibility(expIdx)}
                    className="mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Responsibility Bullet</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Education History */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-600" />
                <span>Education History</span>
              </h3>

              <button
                type="button"
                onClick={addEducation}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Education</span>
              </button>
            </div>

            {(formData.education || []).map((edu, eduIdx) => (
              <div key={edu.id || eduIdx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px]">Degree #{eduIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeEducation(eduIdx)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 text-[11px]">Degree / Qualification</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].degree = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Institution / University</label>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].institution = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Dates / Graduation Year</label>
                    <input
                      type="text"
                      value={edu.dates || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].dates = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Honors / Details</label>
                    <input
                      type="text"
                      value={edu.details || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        updated.education[eduIdx].details = e.target.value;
                        setFormData(updated);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Technical Skills */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Code className="w-3.5 h-3.5 text-slate-600" />
                <span>Technical Skills & Core Competencies</span>
              </h3>

              <button
                type="button"
                onClick={addSkillCategory}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Skill Category</span>
              </button>
            </div>

            <div className="space-y-2">
              {formData.skills.map((sk, skIdx) => (
                <div key={skIdx} className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-200">
                  <input
                    type="text"
                    value={sk.category}
                    onChange={(e) => {
                      const updated = { ...formData };
                      updated.skills[skIdx].category = e.target.value;
                      setFormData(updated);
                    }}
                    placeholder="Category Name"
                    className="w-1/3 border border-slate-200 rounded px-2 py-1 font-bold text-slate-900"
                  />
                  <input
                    type="text"
                    list="mastercv-keywords"
                    value={sk.items.join(', ')}
                    onChange={(e) => {
                      const updated = { ...formData };
                      updated.skills[skIdx].items = e.target.value.split(',').map((s) => s.trim());
                      setFormData(updated);
                    }}
                    placeholder="Comma separated skills (e.g. React, TypeScript, Node.js)"
                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => removeSkillCategory(skIdx)}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Projects Section */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Featured Projects & Portfolio</span>
              </h3>

              <button
                type="button"
                onClick={addProject}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
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
                    ? 'border-indigo-400 ring-2 ring-indigo-200 opacity-70'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 font-bold text-slate-700 text-[11px]">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                    <span>Project #{pIdx + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeProject(pIdx)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 text-[11px]">Project Name</label>
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
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Dates / Period</label>
                    <input
                      type="text"
                      value={proj.dates || ''}
                      onChange={(e) => {
                        const updated = { ...formData };
                        if (!updated.projects) updated.projects = [];
                        updated.projects[pIdx].dates = e.target.value;
                        setFormData(updated);
                      }}
                      placeholder="e.g. 2023 - Present"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 text-[11px]">Description & Achievements</label>
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
                      className="w-full border border-slate-200 rounded p-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Technologies Used (Comma-separated)</label>
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
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Project / Repository Link</label>
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
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Certifications & Credentials */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Award className="w-3.5 h-3.5 text-slate-600" />
                <span>Certifications, Licenses & Credentials</span>
              </h3>

              <button
                type="button"
                onClick={addCertification}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
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
                    ? 'border-indigo-400 ring-2 ring-indigo-200 opacity-70'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px] flex items-center space-x-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                    <span>Certification #{cIdx + 1}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCertification(cIdx)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 text-[11px]">Certification Title / Name</label>
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
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Issuer / Organization</label>
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
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[11px]">Date Issued / Expiration</label>
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
                      className="w-full border border-slate-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Skill Gaps Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (!showGaps) fetchSkillGaps();
                setShowGaps(!showGaps);
              }}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Skill Gaps from Market</span>
                {skillGaps.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {skillGaps.length}
                  </span>
                )}
              </div>
              {showGaps ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {showGaps && (
              <div className="px-3.5 pb-3.5 space-y-2">
                {gapsLoading ? (
                  <div className="flex items-center space-x-2 text-xs text-slate-500 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing scored jobs...</span>
                  </div>
                ) : skillGaps.length === 0 ? (
                  <div className="flex items-center space-x-2 text-xs text-slate-500 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>No scored jobs yet. Run match analysis on jobs first.</span>
                  </div>
                ) : (
                  <>
                    {gapsAddedMsg && (
                      <div className="px-2 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                        {gapsAddedMsg}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500">
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
                            className="rounded border-slate-300 cursor-pointer"
                          />
                          <span className="flex-1 font-medium text-slate-800">{gap.skill}</span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {gap.count}/{gap.totalScored} jobs
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedGaps.size > 0 && (
                      <button
                        type="button"
                        onClick={addSelectedGapsToCv}
                        className="w-full px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
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
      <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-sm shrink-0">
          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live PDF Preview — exactly what downloads</span>
          </span>
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5">
            {([50, 75, 100] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setPreviewZoom(z)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  previewZoom === z ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {z}%
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <CvPdfPreview cv={masterCvToPdfShape(formData)} zoom={previewZoom} />
        </div>
      </div>
    </div>
  );
};
