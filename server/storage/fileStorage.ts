import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import Database from 'better-sqlite3';
import { Job, MasterCv, JobFilterQueryParams } from '../../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const JSON_FILE_PATH = path.join(DATA_DIR, 'jobs.json');
const MASTER_CV_PATH = path.join(DATA_DIR, 'master_cv.json');
const SQLITE_DB_PATH = path.join(DATA_DIR, 'ats_jobs.sqlite');
const LEGACY_PRIMARY_JSON = path.join(DATA_DIR, 'ats_jobs.sqlite.json');

// Request-scoped identity: the middleware wraps each request with the
// authenticated user id, and storage functions resolve the current user from it.
export const authContext = new AsyncLocalStorage<{ userId: string }>();

export function getCurrentUserId(): string {
  return authContext.getStore()?.userId || '';
}

export function runWithUser(userId: string, fn: () => void): void {
  authContext.run({ userId }, fn);
}

// ─────────────────── Sessions ───────────────────
export function createSession(userId: string): string {
  const token = crypto.randomBytes(24).toString('hex');
  getDb().prepare('INSERT OR REPLACE INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, new Date().toISOString());
  return token;
}

export function getSessionUser(token: string): string | undefined {
  try {
    const row = getDb().prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined;
    return row?.user_id;
  } catch { return undefined; }
}

export function deleteSession(token: string): void {
  try {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  } catch { /* ignore */ }
}

// ─────────────────── Auth / Users ───────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  isGuest: boolean;
  createdAt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

export function createUser(email: string, name: string, password?: string): User {
  const d = getDb();
  const existing = d.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) throw new Error('An account with this email already exists.');
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const isGuest = !password;
  const salt = isGuest ? '' : crypto.randomBytes(8).toString('hex');
  const passHash = isGuest ? '' : hashPassword(password!, salt);
  const createdAt = new Date().toISOString();
  d.prepare('INSERT INTO users (id, email, name, salt, pass_hash, is_guest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase().trim(), name, salt, passHash, isGuest ? 1 : 0, createdAt);
  return { id, email: email.toLowerCase().trim(), name, isGuest, createdAt };
}

export function verifyLogin(email: string, password: string): User | null {
  const d = getDb();
  const row = d.prepare('SELECT id, email, name, salt, pass_hash, is_guest, created_at FROM users WHERE email = ?')
    .get(email.toLowerCase().trim()) as { id: string; email: string; name: string; salt: string; pass_hash: string; is_guest: number; created_at: string } | undefined;
  if (!row || row.is_guest === 1) return null;
  const hash = hashPassword(password, row.salt);
  if (hash !== row.pass_hash) return null;
  return { id: row.id, email: row.email, name: row.name, isGuest: false, createdAt: row.created_at };
}

export function listUsers(): User[] {
  try {
    const d = getDb();
    return (d.prepare('SELECT id, email, name, is_guest, created_at FROM users ORDER BY is_guest ASC, name').all() as any[])
      .map((r) => ({ id: r.id, email: r.email, name: r.name, isGuest: r.is_guest === 1, createdAt: r.created_at }));
  } catch { return []; }
}

export function getUserById(id: string): User | undefined {
  try {
    const d = getDb();
    const r = d.prepare('SELECT id, email, name, is_guest, created_at FROM users WHERE id = ?').get(id) as any;
    return r ? { id: r.id, email: r.email, name: r.name, isGuest: r.is_guest === 1, createdAt: r.created_at } : undefined;
  } catch { return undefined; }
}

// ─────────────────── Database ───────────────────
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

export function getDb(): Database.Database {
  if (db) return db;
  ensureDataDir();
  db = new Database(SQLITE_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      salt TEXT,
      pass_hash TEXT,
      is_guest INTEGER DEFAULT 0,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS master_cv (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS manual_analysis (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT,
      company TEXT,
      description TEXT,
      score INTEGER,
      gap_analysis TEXT,
      diff TEXT,
      tailored_cv TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cv_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      note TEXT,
      pages INTEGER DEFAULT 0,
      created_at TEXT
    );
  `);
  migrateToUsers(db);
  return db;
}

/**
 * Migrates a pre-auth database into per-user isolation. Idempotent:
 * each step runs only if its precondition is unmet, so interrupted
 * migrations can be retried safely.
 */
function migrateToUsers(d: Database.Database): void {
  try {
    // 1. jobs table: add user_id if missing
    const jobCols = d.prepare('PRAGMA table_info(jobs)').all() as { name: string }[];
    if (!jobCols.some((c) => c.name === 'user_id')) {
      d.exec('ALTER TABLE jobs ADD COLUMN user_id TEXT');
      console.log('[Storage] Added user_id column to jobs table');
    }

    // 2. master_cv table: rebuild into user-keyed schema
    const cvCols = d.prepare('PRAGMA table_info(master_cv)').all() as { name: string }[];
    if (!cvCols.some((c) => c.name === 'user_id')) {
      d.exec('ALTER TABLE master_cv RENAME TO master_cv_old');
      d.exec(`
        CREATE TABLE master_cv (
          user_id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at TEXT
        );
      `);
      if (cvCols.some((c) => c.name === 'profile_id')) {
        const rows = d.prepare('SELECT profile_id, data, updated_at FROM master_cv_old').all() as { profile_id: string; data: string; updated_at: string }[];
        const keep = rows.find((r) => r.profile_id === 'default') || rows[0];
        if (keep) {
          d.prepare('INSERT INTO master_cv (user_id, data, updated_at) VALUES (?, ?, ?)')
            .run('__placeholder__', keep.data, keep.updated_at || new Date().toISOString());
        }
      } else if (cvCols.some((c) => c.name === 'data')) {
        const row = d.prepare('SELECT data, updated_at FROM master_cv_old LIMIT 1').get() as { data: string; updated_at: string } | undefined;
        if (row) {
          d.prepare('INSERT INTO master_cv (user_id, data, updated_at) VALUES (?, ?, ?)')
            .run('__placeholder__', row.data, row.updated_at || new Date().toISOString());
        }
      }
      d.exec('DROP TABLE master_cv_old');
      console.log('[Storage] Rebuilt master_cv table with user_id schema');
    }

    // 3. Ensure an owner exists for unclaimed data
    const userCount = (d.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
    let adminId: string | undefined;
    if (userCount === 0) {
      const admin = createUser('admin@local', 'Admin');
      adminId = admin.id;
      console.log(`[Storage] Created admin user (admin@local, id=${admin.id})`);
    } else {
      adminId = (d.prepare('SELECT id FROM users ORDER BY is_guest ASC, created_at ASC LIMIT 1').get() as any)?.id;
    }

    if (adminId) {
      d.exec(`UPDATE jobs SET user_id = '${adminId}' WHERE user_id IS NULL OR user_id = ''`);
      d.exec(`UPDATE master_cv SET user_id = '${adminId}' WHERE user_id = '__placeholder__' OR user_id = ''`);
      const owned = (d.prepare('SELECT COUNT(*) AS c FROM jobs WHERE user_id = ?').get(adminId) as { c: number }).c;
      console.log(`[Storage] Data isolation ready: ${owned} jobs owned by ${adminId}`);
    }
  } catch (err) {
    console.error('[Storage] User migration failed:', err);
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
    const adminId = (d.prepare('SELECT id FROM users ORDER BY is_guest ASC, created_at ASC LIMIT 1').get() as any)?.id || '';
    const insert = d.prepare('INSERT OR IGNORE INTO jobs (id, user_id, data) VALUES (?, ?, ?)');
    const tx = d.transaction((jobs: Job[]) => {
      for (const j of jobs) insert.run(j.id, adminId, JSON.stringify(j));
    });
    tx(parsed);
    console.log(`[Storage] Imported ${parsed.length} jobs from legacy JSON into SQLite`);
  } catch (err) {
    console.warn('[Storage] Legacy JSON import failed:', err);
  }
}

migrateFromLegacyJson();

// ─────────────────── Master CV Storage (multi-profile) ───────────────────
// ─────────────────── Master CV Storage (per-user) ───────────────────
export function getMasterCv(userId?: string): MasterCv {
  const targetId = userId || getCurrentUserId();
  try {
    const d = getDb();
    const row = d.prepare('SELECT data FROM master_cv WHERE user_id = ?').get(targetId) as { data: string } | undefined;
    if (row) return JSON.parse(row.data);
  } catch (err) {
    console.error('Error reading master CV from DB:', err);
  }
  // No stored CV for this user — a fresh default (legacy JSON import is handled by the migration).
  saveMasterCv(DEFAULT_MASTER_CV, targetId);
  return DEFAULT_MASTER_CV;
}

export function saveMasterCv(cv: MasterCv, userId?: string): void {
  const targetId = userId || getCurrentUserId();
  try {
    const d = getDb();
    d.prepare(`
      INSERT INTO master_cv (user_id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(targetId, JSON.stringify(cv), new Date().toISOString());
  } catch (err) {
    console.error('Error saving master CV:', err);
  }
}

// ─────────────────── Jobs Storage (per-user) ───────────────────
function getJobsForUser(userId: string): Job[] {
  try {
    const d = getDb();
    const rows = d.prepare('SELECT data FROM jobs WHERE user_id = ?').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  } catch (err) {
    console.error('Error loading jobs:', err);
    return [];
  }
}

export function getAllJobs(): Job[] {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return getJobsForUser(userId);
}

export function saveAllJobs(jobs: Job[]): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    const d = getDb();
    const insert = d.prepare('INSERT OR REPLACE INTO jobs (id, user_id, data) VALUES (?, ?, ?)');
    const existing = new Set((d.prepare('SELECT id FROM jobs WHERE user_id = ?').all(userId) as { id: string }[]).map((r) => r.id));
    const tx = d.transaction(() => {
      for (const job of jobs) {
        insert.run(job.id, userId, JSON.stringify(job));
        existing.delete(job.id);
      }
      const del = d.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?');
      for (const gone of existing) del.run(gone, userId);
    });
    tx();
  } catch (err) {
    console.error('Error saving jobs:', err);
  }
}

export function saveNewJobs(newJobs: Job[]): { added: Job[]; skipped: number } {
  const userId = getCurrentUserId();
  if (!userId) return { added: [], skipped: 0 };
  const d = getDb();
  const existingUrls = new Set((d.prepare('SELECT data FROM jobs WHERE user_id = ?').all(userId) as { data: string }[])
    .map((r) => { try { return (JSON.parse(r.data) as Job).url?.toLowerCase().trim(); } catch { return ''; } })
    .filter(Boolean));

  const insert = d.prepare('INSERT OR IGNORE INTO jobs (id, user_id, data) VALUES (?, ?, ?)');
  const added: Job[] = [];
  let skipped = 0;

  const tx = d.transaction(() => {
    for (const job of newJobs) {
      const normalizedUrl = job.url?.toLowerCase().trim() || '';
      if (normalizedUrl && existingUrls.has(normalizedUrl)) {
        skipped++;
        continue;
      }
      const result = insert.run(job.id, userId, JSON.stringify(job));
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
  const userId = getCurrentUserId();
  if (!userId) return undefined;
  try {
    const d = getDb();
    const row = d.prepare('SELECT data FROM jobs WHERE id = ? AND user_id = ?').get(id, userId) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  } catch {
    return undefined;
  }
}

export function updateJobInStorage(updatedJob: Job): Job {
  const userId = getCurrentUserId();
  try {
    const d = getDb();
    const result = d.prepare('UPDATE jobs SET data = ? WHERE id = ? AND user_id = ?').run(
      JSON.stringify({ ...updatedJob, updatedAt: new Date().toISOString() }),
      updatedJob.id,
      userId
    );
    if (result.changes > 0) return { ...updatedJob, updatedAt: new Date().toISOString() };
    return updatedJob;
  } catch (err) {
    console.error('Error updating job:', err);
    return updatedJob;
  }
}

export function deleteJobFromStorage(id: string): boolean {
  const userId = getCurrentUserId();
  try {
    const d = getDb();
    return d.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  } catch {
    return false;
  }
}

export function deleteAllJobs(): number {
  const userId = getCurrentUserId();
  try {
    const d = getDb();
    const result = d.prepare('DELETE FROM jobs WHERE user_id = ?').run(userId);
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

// ─────────────────── Manual JD History ───────────────────
export interface ManualAnalysisRecord {
  id: string;
  role: string;
  company: string;
  description: string;
  score: number;
  gapAnalysis: any;
  diff: any | null;
  tailoredCv: any | null;
  createdAt: string;
}

export function saveManualAnalysis(record: Omit<ManualAnalysisRecord, 'id' | 'createdAt'> & { id?: string }): ManualAnalysisRecord {
  const userId = getCurrentUserId();
  const id = record.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  getDb().prepare(`
    INSERT OR REPLACE INTO manual_analysis (id, user_id, role, company, description, score, gap_analysis, diff, tailored_cv, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    record.role,
    record.company,
    record.description,
    record.score,
    JSON.stringify(record.gapAnalysis ?? null),
    JSON.stringify(record.diff ?? null),
    JSON.stringify(record.tailoredCv ?? null),
    createdAt
  );
  return { ...record, id, createdAt };
}

export function listManualAnalyses(): { id: string; role: string; company: string; score: number; createdAt: string; hasTailoredCv: boolean }[] {
  const userId = getCurrentUserId();
  try {
    const rows = getDb()
      .prepare('SELECT id, role, company, score, tailored_cv, created_at FROM manual_analysis WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as any[];
    return rows.map((r) => ({
      id: r.id,
      role: r.role || '',
      company: r.company || '',
      score: r.score ?? 0,
      createdAt: r.created_at || '',
      hasTailoredCv: !!(r.tailored_cv && r.tailored_cv !== 'null'),
    }));
  } catch { return []; }
}

export function getManualAnalysis(id: string): ManualAnalysisRecord | undefined {
  const userId = getCurrentUserId();
  try {
    const r = getDb()
      .prepare('SELECT * FROM manual_analysis WHERE id = ? AND user_id = ?')
      .get(id, userId) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      role: r.role || '',
      company: r.company || '',
      description: r.description || '',
      score: r.score ?? 0,
      gapAnalysis: r.gap_analysis ? JSON.parse(r.gap_analysis) : undefined,
      diff: r.diff ? JSON.parse(r.diff) : null,
      tailoredCv: r.tailored_cv ? JSON.parse(r.tailored_cv) : null,
      createdAt: r.created_at || '',
    };
  } catch { return undefined; }
}

export function deleteManualAnalysis(id: string): boolean {
  const userId = getCurrentUserId();
  try {
    return getDb().prepare('DELETE FROM manual_analysis WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  } catch { return false; }
}

// ─────────────────── CV Versions (backups) ───────────────────
export function saveCvVersion(data: any, note: string, pages?: number): void {
  const userId = getCurrentUserId();
  const id = `cvver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  getDb().prepare(`
    INSERT INTO cv_versions (id, user_id, data, note, pages, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, JSON.stringify(data), note, pages ?? 0, new Date().toISOString());
}

export function listCvVersions(): { id: string; note: string; pages: number; createdAt: string }[] {
  const userId = getCurrentUserId();
  try {
    return (getDb()
      .prepare('SELECT id, note, pages, created_at FROM cv_versions WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as any[]).map((r) => ({ id: r.id, note: r.note || '', pages: r.pages ?? 0, createdAt: r.created_at || '' }));
  } catch { return []; }
}

export function getCvVersion(id: string): { data: any; note: string } | undefined {
  const userId = getCurrentUserId();
  try {
    const r = getDb().prepare('SELECT data, note FROM cv_versions WHERE id = ? AND user_id = ?').get(id, userId) as any;
    if (!r) return undefined;
    return { data: JSON.parse(r.data), note: r.note || '' };
  } catch { return undefined; }
}

export function deleteCvVersion(id: string): boolean {
  const userId = getCurrentUserId();
  try {
    return getDb().prepare('DELETE FROM cv_versions WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  } catch { return false; }
}
