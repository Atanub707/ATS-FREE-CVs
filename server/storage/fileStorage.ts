import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { Job, MasterCv, JobFilterQueryParams } from '../../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const JSON_FILE_PATH = path.join(DATA_DIR, 'jobs.json');
const MASTER_CV_PATH = path.join(DATA_DIR, 'master_cv.json');
const SQLITE_DB_PATH = path.join(DATA_DIR, 'ats_jobs.sqlite');
const LEGACY_PRIMARY_JSON = path.join(DATA_DIR, 'ats_jobs.sqlite.json');

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

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ─────────────────── SQLite connection ───────────────────
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  ensureDataDir();
  db = new Database(SQLITE_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS master_cv (
      profile_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT
    );
  `);
  migrateOldMasterCvSchema(db);
  return db;
}

/**
 * If the pre-multi-profile master_cv table (id INTEGER CHECK(id=1)) exists,
 * rebuild it into the profile-keyed table and migrate the existing row to 'default'.
 */
function migrateOldMasterCvSchema(d: Database.Database): void {
  const cols = d.prepare("PRAGMA table_info(master_cv)").all() as { name: string }[];
  const hasProfileId = cols.some((c) => c.name === 'profile_id');
  if (hasProfileId) return;

  console.log('[Storage] Migrating master_cv table to multi-profile schema...');
  try {
    const oldRows = d.prepare('SELECT data FROM master_cv').all() as { data: string }[];
    d.exec('DROP TABLE master_cv');
    d.exec(`
      CREATE TABLE master_cv (
        profile_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT
      );
    `);
    const insert = d.prepare('INSERT OR IGNORE INTO master_cv (profile_id, name, data, updated_at) VALUES (?, ?, ?, ?)');
    if (oldRows.length > 0) {
      insert.run('default', 'Default Profile', oldRows[0].data, new Date().toISOString());
      console.log('[Storage] Migrated existing master CV to "default" profile');
    }
  } catch (err) {
    console.error('[Storage] master_cv migration failed:', err);
  }
}

/** One-time import from legacy JSON files if the DB is empty */
function migrateFromLegacyJson(): void {
  ensureDataDir();
  const d = getDb();
  const row = d.prepare('SELECT COUNT(*) AS c FROM jobs').get() as { c: number };
  if (row.c > 0) return;

  const legacyPath = [LEGACY_PRIMARY_JSON, JSON_FILE_PATH].find((p) => fs.existsSync(p));
  if (!legacyPath) return;

  try {
    const parsed: Job[] = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    const insert = d.prepare('INSERT OR IGNORE INTO jobs (id, data) VALUES (?, ?)');
    const tx = d.transaction((jobs: Job[]) => {
      for (const j of jobs) insert.run(j.id, JSON.stringify(j));
    });
    tx(parsed);
    console.log(`[Storage] Imported ${parsed.length} jobs from legacy JSON into SQLite`);
  } catch (err) {
    console.warn('[Storage] Legacy JSON import failed:', err);
  }
}

migrateFromLegacyJson();

// ─────────────────── Master CV Storage (multi-profile) ───────────────────
export interface CvProfile {
  id: string;
  name: string;
  updatedAt?: string;
  isActive?: boolean;
}

// Keep the active profile id in a small sidecar file so it survives restarts
// without touching config.ini (which is gitignored but also user-editable).
const ACTIVE_PROFILE_PATH = path.join(DATA_DIR, 'active_profile.txt');

export function getActiveProfileId(): string {
  try {
    if (fs.existsSync(ACTIVE_PROFILE_PATH)) {
      const id = fs.readFileSync(ACTIVE_PROFILE_PATH, 'utf-8').trim();
      if (id) return id;
    }
  } catch { /* ignore */ }
  return 'default';
}

export function setActiveProfileId(id: string): void {
  ensureDataDir();
  try {
    fs.writeFileSync(ACTIVE_PROFILE_PATH, id, 'utf-8');
  } catch (err) {
    console.error('Error saving active profile:', err);
  }
}

export function listCvProfiles(): CvProfile[] {
  try {
    const d = getDb();
    const activeId = getActiveProfileId();
    const rows = d.prepare('SELECT profile_id, name, updated_at FROM master_cv ORDER BY name').all() as { profile_id: string; name: string; updated_at: string | null }[];
    return rows.map((r) => ({
      id: r.profile_id,
      name: r.name,
      updatedAt: r.updated_at || undefined,
      isActive: r.profile_id === activeId,
    }));
  } catch (err) {
    console.error('Error listing profiles:', err);
    return [];
  }
}

export function createCvProfile(name: string, cloneFrom?: string): CvProfile {
  const d = getDb();
  const profileId = `profile-${Date.now()}`;
  let data = JSON.stringify(DEFAULT_MASTER_CV);
  let updatedAt = new Date().toISOString();

  if (cloneFrom) {
    const row = d.prepare('SELECT data FROM master_cv WHERE profile_id = ?').get(cloneFrom) as { data: string } | undefined;
    if (row) {
      const cv = JSON.parse(row.data);
      cv.fullName = `${name} Candidate`;
      data = JSON.stringify(cv);
    }
  }

  const existing = d.prepare('SELECT 1 FROM master_cv WHERE name = ?').get(name);
  if (existing) {
    throw new Error(`A profile named "${name}" already exists.`);
  }

  d.prepare('INSERT INTO master_cv (profile_id, name, data, updated_at) VALUES (?, ?, ?, ?)')
    .run(profileId, name, data, updatedAt);
  return { id: profileId, name, updatedAt, isActive: false };
}

export function deleteCvProfile(id: string): boolean {
  if (id === 'default') return false; // never delete the default profile
  const d = getDb();
  const result = d.prepare('DELETE FROM master_cv WHERE profile_id = ?').run(id);
  if (result.changes > 0 && getActiveProfileId() === id) {
    setActiveProfileId('default');
  }
  return result.changes > 0;
}

export function getMasterCv(profileId?: string): MasterCv {
  const targetId = profileId || getActiveProfileId();
  try {
    const d = getDb();
    const row = d.prepare('SELECT data FROM master_cv WHERE profile_id = ?').get(targetId) as { data: string } | undefined;
    if (row) return JSON.parse(row.data);
  } catch (err) {
    console.error('Error reading master CV from DB:', err);
  }
  // Fallback: legacy JSON file or default
  try {
    if (fs.existsSync(MASTER_CV_PATH)) {
      const cv = JSON.parse(fs.readFileSync(MASTER_CV_PATH, 'utf-8'));
      saveMasterCv(cv, 'default');
      return cv;
    }
  } catch { /* ignore */ }
  saveMasterCv(DEFAULT_MASTER_CV, 'default');
  return DEFAULT_MASTER_CV;
}

export function saveMasterCv(cv: MasterCv, profileId?: string): void {
  const targetId = profileId || getActiveProfileId();
  try {
    const d = getDb();
    d.prepare(`
      INSERT INTO master_cv (profile_id, name, data, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(targetId, `Profile ${targetId.slice(-4)}`, JSON.stringify(cv), new Date().toISOString());
  } catch (err) {
    console.error('Error saving master CV:', err);
  }
}

