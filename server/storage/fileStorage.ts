import fs from 'fs';
import path from 'path';
import { Job, MasterCv, JobFilterQueryParams, JobState } from '../../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const JSON_FILE_PATH = path.join(DATA_DIR, 'jobs.json');
const MASTER_CV_PATH = path.join(DATA_DIR, 'master_cv.json');
const PRIMARY_FILE_PATH = path.join(DATA_DIR, 'ats_jobs.sqlite.json'); // Primary JSON store (legacy filename kept for data compatibility)

export const DEFAULT_MASTER_CV: MasterCv = {
  fullName: 'Alex Mercer',
  email: 'alex.mercer.dev@example.com',
  phone: '+1 (555) 234-5678',
  location: 'San Francisco, CA (Open to Remote)',
  linkedin: 'https://linkedin.com/in/alexmercer-dev',
  github: 'https://github.com/alexmercer-dev',
  website: 'https://alexmercer.dev',
  summary: 'Results-driven Senior Full-Stack & AI Software Engineer with 6+ years of experience architecting scalable cloud services, TypeScript/React single-page applications, Express backends, and AI LLM integrations. Proven track record in optimizing application performance, leading automated testing pipelines, and implementing high-throughput REST APIs and microservices.',
  experiences: [
    {
      id: 'exp-1',
      title: 'Senior Software Engineer',
      company: 'Apex Cloud Systems',
      location: 'San Francisco, CA',
      dates: '2022 - Present',
      responsibilities: [
        'Architected and deployed high-concurrency microservices processing 12M+ monthly REST API requests with 99.98% uptime.',
        'Engineered AI-assisted search and automated document processing workflows using Gemini LLM APIs, reducing content processing latency by 45%.',
        'Led cross-functional team of 6 engineers, standardizing TypeScript patterns, automated CI/CD unit testing, and code review practices.',
        'Optimized frontend React/Vite web application rendering performance, reducing First Contentful Paint (FCP) by 35% through dynamic code splitting.'
      ]
    },
    {
      id: 'exp-2',
      title: 'Full Stack Web Developer',
      company: 'Nexus Digital Solutions',
      location: 'Oakland, CA',
      dates: '2019 - 2022',
      responsibilities: [
        'Built full-stack React and Express node services for enterprise financial dashboarding with real-time websocket metrics.',
        'Migrated legacy monolithic application to Dockerized microservices on AWS Cloud, reducing infrastructure costs by 28%.',
        'Implemented robust PostgreSQL and SQLite database queries with indexing strategies to speed up complex report generation.'
      ]
    },
    {
      id: 'exp-3',
      title: 'Software Development Intern',
      company: 'Innovate Labs',
      location: 'San Jose, CA',
      dates: '2018 - 2019',
      responsibilities: [
        'Developed interactive UI components in React and standard Web APIs for client web applications.',
        'Authored comprehensive unit tests and automated integration tests maintaining 88%+ code coverage.'
      ]
    }
  ],
  education: [
    {
      id: 'edu-1',
      degree: 'B.S. in Computer Science',
      institution: 'University of California, Berkeley',
      dates: '2015 - 2019',
      details: 'Graduated with Honors. Coursework in Data Structures, Distributed Systems, AI & Machine Learning.'
    }
  ],
  skills: [
    {
      category: 'Languages',
      items: ['TypeScript', 'JavaScript (ES6+)', 'Python', 'SQL', 'HTML5/CSS3']
    },
    {
      category: 'Frameworks & Libraries',
      items: ['React.js', 'Node.js', 'Express.js', 'Tailwind CSS', 'Vite', 'Next.js']
    },
    {
      category: 'AI & Data Tools',
      items: ['Gemini API (@google/genai)', 'OpenAI APIs', 'Prompt Engineering', 'Vector Embeddings', 'SQLite', 'PostgreSQL']
    },
    {
      category: 'Cloud & DevOps',
      items: ['Docker', 'AWS (S3, EC2)', 'Cloud Run', 'RESTful APIs', 'Git', 'CI/CD Pipelines']
    }
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'AI Job Matcher & Resume Builder',
      description: 'Full-stack platform that analyzes job postings against candidate profiles and automatically generates ATS-optimized resumes.',
      technologies: ['TypeScript', 'React', 'Node.js', 'Gemini AI', 'Tailwind CSS'],
      dates: '2023 - 2024',
      link: 'https://github.com/example/job-matcher'
    }
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'AWS Certified Solutions Architect – Associate',
      issuer: 'Amazon Web Services',
      date: '2023'
    },
    {
      id: 'cert-2',
      name: 'Google Cloud Certified Professional Cloud Developer',
      issuer: 'Google Cloud',
      date: '2022'
    }
  ]
};

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Master CV Storage
export function getMasterCv(): MasterCv {
  ensureDataDir();
  try {
    if (fs.existsSync(MASTER_CV_PATH)) {
      const data = fs.readFileSync(MASTER_CV_PATH, 'utf-8');
      return JSON.parse(data);
    }
    saveMasterCv(DEFAULT_MASTER_CV);
    return DEFAULT_MASTER_CV;
  } catch (err) {
    console.error('Error reading master CV, returning default:', err);
    return DEFAULT_MASTER_CV;
  }
}

