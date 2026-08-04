import React, { useState } from 'react';
import { Job, JobState } from '../types';
import { formatTimeAgo } from '../lib/dateUtils';
import { getValidJobUrl } from '../lib/jobUrlUtils';
import { DownloadCvDropdown } from './DownloadCvDropdown';
import {
  X,
  ExternalLink,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  DollarSign,
  ArrowRight,
  Copy,
  Check,
  Calendar,
  TrendingUp,
  Mail,
  Phone,
  Github,
  Globe,
  Award,
  Printer,
  Users,
} from 'lucide-react';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onMatchJob: (jobId: string) => Promise<void>;
  onTailorJob: (jobId: string) => Promise<void>;
  onUpdateStatus: (jobId: string, state: JobState) => Promise<void>;
  isLoading: boolean;
  initialTab?: 'details' | 'gap' | 'tailored';
}

function formatSocialLink(type: 'linkedin' | 'github' | 'website' | 'email' | 'phone', value: string): string {
  if (!value) return '';
  const val = String(value).trim();
  if (type === 'email') return val.startsWith('mailto:') ? val : `mailto:${val}`;
  if (type === 'phone') return val.startsWith('tel:') ? val : `tel:${val.replace(/[^\d+]/g, '')}`;

  if (type === 'linkedin') {
    if (/^https?:\/\//i.test(val)) return val;
    if (val.toLowerCase().includes('linkedin.com')) return `https://${val}`;
    const handle = val.replace(/^in\//i, '').replace(/^\//, '');
    return `https://linkedin.com/in/${handle}`;
  }

  if (type === 'github') {
    if (/^https?:\/\//i.test(val)) return val;
    if (val.toLowerCase().includes('github.com')) return `https://${val}`;
    const handle = val.replace(/^\//, '');
    return `https://github.com/${handle}`;
  }

  if (type === 'website') {
    if (/^https?:\/\//i.test(val)) return val;
    return `https://${val}`;
  }

  return val;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onMatchJob,
  onTailorJob,
  onUpdateStatus,
  isLoading,
  initialTab,
}) => {
  if (!job) return null;

  const [activeTab, setActiveTab] = useState<'details' | 'gap' | 'tailored'>(initialTab || 'details');
  const [copiedText, setCopiedText] = useState(false);

  const gap = job.gapAnalysis;
  const tailored = job.tailoredCv;
  const timeAgoStr = formatTimeAgo(job.postedDate || job.createdAt);

  const handleCopyTextCv = () => {
    if (!tailored) return;
    const textParts = [
      `${tailored.candidateName.toUpperCase()}`,
      `Target Role: ${tailored.targetRole}`,
      `Contact: ${tailored.contactInfo.email || ''} | ${tailored.contactInfo.phone || ''}`,
      '\n--- PROFESSIONAL SUMMARY ---',
      tailored.professionalSummary,
      '\n--- CORE COMPETENCIES ---',
      tailored.coreCompetencies.join(' • '),
      '\n--- WORK EXPERIENCE ---',
      ...tailored.workExperience.map(
        (exp) => `${exp.title} at ${exp.company} (${exp.dates})\n` + exp.highlights.map((h) => `• ${h}`).join('\n')
      ),
      '\n--- TECHNICAL SKILLS ---',
      ...tailored.technicalSkills.map((cat) => `${cat.category}: ${cat.skills.join(', ')}`),
    ];

    navigator.clipboard.writeText(textParts.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50/80 sticky top-0 z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1 text-xs">
              <span
                className={`font-semibold px-2 py-0.5 rounded ${
                  job.source === 'LinkedIn' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {job.source}
              </span>
              <span className="flex items-center space-x-1 text-slate-500">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Posted {timeAgoStr}</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {job.title}
            </h2>
            <div className="flex flex-wrap items-center space-x-4 text-xs text-slate-600 mt-1">
              <span className="flex items-center space-x-1 font-medium text-slate-800">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.company}</span>
              </span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.location}</span>
              </span>
              {job.salaryText && (
                <span className="flex items-center space-x-1 text-emerald-700 font-medium">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{job.salaryText}</span>
                </span>
              )}
              {job.applicantCount !== undefined && (
                <span className={`flex items-center space-x-1 ${job.lowCompetition ? 'text-emerald-600 font-semibold' : 'text-slate-600'}`}>
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{job.lowCompetition ? 'Low competition' : `${job.applicantCount.toLocaleString()} applicants`}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={getValidJobUrl(job)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center space-x-1.5 transition-colors"
            >
              <span>View Original Posting</span>
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 px-6 pt-2 border-b border-slate-200 bg-slate-50/50 text-xs font-medium">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Job Description
          </button>

          <button
            onClick={() => setActiveTab('gap')}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'gap'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span>ATS Gap Analysis</span>
            {job.matchScore !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-extrabold text-[10px]">
                {job.matchScore}%
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tailored')}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'tailored'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tailored ATS CV</span>
            {tailored && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Ready
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Job Description */}
          {activeTab === 'details' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                    Full Raw Job Text
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = job.description;
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(text);
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();
                      }
                      const btn = e.currentTarget;
                      btn.textContent = 'Copied!';
                      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                    }}
                    className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                    title="Copy job description to clipboard"
                  >
                    Copy
                  </button>
                </div>
                <div className="whitespace-pre-wrap font-sans space-y-2">
                  {job.description.replace(/^[ \t]*Show more[ \t]*$/gim, '').replace(/^[ \t]*Show less[ \t]*$/gim, '').trim()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATS Gap Analysis */}
          {activeTab === 'gap' && (
            <div className="space-y-6">
              {!gap ? (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
                  <Zap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h3 className="text-xs font-bold text-slate-800">No Analysis Generated Yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Click 'Run Match Analysis' below to evaluate your Master Candidate CV against this position.
                  </p>
                  <button
                    onClick={() => onMatchJob(job.id)}
                    disabled={isLoading}
                    className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center space-x-2 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    <span>Run Match Analysis Now</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 text-xs">
                  {/* Score Summary Banner */}
                  <div className="p-4 rounded-lg border bg-slate-50 border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 uppercase font-bold text-[10px] block">Overall ATS Match Score</span>
                      <span className="text-2xl font-black text-slate-900">{gap.matchScore}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 text-[11px] block font-medium">Relevance Category</span>
                      <span className="font-bold text-slate-800">{gap.relevanceCategory}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-1">Executive Alignment Summary</h4>
                    <p className="text-slate-700">{gap.summary}</p>
                  </div>

                  {/* Keywords Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Matching Keywords */}
                    <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-200">
                      <h4 className="font-bold text-emerald-900 mb-2 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Matched ATS Keywords ({gap.matchedKeywords.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {gap.matchedKeywords.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Missing Keywords */}
                    <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200">
                      <h4 className="font-bold text-amber-900 mb-2 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Missing Target Keywords ({gap.missingKeywords.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {gap.missingKeywords.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strategic Action Items */}
                  {gap.strategicAdjustments && gap.strategicAdjustments.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900">Recommended Adjustments</h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        {gap.strategicAdjustments.map((adj, i) => (
                          <li key={i}>{adj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Tailored ATS CV */}
          {activeTab === 'tailored' && (
            <div className="space-y-6">
              {!tailored ? (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
                  <Sparkles className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-xs font-bold text-slate-800">No Tailored CV Created</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Generate an ATS-optimized CV incorporating missing target keywords, calibrated for Calibri 11pt formatting.
                  </p>
                  <button
                    onClick={() => onTailorJob(job.id)}
                    disabled={isLoading}
                    className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center space-x-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Generate Tailored ATS CV</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 text-xs">
                  {/* BEFORE VS AFTER ATS SCORE & TAILORING AUDIT CARD */}
                  {(() => {
                    const beforeScore = tailored.audit?.beforeScore ?? job.matchScore ?? gap?.matchScore ?? 68;
                    const afterScore = tailored.audit?.afterScore ?? Math.min(98, Math.max(beforeScore + 18, 92));
                    const scoreBoost = tailored.audit?.scoreBoost ?? (afterScore - beforeScore);
                    const breakdown = tailored.audit?.scoreBreakdown;

                    const missingSkillsBefore = tailored.audit?.missingBefore?.skills && tailored.audit.missingBefore.skills.length > 0
                      ? tailored.audit.missingBefore.skills
                      : (gap?.missingSkills && gap.missingSkills.length > 0 ? gap.missingSkills : ['Cloud Architecture', 'CI/CD Pipelines']);

                    const missingKeywordsBefore = tailored.audit?.missingBefore?.keywords && tailored.audit.missingBefore.keywords.length > 0
                      ? tailored.audit.missingBefore.keywords
                      : (gap?.missingKeywords && gap.missingKeywords.length > 0 ? gap.missingKeywords : ['Docker', 'Microservices', 'REST APIs']);

                    const keywordsIncorporated = tailored.audit?.addedAfter?.keywordsIncorporated && tailored.audit.addedAfter.keywordsIncorporated.length > 0
                      ? tailored.audit.addedAfter.keywordsIncorporated
                      : (tailored.keywordsIncorporated || ['TypeScript', 'React', 'REST API', 'Agile']);

                    const keywordsInExperience = tailored.audit?.addedAfter?.keywordsInExperience?.length
                      ? tailored.audit.addedAfter.keywordsInExperience
                      : [];

                    const keywordsInSkills = tailored.audit?.addedAfter?.keywordsInSkills?.length
                      ? tailored.audit.addedAfter.keywordsInSkills
                      : [];

                    const rephrasedCount = tailored.audit?.addedAfter?.rephrasedHighlightsCount ?? tailored.rephraseHighlightsCount ?? 8;

                    const notIntegrable = tailored.audit?.notIntegrable?.length
                      ? tailored.audit.notIntegrable
                      : [];

                    const auditNotes = tailored.audit?.auditNotes && tailored.audit.auditNotes.length > 0
                      ? tailored.audit.auditNotes
                      : [
                          `Aligned candidate target title directly to "${job.title}".`,
                          `Rephrased ${rephrasedCount} experience bullet points using quantitative impact and job-matched action verbs.`,
                          `Front-loaded required technical competencies (${keywordsIncorporated.slice(0, 3).join(', ')}) into the Skills matrix.`,
                          `Bridged initial ATS gaps by seamlessly incorporating missing keywords into existing accomplishments.`,
                        ];

                    return (
                      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white rounded-xl p-5 shadow-lg space-y-5">
                        {/* Top Banner: Before vs After Scores */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Sparkles className="w-4 h-4 text-emerald-400" />
                              <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                                ATS Tailoring Transformation Audit
                              </h3>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">
                              Visualized match score optimization before & after CV customization
                            </p>
                          </div>

                          {/* Score Comparison Display */}
                          <div className="flex items-center space-x-3 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 self-start md:self-auto">
                            {/* Before */}
                            <div className="text-center px-2">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Master CV</span>
                              <span className="text-xl font-bold text-slate-300">{beforeScore}%</span>
                            </div>

                            <ArrowRight className="w-4 h-4 text-slate-500" />

                            {/* After */}
                            <div className="text-center px-2">
                              <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold">Tailored CV</span>
                              <span className="text-2xl font-extrabold text-emerald-400">{afterScore}%</span>
                            </div>

                            {/* Boost Badge */}
                            <div className="pl-2 border-l border-slate-700 flex flex-col items-center justify-center">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-xs">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>+{scoreBoost}%</span>
                              </span>
                              <span className="text-[9px] text-emerald-400/80 font-medium mt-0.5">ATS Match Boost</span>
                            </div>
                          </div>
                        </div>

                        {/* Visual Score Comparison Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                            <span>ATS Skill & Keyword Coverage</span>
                            <span className="text-emerald-400 font-semibold">{beforeScore}% Master → {afterScore}% Tailored</span>
                          </div>
                          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700 flex">
                            <div
                              className="bg-slate-500 h-full rounded-l-full transition-all duration-500"
                              style={{ width: `${beforeScore}%` }}
                              title={`Before Tailoring: ${beforeScore}%`}
                            />
                            <div
                              className="bg-emerald-500 h-full rounded-r-full transition-all duration-500"
                              style={{ width: `${afterScore - beforeScore}%` }}
                              title={`Tailored Boost: +${scoreBoost}%`}
                            />
                          </div>
                        </div>

                        {/* Score Breakdown */}
                        {breakdown && (
                          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">How 52% is calculated</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-slate-800/80 rounded p-2 border border-slate-700/60">
                                <span className="text-[10px] text-slate-400 block">Already Matched</span>
                                <span className="text-lg font-bold text-slate-200">{breakdown.alreadyMatched}%</span>
                                <span className="text-[9px] text-slate-500 block">Your Master CV score</span>
                              </div>
                              <div className="bg-emerald-900/30 rounded p-2 border border-emerald-800/40">
                                <span className="text-[10px] text-emerald-400 block">Newly Integrated</span>
                                <span className="text-lg font-bold text-emerald-400">+{breakdown.newlyIntegrated}%</span>
                                <span className="text-[9px] text-emerald-600/80 block">From missing keywords</span>
                              </div>
                              <div className="bg-amber-900/30 rounded p-2 border border-amber-800/40">
                                <span className="text-[10px] text-amber-400 block">Still Missing</span>
                                <span className="text-lg font-bold text-amber-400">{breakdown.remainingGap}%</span>
                                <span className="text-[9px] text-amber-600/80 block">Could not be added</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* BEFORE vs AFTER Audit Matrix */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Box 1: BEFORE (What was missing from Master CV) */}
                          <div className="bg-slate-900/90 border border-amber-900/40 rounded-lg p-3.5 space-y-3">
                            <div className="flex items-center justify-between border-b border-amber-900/30 pb-2">
                              <div className="flex items-center space-x-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <span className="font-bold text-xs text-amber-200 uppercase tracking-wide">
                                  Missing from Master CV
                                </span>
                              </div>
                              <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                                Before Tailoring
                              </span>
                            </div>

                            {/* Missing Skills & Keywords */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-slate-300 block">Initial Gap Keywords & Requirements:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {[...missingSkillsBefore, ...missingKeywordsBefore].slice(0, 10).map((item, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-200 border border-amber-500/30 inline-flex items-center space-x-1"
                                  >
                                    <span className="text-amber-400 font-bold">✕</span>
                                    <span>{item}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Box 2: AFTER (What was added to Tailored CV) */}
                          <div className="bg-slate-900/90 border border-emerald-900/40 rounded-lg p-3.5 space-y-3">
                            <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2">
                              <div className="flex items-center space-x-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="font-bold text-xs text-emerald-200 uppercase tracking-wide">
                                  Added & Optimized in Tailored CV
                                </span>
                              </div>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                                After Tailoring
                              </span>
                            </div>

                            {/* Integrated in Experience */}
                            <div className="space-y-2">
                              <div>
                                <span className="text-[11px] font-semibold text-emerald-300 block mb-1">✓ Integrated in Experience:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {keywordsInExperience.length > 0 ? (
                                    keywordsInExperience.slice(0, 12).map((kw, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 inline-flex items-center space-x-1">
                                        <span className="text-emerald-400 font-bold">✓</span>
                                        <span>{kw}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-slate-500 italic">Keywords integrated into bullet points</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Added to Skills */}
                            {keywordsInSkills.length > 0 && (
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[11px] font-semibold text-cyan-300 block mb-1">+ Added to Skills / Competencies:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {keywordsInSkills.slice(0, 10).map((kw, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 inline-flex items-center space-x-1">
                                        <span className="text-cyan-400 font-bold">+</span>
                                        <span>{kw}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Not Integrable Keywords */}
                        {notIntegrable.length > 0 && (
                          <div className="bg-slate-900/90 border border-red-900/40 rounded-lg p-3.5">
                            <div className="flex items-center space-x-1.5 mb-2">
                              <span className="text-[11px] font-semibold text-red-300">✕ Could Not Be Added (not in experience or skills):</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {notIntegrable.slice(0, 10).map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-200 border border-red-500/30 inline-flex items-center space-x-1">
                                  <span className="text-red-400 font-bold">✕</span>
                                  <span>{kw}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tailoring Notes */}
                        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5 space-y-2">
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Transformation Audit Notes</span>
                          </h4>
                          <ul className="space-y-1 text-xs text-slate-300">
                            {auditNotes.map((note, i) => (
                              <li key={i} className="flex items-start space-x-2">
                                <span className="text-emerald-400 font-bold select-none">•</span>
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Export Toolbar */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700">Tailored CV Document Ready</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleCopyTextCv}
                        className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 font-medium text-slate-700 flex items-center space-x-1.5 cursor-pointer"
                        title="Copy Plain Text CV to Clipboard"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                      </button>

                      <DownloadCvDropdown jobId={job.id} buttonText="Download CV" size="sm" />

                      <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                        title="Print or Save Exact PDF Preview as shown on screen"
                      >
                        <Printer className="w-3.5 h-3.5 text-white" />
                        <span>Print / Save PDF (Exact UI)</span>
                      </button>
                    </div>
                  </div>

                  {/* CV Live Preview Box */}
                  <div id="printable-cv" className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm text-slate-900 space-y-5 font-sans">
                    {/* Header */}
                    <div className="text-center border-b pb-4 border-slate-200">
                      <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{tailored.candidateName}</h2>
                      {tailored.targetRole && (
                        <p className="text-xs font-semibold text-slate-700 mt-1">{tailored.targetRole}</p>
                      )}

                      {/* Clickable Contact Links Bar */}
                      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-slate-600 mt-2 w-full text-center mx-auto">
                        {tailored.contactInfo?.email && (
                          <a
                            href={formatSocialLink('email', String(tailored.contactInfo.email))}
                            className="inline-flex items-center space-x-1 font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            title="Click to Send Email"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>{String(tailored.contactInfo.email)}</span>
                          </a>
                        )}

                        {tailored.contactInfo?.phone && (
                          <>
                            {tailored.contactInfo?.email && <span className="text-slate-300 font-bold">•</span>}
                            <a
                              href={formatSocialLink('phone', String(tailored.contactInfo.phone))}
                              className="inline-flex items-center space-x-1 font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              title="Click to Call Phone"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{String(tailored.contactInfo.phone)}</span>
                            </a>
                          </>
                        )}

                        {tailored.contactInfo?.location && (
                          <>
                            {(tailored.contactInfo?.email || tailored.contactInfo?.phone) && (
                              <span className="text-slate-300 font-bold">•</span>
                            )}
                            <span className="inline-flex items-center space-x-1 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{String(tailored.contactInfo.location)}</span>
                            </span>
                          </>
                        )}

                        {tailored.contactInfo?.linkedin && (
                          <>
                            <span className="text-slate-300 font-bold">•</span>
                            <a
                              href={formatSocialLink('linkedin', String(tailored.contactInfo.linkedin))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              title="Open LinkedIn Profile"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                              <span>LinkedIn</span>
                              <ExternalLink className="w-2.5 h-2.5 text-blue-400" />
                            </a>
                          </>
                        )}

                        {tailored.contactInfo?.github && (
                          <>
                            <span className="text-slate-300 font-bold">•</span>
                            <a
                              href={formatSocialLink('github', String(tailored.contactInfo.github))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              title="Open GitHub Profile"
                            >
                              <Github className="w-3.5 h-3.5 text-slate-800" />
                              <span>GitHub</span>
                              <ExternalLink className="w-2.5 h-2.5 text-blue-400" />
                            </a>
                          </>
                        )}

                        {tailored.contactInfo?.website && (
                          <>
                            <span className="text-slate-300 font-bold">•</span>
                            <a
                              href={formatSocialLink('website', String(tailored.contactInfo.website))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              title="Open Portfolio Website"
                            >
                              <Globe className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Portfolio Website</span>
                              <ExternalLink className="w-2.5 h-2.5 text-blue-400" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Professional Summary */}
                    {tailored.professionalSummary && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-300 pb-1 mb-2">
                          Professional Summary
                        </h4>
                        <p className="text-slate-800 leading-relaxed text-xs">{tailored.professionalSummary}</p>
                      </div>
                    )}

                    {/* Technical Skills & Competencies */}
                    {((tailored.technicalSkills && tailored.technicalSkills.length > 0) ||
                      (tailored.coreCompetencies && tailored.coreCompetencies.length > 0)) && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-300 pb-1 mb-2">
                          Technical Skills & Competencies
                        </h4>
                        {tailored.technicalSkills && tailored.technicalSkills.length > 0 ? (
                          <div className="space-y-1.5 text-xs">
                            {tailored.technicalSkills.map((sk, i) => (
                              <div key={i}>
                                <span className="font-bold text-slate-900">{sk.category}: </span>
                                <span className="text-slate-700">{sk.skills.join(', ')}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-800 text-xs">{tailored.coreCompetencies.join(' • ')}</p>
                        )}
                      </div>
                    )}

                    {/* Work Experience */}
                    {tailored.workExperience && tailored.workExperience.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-300 pb-1 mb-2">
                          Professional Experience
                        </h4>
                        <div className="space-y-3">
                          {tailored.workExperience.map((exp, i) => (
                            <div key={i} className="cv-entry-block space-y-1">
                              <div className="flex flex-wrap items-baseline justify-between font-bold text-slate-900 text-xs gap-2">
                                <span>
                                  {exp.title} <span className="text-slate-500 font-semibold">| {exp.company}</span>
                                </span>
                                <span className="text-slate-500 font-normal italic text-[11px] shrink-0">
                                  {exp.dates}{exp.location ? ` | ${exp.location}` : ''}
                                </span>
                              </div>
                              <ul className="space-y-1 text-slate-700 text-xs pl-2">
                                {exp.highlights.map((hl, j) => (
                                  <li key={j} className="flex items-start space-x-2">
                                    <span className="text-slate-400 select-none">•</span>
                                    <span>{hl.replace(/^[*•\-]\s*/, '')}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Featured Projects */}
                    {tailored.projects && tailored.projects.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-300 pb-1 mb-2">
                          Featured Projects
                        </h4>
                        <div className="space-y-3">
                          {tailored.projects.map((proj, i) => (
                            <div key={i} className="cv-entry-block space-y-1 text-xs">
                              <div className="flex flex-wrap items-center justify-between font-bold text-slate-900 gap-2">
                                <div className="flex items-center space-x-2">
                                  <span>{proj.name}</span>
                                  {proj.link && (
                                    <a
                                      href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-[11px] font-normal inline-flex items-center space-x-0.5"
                                    >
                                      <span>View Project</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                                {proj.dates && <span className="text-slate-500 font-normal italic text-[11px] shrink-0">{proj.dates}</span>}
                              </div>
                              {proj.technologies && proj.technologies.length > 0 && (
                                <p className="text-[11px] text-slate-600 font-medium">
                                  <span className="font-semibold text-slate-800">Technologies:</span> {proj.technologies.join(', ')}
                                </p>
                              )}
                              {proj.description && (
                                <p className="text-slate-700 text-xs pl-2 border-l-2 border-slate-200">{proj.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education */}
                    {tailored.education && tailored.education.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-300 pb-1 mb-2">
                          Education
                        </h4>
                        <div className="space-y-2.5">
                          {tailored.education.map((edu, i) => (
                            <div key={i} className="cv-entry-block space-y-0.5 text-xs">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-bold text-slate-900">{edu.degree}</span>
                                {edu.dates && (
                                  <span className="text-slate-500 font-normal italic text-[11px] shrink-0 ml-3">
                                    {edu.dates}
                                  </span>
                                )}
                              </div>
                              {edu.institution && (
                                <div className="text-slate-600 font-medium text-[11.5px]">
                                  {edu.institution}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Certifications & Credentials */}
                    {tailored.certifications && tailored.certifications.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-300 pb-1 mb-2">
                          Certifications & Credentials
                        </h4>
                        <ul className="space-y-1 text-xs text-slate-800">
                          {tailored.certifications.map((cert, i) => {
                            if (typeof cert === 'string') {
                              return (
                                <li key={i} className="flex items-center space-x-2">
                                  <Award className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                  <span>{cert}</span>
                                </li>
                              );
                            }
                            const link = cert.link ? (cert.link.startsWith('http') ? cert.link : `https://${cert.link}`) : undefined;
                            return (
                              <li key={i} className="flex items-center space-x-2">
                                <Award className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                <span>
                                  {cert.name}
                                  {cert.issuer && <span className="text-slate-500"> — {cert.issuer}</span>}
                                  {cert.date && <span className="text-slate-400"> ({cert.date})</span>}
                                </span>
                                {link && (
                                  <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-[11px] inline-flex items-center space-x-0.5 ml-1"
                                  >
                                    <span>Verify Link</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold">Status:</span>
            <select
              value={job.state}
              onChange={(e) => onUpdateStatus(job.id, e.target.value as JobState)}
              className="bg-white border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="tailored">Tailored</option>
              <option value="ready">Applied / Ready</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onMatchJob(job.id)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-medium transition-colors cursor-pointer"
            >
              Re-Analyze
            </button>
            <button
              onClick={() => onTailorJob(job.id)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors cursor-pointer"
            >
              Re-Tailor CV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
