import React, { useState, useEffect, useRef } from 'react';
import { MasterCv } from '../types';
import { PREDEFINED_ROLES, PREDEFINED_KEYWORDS, PREDEFINED_LOCATIONS } from '../constants/suggestions';
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
  Download,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileDown,
} from 'lucide-react';

interface MasterCvDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  masterCv: MasterCv;
  onSaveMasterCv: (updated: MasterCv) => Promise<void>;
}

export const MasterCvDrawer: React.FC<MasterCvDrawerProps> = ({
  isOpen,
  onClose,
  masterCv,
  onSaveMasterCv,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<MasterCv>(masterCv);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [rawPasteText, setRawPasteText] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skillGaps, setSkillGaps] = useState<{ skill: string; count: number; totalScored: number }[]>([]);
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());
  const [showGaps, setShowGaps] = useState(false);
  const [gapsLoading, setGapsLoading] = useState(false);

  useEffect(() => {
    setFormData(masterCv);
  }, [masterCv]);

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

  const toggleGap = (skill: string) => {
    setSelectedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const addSelectedGapsToCv = () => {
    if (selectedGaps.size === 0) return;
    const updated = { ...formData };
    const newSkills: string[] = Array.from(selectedGaps);
    const skillsCat = updated.skills.find((s) => s.category.toLowerCase().includes('skill') || s.category === 'Core Competencies');
    if (skillsCat) {
      for (const s of newSkills) {
        const normalized = s.charAt(0).toUpperCase() + s.slice(1);
        if (!skillsCat.items.some((i) => i.toLowerCase() === normalized.toLowerCase())) {
          skillsCat.items.push(normalized);
        }
      }
    } else {
      updated.skills.push({ category: 'Core Competencies', items: newSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1)) });
    }
    setFormData(updated);
    setSelectedGaps(new Set());
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
    await onSaveMasterCv(formData);
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
    updated.experiences.push({
      id: `exp-${Date.now()}`,
      title: 'Job Title',
      company: 'Company Name',
      location: 'Remote / City, State',
      dates: '2022 - Present',
      responsibilities: ['Key responsibility or major accomplishment...'],
    });
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
    updated.education.push({
      id: `edu-${Date.now()}`,
      degree: 'B.S. Computer Science',
      institution: 'University Name',
      dates: '2018 - 2022',
      details: 'Major in Software Engineering',
    });
    setFormData(updated);
  };

  const removeEducation = (eduIdx: number) => {
    const updated = { ...formData };
    updated.education.splice(eduIdx, 1);
    setFormData(updated);
  };

  const addSkillCategory = () => {
    const updated = { ...formData };
    updated.skills.push({
      category: 'New Category',
      items: ['Skill 1', 'Skill 2'],
    });
    setFormData(updated);
  };

  const removeSkillCategory = (skIdx: number) => {
    const updated = { ...formData };
    updated.skills.splice(skIdx, 1);
    setFormData(updated);
  };

  const addProject = () => {
    const updated = { ...formData };
    if (!updated.projects) updated.projects = [];
    updated.projects.push({
      id: `proj-${Date.now()}`,
      name: 'Project Name',
      description: 'Key project description, highlights, and results...',
      technologies: ['React', 'Node.js', 'TypeScript'],
      link: '',
      dates: '2023',
    });
    setFormData(updated);
  };

  const removeProject = (pIdx: number) => {
    const updated = { ...formData };
    if (updated.projects) {
      updated.projects.splice(pIdx, 1);
      setFormData(updated);
    }
  };

  const addCertification = () => {
    const updated = { ...formData };
    if (!updated.certifications) updated.certifications = [];
    updated.certifications.push({
      id: `cert-${Date.now()}`,
      name: 'AWS Certified Solutions Architect',
      issuer: 'Amazon Web Services',
      date: '2023',
      link: '',
    });
    setFormData(updated);
  };

  const removeCertification = (cIdx: number) => {
    const updated = { ...formData };
    if (updated.certifications) {
      updated.certifications.splice(cIdx, 1);
      setFormData(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white border-l border-slate-200 w-full max-w-3xl h-full flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Master Candidate Profile & CV</h2>
          </div>

          <div className="flex items-center space-x-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved!</span>
              </span>
            )}

            <div className="flex items-center space-x-1.5">
              <a
                href="/api/cv/master/download?format=docx"
                className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                title="Download Master CV as DOCX"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                onClick={handleSave}
                disabled={isSaving}
                id="btn-save-master-cv"
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>

            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-800">
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
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Master Professional Summary
            </h3>
            <textarea
              rows={4}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Candidate's comprehensive professional background summary..."
              className="w-full bg-white border border-slate-200 rounded p-2.5 text-slate-900 leading-relaxed focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
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
              <div key={exp.id || expIdx} className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-700 text-[11px]">Position #{expIdx + 1}</span>
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
              <div key={proj.id || pIdx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px]">Project #{pIdx + 1}</span>
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
              <div key={cert.id || cIdx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px]">Certification #{cIdx + 1}</span>
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
    </div>
  );
};