// ─────────────────── Jobs Storage ───────────────────
export function getAllJobs(): Job[] {
  try {
    const d = getDb();
    const rows = d.prepare('SELECT data FROM jobs').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  } catch (err) {
    console.error('Error loading jobs:', err);
    return [];
  }
}

export function saveAllJobs(jobs: Job[]): void {
  try {
    const d = getDb();
    const insert = d.prepare('INSERT OR REPLACE INTO jobs (id, data) VALUES (?, ?)');
    const existing = new Set((d.prepare('SELECT id FROM jobs').all() as { id: string }[]).map((r) => r.id));
    const tx = d.transaction(() => {
      for (const job of jobs) {
        insert.run(job.id, JSON.stringify(job));
        existing.delete(job.id);
      }
      const del = d.prepare('DELETE FROM jobs WHERE id = ?');
      for (const gone of existing) del.run(gone);
    });
    tx();
  } catch (err) {
    console.error('Error saving jobs:', err);
  }
}

export function saveNewJobs(newJobs: Job[]): { added: Job[]; skipped: number } {
  const d = getDb();
  const existingUrls = new Set((d.prepare('SELECT data FROM jobs').all() as { data: string }[])
    .map((r) => { try { return (JSON.parse(r.data) as Job).url?.toLowerCase().trim(); } catch { return ''; } })
    .filter(Boolean));

  const insert = d.prepare('INSERT OR IGNORE INTO jobs (id, data) VALUES (?, ?)');
  const added: Job[] = [];
  let skipped = 0;

  const tx = d.transaction(() => {
    for (const job of newJobs) {
      const normalizedUrl = job.url?.toLowerCase().trim() || '';
      if (normalizedUrl && existingUrls.has(normalizedUrl)) {
        skipped++;
        continue;
      }
      const result = insert.run(job.id, JSON.stringify(job));
      if (result.changes > 0) {
        existingUrls.add(normalizedUrl);
        added.push(job);
      } else {
        skipped++;
      }
    }
  });
  tx();

  return { added, skipped };
}

export function getJobById(id: string): Job | undefined {
  try {
    const d = getDb();
    const row = d.prepare('SELECT data FROM jobs WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  } catch {
    return undefined;
  }
}

export function updateJobInStorage(updatedJob: Job): Job {
  try {
    const d = getDb();
    const result = d.prepare('UPDATE jobs SET data = ? WHERE id = ?').run(
      JSON.stringify({ ...updatedJob, updatedAt: new Date().toISOString() }),
      updatedJob.id
    );
    if (result.changes > 0) return { ...updatedJob, updatedAt: new Date().toISOString() };
    return updatedJob;
  } catch (err) {
    console.error('Error updating job:', err);
    return updatedJob;
  }
}

export function deleteJobFromStorage(id: string): boolean {
  try {
    const d = getDb();
    return d.prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0;
  } catch {
    return false;
  }
}

export function deleteAllJobs(): number {
  try {
    const d = getDb();
    const result = d.prepare('DELETE FROM jobs').run();
    return result.changes;
  } catch {
    return 0;
  }
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

// Explicit export between SQLite and JSON
export function runStorageMigration(targetMode: 'sqlite' | 'json'): { success: boolean; message: string; count: number } {
  ensureDataDir();
  const currentJobs = getAllJobs();
  if (targetMode === 'sqlite') {
    return { success: true, message: `SQLite is already the primary store (${currentJobs.length} jobs).`, count: currentJobs.length };
  } else {
    const data = JSON.stringify(currentJobs, null, 2);
    fs.writeFileSync(JSON_FILE_PATH, data, 'utf-8');
    return { success: true, message: `Successfully backed up ${currentJobs.length} jobs to JSON file storage.`, count: currentJobs.length };
  }
}
