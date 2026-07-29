export type JobState = 'pending' | 'matched' | 'tailored' | 'ready';
export type JobSource = 'LinkedIn' | 'Glassdoor' | 'Arbeitnow' | 'SimplyHired' | 'Dice' | 'Reed' | 'Greenhouse' | 'Lever' | 'RemoteOK' | 'WeWorkRemotely' | 'Custom';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  source: JobSource;
  description: string;
  url: string;
  postedDate: string; // ISO string or relative like "2 days ago"
  postedDateParsed?: string; // YYYY-MM-DD
  salaryMin?: number;
  salaryMax?: number;
  salaryText?: string;
  jobType?: string; // Full-time, Remote, Contract, etc.
  state: JobState;
  
  // AI Matching output
  matchScore?: number; // 0 - 100
  gapAnalysis?: GapAnalysis;
  matchedAt?: string;

  // AI Tailoring output
  tailoredCv?: TailoredCv;
  tailoredAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface GapAnalysis {
  matchScore: number; // 0 - 100
  matchingSkills: string[];
  missingSkills: string[];
  salaryFit: 'below' | 'matched' | 'above' | 'unknown';
  experienceFit: 'entry' | 'mid' | 'senior' | 'overqualified' | 'ideal';
  keyRecommendations: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryAnalysis: string;
  yearsOfExperience?: number;
  yearsRequired?: number;
  booleanSearchResult?: 'pass' | 'borderline' | 'fail';
}

export interface TailoringAudit {
  beforeScore: number;
  afterScore: number;
  scoreBoost: number;
  scoreBreakdown: {
    alreadyMatched: number;
    newlyIntegrated: number;
    remainingGap: number;
  };
  missingBefore: {
    skills: string[];
    keywords: string[];
  };
  addedAfter: {
    keywordsIncorporated: string[];
    rephrasedHighlightsCount: number;
    skillsAdded: string[];
  };
  notIntegrable?: string[];
  auditNotes: string[];
}

export interface TailoredCv {
  candidateName: string;
  contactInfo: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  professionalSummary: string;
  targetRole: string;
  coreCompetencies: string[];
  workExperience: {
    title: string;
    company: string;
    location?: string;
    dates: string;
    highlights: string[]; // Tailored ATS bullet points emphasizing matching keywords
  }[];
  education: {
    degree: string;
    institution: string;
    dates: string;
    details?: string;
  }[];
  technicalSkills: {
    category: string;
    skills: string[];
  }[];
  projects?: ProjectItem[];
  certifications?: (CertificationItem | string)[];
  rephraseHighlightsCount?: number;
  keywordsIncorporated?: string[];
  audit?: TailoringAudit;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  technologies?: string[];
  link?: string;
  dates?: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  link?: string;
}

export interface MasterCv {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary: string;
  experiences: {
    id: string;
    title: string;
    company: string;
    location: string;
    dates: string;
    responsibilities: string[];
  }[];
  education: {
    id: string;
    degree: string;
    institution: string;
    dates: string;
    details?: string;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
  projects?: ProjectItem[];
  certifications?: CertificationItem[];
  rawText?: string;
  downloadFilename?: string;
}

export type ExperienceLevel = 'all' | 'entry' | 'mid' | 'senior' | 'lead';

export interface ScraperParams {
  keywords: string;
  location?: string;
  sources?: JobSource[];
  datePostedFilter?: 'all' | '24h' | '7d' | '30d';
  minSalary?: number;
  maxJobsPerSource?: number;
  jobTitle?: string;
  experienceLevel?: ExperienceLevel;
  adzunaAppId?: string;
  adzunaApiKey?: string;
  indeedPublisherId?: string;
}

export type LlmProvider = 'opencode-go' | 'openrouter' | 'openai' | 'gemini' | 'anthropic' | 'nvidia';

export interface AppConfig {
  thresholds: {
    minMatchForTailor: number; // default 40
    earlyBlockThreshold: number; // default 30
  };
  llm: {
    provider: LlmProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
  };
  storage: {
    mode: 'sqlite' | 'json';
    sqliteDbPath: string;
    jsonDbPath: string;
  };
  scraper: {
    stealthMode: boolean;
    maxRetries: number;
    adzunaAppId: string;
    adzunaApiKey: string;
    indeedPublisherId: string;
  };
}

export interface JobFilterQueryParams {
  state?: 'all' | JobState;
  source?: 'all' | JobSource;
  search?: string;
  minScore?: number;
  maxScore?: number;
  sortBy?: 'postedDate' | 'matchScore' | 'createdAt' | 'company' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