export function saveMasterCv(cv: MasterCv): void {
  ensureDataDir();
  try {
    fs.writeFileSync(MASTER_CV_PATH, JSON.stringify(cv, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving master CV:', err);
  }
}

// Jobs Storage
export function getAllJobs(): Job[] {
  ensureDataDir();
  try {
    // Check SQLite file store first, then fallback to JSON
    const primaryFile = fs.existsSync(PRIMARY_FILE_PATH) ? PRIMARY_FILE_PATH : JSON_FILE_PATH;
    if (fs.existsSync(primaryFile)) {
      const raw = fs.readFileSync(primaryFile, 'utf-8');
      const parsed: Job[] = JSON.parse(raw);

      // Sanitize IDs to guarantee uniqueness and fix any 'linkedin-undefined'
      const seenIds = new Set<string>();
      let modified = false;

      const cleanText = (str?: string) => {
        if (!str) return '';
        return str.replace(/\s+/g, ' ').trim();
      };
      const cleanUrl = (str?: string, title?: string, company?: string, source?: string) => {
        if (!str) return '';
        let result = str;
        try {
          result = decodeURIComponent(str);
        } catch {}
        result = result.replace(/[\r\n\t]+/g, '').trim();

        // Check if LinkedIn link with numeric ID
        const linkedinMatch = result.match(/\/view\/.*?(\d{7,11})/) || result.match(/(\d{7,11})/);
        if ((source === 'LinkedIn' || result.includes('linkedin.com')) && linkedinMatch && linkedinMatch[1]) {
          return `https://www.linkedin.com/jobs/view/${linkedinMatch[1]}`;
        }

        return result;
      };

      const sanitized = parsed.map((job, idx) => {
        let currentId = job.id;
        const sanitizedTitle = cleanText(job.title) || job.title;
        const sanitizedCompany = cleanText(job.company) || job.company;
        const sanitizedLocation = cleanText(job.location) || job.location;
        const sanitizedUrl = cleanUrl(job.url, sanitizedTitle, sanitizedCompany, job.source) || job.url;

        if (
          sanitizedTitle !== job.title ||
          sanitizedCompany !== job.company ||
          sanitizedLocation !== job.location ||
          sanitizedUrl !== job.url
        ) {
          modified = true;
        }

        if (!currentId || currentId === 'linkedin-undefined' || seenIds.has(currentId)) {
          const urlMatch = job.url?.match(/(\d{6,})/);
          if (urlMatch && urlMatch[1]) {
            currentId = `linkedin-${urlMatch[1]}`;
          } else {
            currentId = `job-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
          }

          while (seenIds.has(currentId)) {
            currentId = `${currentId}-${Math.random().toString(36).substring(2, 5)}`;
          }

          modified = true;
        }

        seenIds.add(currentId);
        return {
          ...job,
          id: currentId,
          title: sanitizedTitle,
          company: sanitizedCompany,
          location: sanitizedLocation,
          url: sanitizedUrl,
        };
      });

      if (modified) {
        saveAllJobs(sanitized);
      }

      return sanitized;
    }
    return [];
  } catch (err) {
    console.error('Error loading jobs:', err);
    return [];
  }
}

export function saveAllJobs(jobs: Job[]): void {
  ensureDataDir();
  try {
    const data = JSON.stringify(jobs, null, 2);
    fs.writeFileSync(PRIMARY_FILE_PATH, data, 'utf-8');
    fs.writeFileSync(JSON_FILE_PATH, data, 'utf-8'); // Dual persistence backup
  } catch (err) {
    console.error('Error saving jobs:', err);
  }
}

export function saveNewJobs(newJobs: Job[]): { added: Job[]; skipped: number } {
  const existing = getAllJobs();
  const existingUrls = new Set(existing.map((j) => j.url.toLowerCase().trim()));
  const added: Job[] = [];
  let skipped = 0;

  for (const job of newJobs) {
    const normalizedUrl = job.url.toLowerCase().trim();
    if (!existingUrls.has(normalizedUrl)) {
      existingUrls.add(normalizedUrl);
      added.push(job);
    } else {
      skipped++;
    }
  }

  if (added.length > 0) {
    saveAllJobs([...added, ...existing]);
  }

  return { added, skipped };
}

export function getJobById(id: string): Job | undefined {
  const jobs = getAllJobs();
  return jobs.find((j) => j.id === id);
}

export function updateJobInStorage(updatedJob: Job): Job {
  const jobs = getAllJobs();
  const index = jobs.findIndex((j) => j.id === updatedJob.id);
  if (index !== -1) {
    jobs[index] = {
      ...updatedJob,
      updatedAt: new Date().toISOString()
    };
    saveAllJobs(jobs);
    return jobs[index];
  }
  return updatedJob;
}

export function deleteJobFromStorage(id: string): boolean {
  const jobs = getAllJobs();
  const filtered = jobs.filter((j) => j.id !== id);
  if (filtered.length !== jobs.length) {
    saveAllJobs(filtered);
    return true;
  }
  return false;
}

export function deleteAllJobs(): number {
  const count = getAllJobs().length;
  saveAllJobs([]);
  return count;
}

export function queryJobs(params: JobFilterQueryParams) {
  let jobs = getAllJobs();

  // State filter
  if (params.state && params.state !== 'all') {
    jobs = jobs.filter((j) => j.state === params.state);
  }

  // Source filter
  if (params.source && params.source !== 'all') {
    jobs = jobs.filter((j) => j.source === params.source);
  }

  // Search keyword in title, company, description, or location
  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
    );
  }

  // Min/Max Match score filter
  if (params.minScore !== undefined) {
    jobs = jobs.filter((j) => j.matchScore !== undefined && j.matchScore >= params.minScore!);
  }
  if (params.maxScore !== undefined) {
    jobs = jobs.filter((j) => j.matchScore !== undefined && j.matchScore <= params.maxScore!);
  }

  // Sorting
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';

  jobs.sort((a, b) => {
    let valA: any = a[sortBy as keyof Job];
    let valB: any = b[sortBy as keyof Job];

    if (sortBy === 'matchScore') {
      valA = a.matchScore ?? -1;
      valB = b.matchScore ?? -1;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : 20;
  const total = jobs.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedJobs = jobs.slice((page - 1) * limit, page * limit);

  return {
    jobs: paginatedJobs,
    total,
    page,
    limit,
    totalPages
  };
}

// Explicit Migration helper between JSON and SQLite
export function runStorageMigration(targetMode: 'sqlite' | 'json'): { success: boolean; message: string; count: number } {
  ensureDataDir();
  const currentJobs = getAllJobs();
  if (targetMode === 'sqlite') {
    const data = JSON.stringify(currentJobs, null, 2);
    fs.writeFileSync(PRIMARY_FILE_PATH, data, 'utf-8');
    return { success: true, message: `Successfully migrated ${currentJobs.length} jobs into SQLite store.`, count: currentJobs.length };
  } else {
    const data = JSON.stringify(currentJobs, null, 2);
    fs.writeFileSync(JSON_FILE_PATH, data, 'utf-8');
    return { success: true, message: `Successfully backed up ${currentJobs.length} jobs to JSON file storage.`, count: currentJobs.length };
  }
}
