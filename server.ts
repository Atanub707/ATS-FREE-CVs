import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const mod: any = pdfParseModule;
    if (mod && typeof mod === 'function') {
      const res = await mod(buffer);
      if (res?.text && res.text.trim().length > 0) return res.text;
    }
    if (mod && typeof mod.default === 'function') {
      const res = await mod.default(buffer);
      if (res?.text && res.text.trim().length > 0) return res.text;
    }
    if (mod && mod.PDFParse) {
      const parser = new mod.PDFParse({ data: buffer });
      const res = await parser.getText();
      if (typeof res === 'string' && res.trim().length > 0) return res;
      if (res && typeof res.text === 'string' && res.text.trim().length > 0) return res.text;
    }
  } catch (err) {
    console.warn('pdf-parse encountered an error extracting text:', err);
  }

  // Raw text stream regex fallback for PDF text extraction if pdf-parse fails or returns empty
  try {
    const str = buffer.toString('utf-8');
    const matches = str.match(/\(([^()]{2,})\)\s*T[jd]/g);
    if (matches && matches.length > 0) {
      const extracted = matches
        .map((m) => m.replace(/^\(/, '').replace(/\)\s*T[jd]$/, '').trim())
        .filter((t) => t.length > 1)
        .join(' ');
      if (extracted.length > 20) {
        return extracted;
      }
    }
  } catch (e) {
    // ignore
  }

  return '';
}

import { loadConfig, saveConfig } from './server/config.js';
import {
  getDb,
  getMasterCv,
  saveMasterCv,
  createUser,
  verifyLogin,
  getRecoveryInfo,
  resetPasswordWithRecovery,
  setRecoveryQuestions,
  listUsers,
  getUserById,
  createSession,
  getSessionUser,
  deleteSession,
  runWithUser,
  getCurrentUserId,
  getAllJobs,
  getJobById,
  updateJobInStorage,
  deleteJobFromStorage,
  deleteAllJobs,
  queryJobs,
  saveNewJobs,
  runStorageMigration,
  fixMislabeledWorkTypes,
  repairJobDates,
  saveManualAnalysis,
  listManualAnalyses,
  getManualAnalysis,
  deleteManualAnalysis,
  saveCvVersion,
  listCvVersions,
  getCvVersion,
  deleteCvVersion,
  listPortalBookmarks,
  addPortalBookmark,
  removePortalBookmark,
  listContacts,
  getContactById,
  recordContactEmail,
  recordContactEmailDetail,
  listContactCompanies,
  listContactsForJob,
  setContactHidden,
  setContactFollowUp,
  setContactFollowedUp,
  setContactPipeline,
  addContactNote,
  listContactEmails,
  listEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
  getContactStats,
  listContactsCsv,
  updateContactIdentity,
  backfillContacts,
} from './server/storage/fileStorage.js';
import { ScraperFactory } from './server/scraper/scraperFactory.js';
import { LlmMatcher } from './server/matcher/llmMatcher.js';
import { hasApiKeyConfigured, mapLlmError } from './server/llm/apiKeyGuard.js';
import { LlmCvTailor } from './server/builder/llmCvTailor.js';
import { generatePdfBuffer, generatePlainTextCv } from './server/builder/docxGenerator.js';
import { JobFilterQueryParams, Job, MasterCv } from './src/types.js';
import { SOURCES } from './src/constants/sources.js';
import { compressCv } from './server/ai/cvCompressor.js';
import { getMarketData } from './server/ai/marketData.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max file size
});

function fallbackParseCvFromText(rawText: string) {
  const lines = (rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);

  let fullName = 'Candidate Name';
  let email = '';
  let phone = '';
  let location = '';
  let linkedin = '';
  let github = '';
  let website = '';

  for (const line of lines) {
    if (!email && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(line)) {
      const match = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (match) email = match[0];
    }
    if (!phone && /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(line)) {
      const match = line.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (match) phone = match[0];
    }
    if (!linkedin && /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i.test(line)) {
      const match = line.match(/https?:\/\/[^\s]+/i) || line.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
      if (match) linkedin = match[0];
    }
    if (!github && /github\.com\/[a-zA-Z0-9_-]+/i.test(line)) {
      const match = line.match(/https?:\/\/[^\s]+/i) || line.match(/github\.com\/[a-zA-Z0-9_-]+/i);
      if (match) github = match[0];
    }
  }

  for (const line of lines.slice(0, 5)) {
    if (line.length < 40 && !line.includes('@') && !line.includes('http') && !line.toLowerCase().includes('resume') && !line.toLowerCase().includes('curriculum')) {
      fullName = line;
      break;
    }
  }

  const knownSkills = [
    'TypeScript', 'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'Go',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'SQL', 'PostgreSQL', 'MongoDB',
    'GraphQL', 'REST API', 'Git', 'Linux', 'CI/CD', 'Terraform', 'Microservices',
    'DevOps', 'HTML', 'CSS', 'Tailwind', 'Redux', 'Next.js', 'Express'
  ];
  const foundSkills: string[] = [];
  const textLower = (rawText || '').toLowerCase();
  for (const s of knownSkills) {
    if (textLower.includes(s.toLowerCase())) {
      foundSkills.push(s);
    }
  }

  const paragraphs = (rawText || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const summary = paragraphs[0] || (rawText || '').slice(0, 300) || 'Experienced software professional.';

  return {
    fullName,
    email: email || 'candidate@example.com',
    phone: phone || '+1 (555) 000-0000',
    location: location || 'Remote',
    linkedin,
    github,
    website,
    summary,
    experiences: [
      {
        id: 'exp-1',
        title: 'Senior Engineer / IT Specialist',
        company: 'Professional Organization',
        location: location || 'Remote / Hybrid',
        dates: '2021 - Present',
        responsibilities: paragraphs.slice(1, 6).map((p) => p.slice(0, 200)) || [
          'Engineered scalability, infrastructure resilience, and cloud operations.',
          'Collaborated with cross-functional technical teams.',
        ],
      },
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'Degree in Engineering / Science / Technology',
        institution: 'Academic Institution',
        dates: 'Graduated',
        details: 'Core technical focus',
      },
    ],
    skills: [
      {
        category: 'Core Competencies',
        items: foundSkills.length > 0 ? foundSkills : ['Engineering', 'Software Development', 'System Architecture'],
      },
    ],
    projects: [],
    certifications: [],
    rawText: rawText || '',
  };
}

import { ask } from './server/llm/llmAdapter.js';
import nodemailer from 'nodemailer';

// Convert the stored Master CV into the TailoredCv shape the PDF generator
// consumes (same conversion the master-download route uses).
function masterCvToTailoredCv(m: ReturnType<typeof getMasterCv>): any {
  return {
    candidateName: m.fullName,
    contactInfo: {
      email: m.email,
      phone: m.phone,
      location: m.location,
      linkedin: m.linkedin,
      github: m.github,
      website: m.website,
    },
    targetRole: m.experiences[0]?.title || '',
    professionalSummary: m.summary,
    coreCompetencies: m.skills.flatMap((s) => s.items),
    workExperience: m.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      dates: e.dates,
      highlights: e.responsibilities,
    })),
    education: m.education.map((e) => ({
      degree: e.degree,
      institution: e.institution,
      dates: e.dates,
      details: e.details || '',
    })),
    technicalSkills: m.skills.map((s) => ({
      category: s.category,
      skills: s.items,
    })),
    projects: m.projects || [],
    certifications: (m.certifications || []).map((c) =>
      typeof c === 'string' ? c : `${c.name}${c.issuer ? ' (' + c.issuer + ')' : ''}`
    ),
  };
}

async function parseCvWithLLM(
  input: string | { buffer: Buffer; mimeType: string; originalName: string }
) {
  let rawText = typeof input === 'string' ? input : '';
  let fileInfo = typeof input === 'object' ? input : null;

  if (fileInfo) {
    const { buffer, mimeType, originalName } = fileInfo;
    const filenameLower = originalName.toLowerCase();

    if (mimeType === 'application/pdf' || filenameLower.endsWith('.pdf')) {
      rawText = await extractTextFromPdfBuffer(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filenameLower.endsWith('.docx')
    ) {
      try {
        const parsedDocx = await mammoth.extractRawText({ buffer });
        rawText = parsedDocx.value || '';
      } catch (err) {
        console.warn('mammoth docx extraction error:', err);
      }
    } else {
      rawText = buffer.toString('utf-8');
    }
  }

  const promptText = `You are an expert ATS resume parser. 
Extract every detail from A to Z from the resume into clean, structured JSON.

INSTRUCTIONS:
1. Contact Details: Extract Full Name, Email, Phone Number, Location/Address, LinkedIn URL, GitHub URL, and Portfolio Website.
2. Professional Summary: Extract or formulate a thorough 3-5 sentence master professional summary covering the candidate's core domain, years of experience, and key value proposition.
3. Work History (Experiences): Extract EVERY job role with Title, Company, Location, Dates (e.g., "Jan 2021 - Present"), and an array of individual responsibilities/achievements as bullet points.
4. Education: Extract degrees, university/institution names, graduation dates/years, and any honors or details.
5. Technical Skills: Group skills into logical categories (e.g., "Languages & Frameworks", "Cloud & Infrastructure", "Tools & Methodologies") with an array of individual skill tags.
6. Projects: Extract any key projects mentioned with Project Name, Description, Technologies used (array of strings), Link/URL, and Dates/Period.
7. Certifications: Extract any professional certifications, licenses, or credentials with Certification Name, Issuer (e.g., AWS, Microsoft, Google), Date obtained, and Link if available.

Return valid JSON with these exact fields: fullName, email, phone, location, linkedin, github, website, summary, experiences (array of {title, company, location, dates, responsibilities[]}), education (array of {degree, institution, dates, details}), skills (array of {category, items[]}), projects (array of {name, description, technologies[], link, dates}), certifications (array of {name, issuer, date, link}).

RAW RESUME TEXT:
${rawText || 'No readable text extracted.'}`;

  try {
    const jsonText = await ask(promptText, 0.1);
    const parsedData = JSON.parse(jsonText);

    return {
      fullName: parsedData.fullName || 'Candidate Name',
      email: parsedData.email || '',
      phone: parsedData.phone || '',
      location: parsedData.location || '',
      linkedin: parsedData.linkedin || '',
      github: parsedData.github || '',
      website: parsedData.website || '',
      summary: parsedData.summary || '',
      experiences: (parsedData.experiences || []).map((exp: any, i: number) => ({
        id: `exp-${i + 1}`,
        title: exp.title || 'Role',
        company: exp.company || 'Company',
        location: exp.location || '',
        dates: exp.dates || '',
        responsibilities: Array.isArray(exp.responsibilities) ? exp.responsibilities : [],
      })),
      education: (parsedData.education || []).map((edu: any, i: number) => ({
        id: `edu-${i + 1}`,
        degree: edu.degree || 'Degree',
        institution: edu.institution || 'University',
        dates: edu.dates || '',
        details: edu.details || '',
      })),
      skills: (parsedData.skills || []).map((sk: any) => ({
        category: sk.category || 'Core Skills',
        items: Array.isArray(sk.items) ? sk.items : [],
      })),
      projects: (parsedData.projects || []).map((p: any, i: number) => ({
        id: `proj-${i + 1}`,
        name: p.name || 'Project Name',
        description: p.description || '',
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        link: p.link || '',
        dates: p.dates || '',
      })),
      certifications: (parsedData.certifications || []).map((c: any, i: number) => {
        if (typeof c === 'string') {
          return { id: `cert-${i + 1}`, name: c, issuer: '', date: '', link: '' };
        }
        return {
          id: `cert-${i + 1}`,
          name: c.name || 'Certification Name',
          issuer: c.issuer || '',
          date: c.date || '',
          link: c.link || '',
        };
      }),
      rawText,
    };
  } catch (err: any) {
    console.warn('LLM parse call failed, using fallback parser:', err?.message || err);
    return fallbackParseCvFromText(rawText);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // One-time data fix: re-derive LinkedIn work-type labels that were
  // incorrectly defaulted to "Full-time · Remote" (idempotent).
  const fixedTypes = fixMislabeledWorkTypes();
  if (fixedTypes > 0) console.log(`[data-fix] Reclassified ${fixedTypes} mislabeled jobs`);
  // Repair malformed stored dates (doubled timestamps).
  const fixedDates = repairJobDates();
  if (fixedDates > 0) console.log(`[data-fix] Repaired ${fixedDates} malformed job dates`);

  // Session middleware: resolve the auth cookie to a user and make it
  // available to every handler (and storage call) for this request.
  app.use((req, _res, next) => {
    const cookieHeader = (req.headers.cookie || '').split(';').map((s) => s.trim());
    const match = cookieHeader.find((c) => c.startsWith('ats_session='));
    const token = match ? match.slice('ats_session='.length) : '';
    const userId = token ? getSessionUser(token) : undefined;
    if (userId) {
      runWithUser(userId, () => next());
    } else {
      runWithUser('', () => next());
    }
  });

  // Warn if a previously-committed (compromised) API key is still in use
  // Compromised keys stored as SHA-256 hashes (never plaintext in the repo).
  // Hash of the previously leaked key; compare by hashing the configured key.
  const COMPROMISED_KEY_HASHES = new Set(['a2117087d9a8d23cd2b4f14d61139102293d11bfc0faf57552d02b50f402274a']);
  const configuredKey = loadConfig().llm.apiKey;
  const configuredKeyHash = crypto.createHash('sha256').update(configuredKey || '').digest('hex');
  if (COMPROMISED_KEY_HASHES.has(configuredKeyHash)) {
    console.warn('\n==========================================================');
    console.warn('⚠️  SECURITY WARNING: Your API key was exposed in an old');
    console.warn('    public git commit. Anyone with repo history has it.');
    console.warn('    Generate a NEW key in your LLM provider dashboard and');
    console.warn('    paste it in Settings → LLM API Key (or config.ini).');
    console.warn('    Then revoke the old key on the provider side.');
    console.warn('==========================================================\n');
  }

  // Seed sample jobs if store is completely empty on initial startup.
  // Runs in the first user's context so the seed lands in a real account.
  const seedUser = (getDb().prepare('SELECT id FROM users ORDER BY is_guest ASC, created_at ASC LIMIT 1').get() as any)?.id as string | undefined;
  if (seedUser) {
    runWithUser(seedUser, () => {
      const initialJobs = getAllJobs();
      if (initialJobs.length === 0) {
        (async () => {
          const sampleScrape = await ScraperFactory.runScrape({
            keywords: 'Full Stack TypeScript Engineer',
            location: 'Remote',
            sources: ['LinkedIn'],
            maxJobsPerSource: 5,
          });
          saveNewJobs(sampleScrape);
        })();
      }
    });
  }

  // --- API ROUTES ---

  // Configuration routes
  app.get('/api/config', (req, res) => {
    res.json(loadConfig());
  });

  // Source registry — lets clients (and API consumers) see which sources
  // are Apify-powered and what each Apify source costs per 1K jobs.
  app.get('/api/sources', (_req, res) => {
    res.json({ sources: Object.values(SOURCES) });
  });

  app.post('/api/config', (req, res) => {
    try {
      saveConfig(req.body);
      res.json({ success: true, config: loadConfig() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test an LLM connection with the CURRENT form values (nothing is saved).
  app.post('/api/settings/test-llm', async (req, res) => {
    try {
      const { provider, apiKey, baseUrl, model } = req.body || {};
      const p = String(provider || 'opencode-go');
      const key = String(apiKey || '').trim();
      const mdl = String(model || '').trim();
      if (!key) {
        res.status(400).json({ ok: false, error: 'Enter an API key first.' });
        return;
      }
      if (!mdl) {
        res.status(400).json({ ok: false, error: 'Enter a model name first.' });
        return;
      }
      const started = Date.now();
      const check = async (): Promise<void> => {
        if (p === 'gemini') {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(key)}`;
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
          });
          if (!r.ok) throw new Error(`Gemini API error ${r.status}`);
          return;
        }
        if (p === 'anthropic') {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: mdl, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
          });
          if (!r.ok) throw new Error(`Anthropic API error ${r.status}`);
          return;
        }
        const base = String(baseUrl || '').trim().replace(/\/+$/, '');
        if (!base) throw new Error('Enter a Base URL first.');
        const r = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: mdl, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
        });
        if (!r.ok) throw new Error(`API error ${r.status}`);
      };
      await check();
      res.json({ ok: true, latencyMs: Date.now() - started });
    } catch (err: any) {
      console.error('LLM test failed:', err.message);
      res.status(502).json({ ok: false, error: String(err?.message || 'Connection failed.').slice(0, 300) });
    }
  });

  // Master CV routes (scoped to logged-in user)
  app.get('/api/cv/master', (req, res) => {
    const userId = getCurrentUserId();
    if (!userId) return res.status(401).json({ error: 'Not signed in.' });
    res.json(getMasterCv(userId));
  });

  app.post('/api/cv/master', (req, res) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return res.status(401).json({ error: 'Not signed in.' });
      saveMasterCv(req.body, userId);
      res.json({ success: true, cv: getMasterCv(userId) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Auth ──
  app.get('/api/auth/me', (req, res) => {
    const userId = getCurrentUserId();
    if (!userId) return res.json({ user: null });
    const user = getUserById(userId);
    res.json({ user: user ? { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } : null });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, name, recoveryQ1, recoveryA1, recoveryQ2, recoveryA2 } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'A valid email is required.' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      // Recovery questions are mandatory for password accounts (local
      // forgot-password mechanism — no email service exists).
      if (!recoveryQ1 || !recoveryA1 || !recoveryQ2 || !recoveryA2) {
        return res.status(400).json({ error: 'Please set two recovery questions (answers at least 3 characters).' });
      }
      if (String(recoveryA1).trim().length < 3 || String(recoveryA2).trim().length < 3) {
        return res.status(400).json({ error: 'Recovery answers must be at least 3 characters.' });
      }
      const displayName = (name || '').trim() || email.split('@')[0];
      const user = createUser(email, displayName, password, {
        q1: String(recoveryQ1).trim(),
        a1: String(recoveryA1),
        q2: String(recoveryQ2).trim(),
        a2: String(recoveryA2),
      });
      const token = createSession(user.id);
      res.cookie('ats_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 90 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } });
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  });

  // ── Password recovery (security questions, fully local) ──
  const recoveryAttempts = new Map<string, { count: number; lockedUntil: number }>();
  const MAX_RECOVERY_ATTEMPTS = 5;
  const RECOVERY_LOCK_MS = 5 * 60 * 1000;

  // Step 1: does this email exist and have recovery questions set?
  app.post('/api/auth/forgot-password/check', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const info = getRecoveryInfo(email);
    if (!info.exists) return res.status(404).json({ error: 'No account found with this email.' });
    if (!info.hasRecovery) {
      return res.status(400).json({ error: 'This account has no recovery questions set. Sign in and add them in Settings.' });
    }
    const lock = recoveryAttempts.get(email);
    if (lock && lock.lockedUntil > Date.now()) {
      const mins = Math.ceil((lock.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many attempts — try again in ${mins} minute(s).` });
    }
    res.json({ success: true, q1: info.q1, q2: info.q2 });
  });

  // Step 2: verify answers + set new password
  app.post('/api/auth/forgot-password/reset', (req, res) => {
    try {
      const { email, answer1, answer2, newPassword } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) return res.status(400).json({ error: 'Email is required.' });
      if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }
      const lock = recoveryAttempts.get(cleanEmail);
      if (lock && lock.lockedUntil > Date.now()) {
        const mins = Math.ceil((lock.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({ error: `Too many attempts — try again in ${mins} minute(s).` });
      }
      try {
        const user = resetPasswordWithRecovery(cleanEmail, String(answer1 || ''), String(answer2 || ''), String(newPassword));
        recoveryAttempts.delete(cleanEmail);
        res.json({ success: true, email: user.email });
      } catch (err: any) {
        const entry = recoveryAttempts.get(cleanEmail) || { count: 0, lockedUntil: 0 };
        entry.count += 1;
        if (entry.count >= MAX_RECOVERY_ATTEMPTS) {
          entry.lockedUntil = Date.now() + RECOVERY_LOCK_MS;
          entry.count = 0;
          recoveryAttempts.set(cleanEmail, entry);
          return res.status(429).json({ error: 'Too many wrong answers — locked for 5 minutes.' });
        }
        recoveryAttempts.set(cleanEmail, entry);
        return res.status(400).json({ error: err.message });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Authed: set/update recovery questions from Settings (needs current password)
  app.post('/api/auth/recovery-questions', (req, res) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return res.status(401).json({ error: 'Not signed in.' });
      const { currentPassword, recoveryQ1, recoveryA1, recoveryQ2, recoveryA2 } = req.body;
      if (!currentPassword || !recoveryQ1 || !recoveryA1 || !recoveryQ2 || !recoveryA2) {
        return res.status(400).json({ error: 'All fields are required.' });
      }
      if (String(recoveryA1).trim().length < 3 || String(recoveryA2).trim().length < 3) {
        return res.status(400).json({ error: 'Recovery answers must be at least 3 characters.' });
      }
      setRecoveryQuestions(userId, String(currentPassword), {
        q1: String(recoveryQ1).trim(),
        a1: String(recoveryA1),
        q2: String(recoveryQ2).trim(),
        a2: String(recoveryA2),
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const user = verifyLogin(email || '', password || '');
      if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
      const token = createSession(user.id);
      res.cookie('ats_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 90 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/guest', (req, res) => {
    try {
      const name = (req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Guest name is required.' });
      // Sign in to an existing guest, or create a new one
      let user = listUsers().find((u) => u.isGuest && u.name.toLowerCase() === name.toLowerCase());
      if (!user) {
        user = createUser(`guest-${Date.now()}@local`, name, undefined);
      }
      const token = createSession(user.id);
      res.cookie('ats_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 90 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookieHeader = (req.headers.cookie || '').split(';').map((s) => s.trim());
    const match = cookieHeader.find((c) => c.startsWith('ats_session='));
    if (match) deleteSession(match.slice('ats_session='.length));
    res.clearCookie('ats_session');
    res.json({ success: true });
  });

  // Existing guest accounts are listed so the login screen can offer one-click sign-in
  app.get('/api/auth/guests', (req, res) => {
    res.json({ guests: listUsers().filter((u) => u.isGuest).map((u) => ({ id: u.id, name: u.name, email: u.email })) });
  });

  // Skill Gaps - aggregate missing skills across all scored jobs
  app.get('/api/cv/skill-gaps', (req, res) => {
    try {
      const allJobs = getAllJobs();
      const scoredJobs = allJobs.filter((j) => j.gapAnalysis?.missingSkills?.length > 0);
      const gapCounts: Record<string, { count: number; totalScored: number }> = {};

      for (const job of scoredJobs) {
        const allMissing = [
          ...(job.gapAnalysis?.missingSkills || []),
          ...(job.gapAnalysis?.missingKeywords || []),
        ];
        for (const skill of allMissing) {
          const key = skill.toLowerCase().trim();
          if (!key) continue;
          if (!gapCounts[key]) gapCounts[key] = { count: 0, totalScored: scoredJobs.length };
          gapCounts[key].count++;
        }
      }

      const gaps = Object.entries(gapCounts)
        .map(([skill, data]) => ({ skill, count: data.count, totalScored: data.totalScored }))
        .sort((a, b) => b.count - a.count);

      res.json({ gaps, totalScored: scoredJobs.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download Master CV
  app.get('/api/cv/master/download', async (req, res) => {
    try {
      const m = getMasterCv();
      const format = ((req.query.format as string) || 'pdf').toLowerCase();

      const masterAsTailored = masterCvToTailoredCv(m);

      const safeName = m.fullName.replace(/ /g, '_');
      const filename = `${safeName}_Master_CV`;
      const template = (req.query.template as string) || (['harvard', 'jake', 'atanu', 'atanu-pro'].includes(m.templateId || '') ? m.templateId : 'harvard');

      if (format === 'pdf') {
        const pdfBuffer = await generatePdfBuffer(masterAsTailored, template);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'txt') {
        const textCv = generatePlainTextCv(masterAsTailored);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        res.send(textCv);
      } else {
        const pdfBuffer = await generatePdfBuffer(masterAsTailored, template);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfBuffer);
      }
    } catch (err: any) {
      console.error('Master CV download error:', err);
      res.status(500).json({ error: 'Failed to generate master CV document.' });
    }
  });

  app.post('/api/cv/improve-summary', async (req, res) => {
    try {
      const { summary, experiences, skills, certifications, fullName } = req.body;
      if (!summary || typeof summary !== 'string' || !summary.trim()) {
        res.status(400).json({ error: 'Summary is required.' });
        return;
      }

      const prompt = `You are an elite Executive Resume Writer. The candidate wants improved versions of their professional summary.

CURRENT SUMMARY:
"""${summary}"""

CANDIDATE CONTEXT:
Name: ${fullName || 'Candidate'}
Work Experience:
${JSON.stringify(experiences || [], null, 2)}
Skills:
${JSON.stringify(skills || [], null, 2)}
Certifications:
${JSON.stringify(certifications || [], null, 2)}

Write 3 improved professional summary options (2-3 sentences each). Rules:
- Never fabricate skills, companies, or achievements.
- Use strong action verbs and quantify impact where facts allow.
- Each option should have a distinct tone: (1) Concise & Impact-Driven, (2) Leadership-Focused, (3) Skill-Dense for ATS keyword matching.
- Do NOT invent new experience. Only rephrase and emphasize what exists.

Return valid JSON only — NO markdown, NO code fences:
{
  "options": [
    { "label": "Concise & Impact-Driven", "text": "..." },
    { "label": "Leadership-Focused", "text": "..." },
    { "label": "Skill-Dense (ATS)", "text": "..." }
  ]
}`;

      const jsonText = await ask(prompt, 0.4);
      const parsed = JSON.parse(jsonText);
      const options = Array.isArray(parsed.options) ? parsed.options.slice(0, 3) : [];

      res.json({ success: true, options });
    } catch (err: any) {
      console.error('Improve summary error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate summary suggestions.' });
    }
  });

  // ── AI CV Compression ──
  app.post('/api/cv/ai/analyze', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const masterCv = getMasterCv();
      if (!masterCv) {
        res.status(400).json({ error: 'No master CV found. Create one first.' });
        return;
      }
      const targetRole = (req.body?.targetRole as string)?.trim() || masterCv.experiences?.[0]?.title || '';
      if (!targetRole) {
        res.status(400).json({ error: 'Cannot determine target role from the CV.' });
        return;
      }
      const marketData = getMarketData(targetRole);
      const result = await compressCv(masterCv, targetRole, marketData);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('AI compress analyze error:', err);
      const mapped = mapLlmError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/cv/ai/accept', async (req, res) => {
    try {
      const compressed = req.body?.compressedCv;
      if (!compressed || typeof compressed !== 'object') {
        res.status(400).json({ error: 'compressedCv is required.' });
        return;
      }
      const masterCv = getMasterCv();
      if (!masterCv) {
        res.status(400).json({ error: 'No master CV found.' });
        return;
      }

      // Backup current CV before overwriting
      saveCvVersion(masterCv, `Before AI compression (${masterCv.fullName})`);

      const exp = (compressed.workExperience || []).map((e: any, i: number) => ({
        id: `exp-${Date.now()}-${i}`,
        title: e.title || '',
        company: e.company || '',
        location: e.location || '',
        dates: e.dates || '',
        responsibilities: Array.isArray(e.highlights) ? e.highlights : [],
      }));
      const education = (compressed.education || []).map((e: any, i: number) => ({
        id: `edu-${Date.now()}-${i}`,
        degree: e.degree || '',
        institution: e.institution || '',
        dates: e.dates || '',
        details: e.details || '',
      }));
      const skills = (compressed.technicalSkills || []).map((s: any) => ({
        category: s.category || 'Skills',
        items: Array.isArray(s.skills) ? s.skills : [],
      }));
      if (skills.length === 0 && Array.isArray(compressed.coreCompetencies)) {
        skills.push({ category: 'Core Competencies', items: compressed.coreCompetencies });
      }
      const projects = (compressed.projects || []).map((p: any, i: number) => ({
        id: `proj-${Date.now()}-${i}`,
        name: p.name || '',
        description: p.description || '',
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        link: p.link,
        dates: p.dates,
      }));
      const certifications = (compressed.certifications || []).map((c: any, i: number) =>
        typeof c === 'string'
          ? { id: `cert-${Date.now()}-${i}`, name: c }
          : { id: `cert-${Date.now()}-${i}`, name: c.name || '', issuer: c.issuer, date: c.date, link: c.link }
      );

      const newCv: MasterCv = {
        fullName: compressed.candidateName || masterCv.fullName,
        email: compressed.contactInfo?.email || masterCv.email,
        phone: compressed.contactInfo?.phone || masterCv.phone,
        location: compressed.contactInfo?.location || masterCv.location,
        linkedin: compressed.contactInfo?.linkedin || masterCv.linkedin,
        github: compressed.contactInfo?.github || masterCv.github,
        website: compressed.contactInfo?.website || masterCv.website,
        summary: compressed.professionalSummary || masterCv.summary,
        experiences: exp,
        education,
        skills,
        projects,
        certifications,
        rawText: masterCv.rawText,
        downloadFilename: masterCv.downloadFilename,
        templateId: masterCv.templateId,
      };
      saveMasterCv(newCv);
      res.json({ success: true, cv: getMasterCv() });
    } catch (err: any) {
      console.error('AI compress accept error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cv/versions', (req, res) => {
    res.json({ versions: listCvVersions() });
  });

  app.post('/api/cv/versions/:id/restore', (req, res) => {
    try {
      const version = getCvVersion(req.params.id);
      if (!version) {
        res.status(404).json({ error: 'Version not found.' });
        return;
      }
      saveCvVersion(getMasterCv(), `Before restore of ${req.params.id.slice(-6)}`);
      saveMasterCv(version.data);
      res.json({ success: true, cv: getMasterCv() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cv/versions/:id', (req, res) => {
    res.json({ success: deleteCvVersion(req.params.id) });
  });

  // ── Job portal bookmarks (per user) ──
  app.get('/api/portals/bookmarks', (req, res) => {
    res.json({ bookmarks: listPortalBookmarks() });
  });

  app.post('/api/portals/bookmarks', (req, res) => {
    const { portalName } = req.body || {};
    if (!portalName || typeof portalName !== 'string') {
      res.status(400).json({ error: 'portalName is required.' });
      return;
    }
    res.json({ success: addPortalBookmark(portalName.trim()) });
  });

  app.delete('/api/portals/bookmarks/:name', (req, res) => {
    res.json({ success: removePortalBookmark(decodeURIComponent(req.params.name)) });
  });

  app.post('/api/cv/parse-text', async (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        res.status(400).json({ error: 'rawText string is required' });
        return;
      }

      const formattedCv = await parseCvWithLLM(rawText);
      res.json({ success: true, cv: formattedCv });
    } catch (err: any) {
      console.error('Error parsing resume text:', err);
      res.status(500).json({ error: err.message || 'Failed to parse resume text' });
    }
  });

  app.post('/api/cv/upload-file', (req, res, next) => {
    upload.any()(req, res, (err: any) => {
      if (err) {
        console.error('Multer file upload error:', err);
        return res.status(400).json({ error: err.message || 'File upload failed. Please ensure file size is under 15MB.' });
      }
      next();
    });
  }, async (req: express.Request, res: express.Response) => {
    try {
      const files = (req as any).files;
      const uploadedFile = (files && files.length > 0) ? files[0] : (req as any).file;

      if (!uploadedFile) {
        res.status(400).json({ error: 'No file uploaded. Please select a PDF, DOCX, or TXT file.' });
        return;
      }

      const originalName = uploadedFile.originalname || 'uploaded_resume';
      const formattedCv = await parseCvWithLLM({
        buffer: uploadedFile.buffer,
        mimeType: uploadedFile.mimetype,
        originalName,
      });

      res.json({ success: true, cv: formattedCv, fileName: originalName });
    } catch (err: any) {
      console.error('Error parsing uploaded resume file:', err);
      res.status(500).json({ error: err.message || 'Failed to extract resume from file' });
    }
  });

  // Scrape Jobs
  app.post('/api/jobs/scrape', async (req, res) => {
    try {
      const { keywords, location, sources, datePostedFilter, jobType, minSalary, maxJobsPerSource, jobTitle, contractType, experienceLevel, under10Applicants } = req.body;

      if (!keywords || !keywords.trim()) {
        res.status(400).json({ error: 'Keywords parameter is required.' });
        return;
      }

      const wantUnder10 = under10Applicants === true;

      // skipJobId: tell the Apify actor to skip LinkedIn jobs we already have
      // (avoids re-fetching and re-paying for duplicates).
      let jobIds: string[] = [];
      try {
        const existing = getAllJobs().filter((j) => j.source === 'LinkedIn' && j.id.startsWith('linkedin-'));
        jobIds = existing
          .map((j) => j.id.replace(/^linkedin-/, ''))
          .filter((id) => /^\d+$/.test(id))
          .slice(0, 1000);
      } catch { jobIds = []; }

      const scrapedJobsRaw = await ScraperFactory.runScrape({
        keywords: keywords.trim(),
        location: location || 'Remote',
        sources,
        datePostedFilter: datePostedFilter || 'all',
        jobType: jobType || 'all',
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxJobsPerSource: maxJobsPerSource ? Number(maxJobsPerSource) : 15,
        jobTitle: jobTitle?.trim() || undefined,
        contractType: contractType || undefined,
        experienceLevel: experienceLevel || undefined,
        under10Applicants: wantUnder10,
        jobIds,
      });

      // Deterministic "under 10 applicants" guarantee: LinkedIn's f_AL=true
      // filter is unreliable on the guest API, and other sources don't expose
      // applicant counts at all. Post-filter on the scraped applicantCount so
      // the option always delivers what it promises. LinkedIn jobs showing
      // "Be among the first N applicants" are flagged lowCompetition — those
      // are exactly the low-competition roles this option targets.
      const scrapedJobs = wantUnder10
        ? scrapedJobsRaw.filter((j) => j.lowCompetition === true || (j.applicantCount !== undefined && j.applicantCount <= 10))
        : scrapedJobsRaw;

      const filteredOutCount = scrapedJobsRaw.length - scrapedJobs.length;

      // Descriptions are stored exactly as scraped — the user runs these
      // sources with their own official Apify key, so no contact stripping.
      const { added, skipped, newContacts } = saveNewJobs(scrapedJobs);

      res.json({
        success: true,
        scrapedTotal: scrapedJobs.length,
        addedCount: added.length,
        skippedDuplicates: skipped,
        filteredOutCount,
        skippedSources: ScraperFactory.lastSkippedSources,
        newContacts: newContacts.map((c) => ({
          name: c.name,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp,
          recruiterUrl: c.recruiterUrl,
          company: c.company,
        })),
      });
    } catch (err: any) {
      console.error('Scrape error:', err);
      res.status(500).json({ error: err.message || 'Scraping failed.' });
    }
  });

  // Generic URL-based job description scraper
  app.post('/api/scrape-full-text', async (req, res) => {
    try {
      const { jobUrl } = req.body;
      if (!jobUrl || typeof jobUrl !== 'string') {
        res.status(400).json({ error: 'jobUrl string is required.' });
        return;
      }

      const { scrapeJobDescription } = await import('./server/scraper/genericScraper.js');
      const result = await scrapeJobDescription(jobUrl);

      if (!result) {
        res.status(422).json({ error: 'Could not extract job description from the provided URL.' });
        return;
      }

      res.json({ success: true, text: result.text, source: result.source });
    } catch (err: any) {
      console.error('Generic scrape error:', err);
      res.status(500).json({ error: err.message || 'Scraping failed.' });
    }
  });

  // Job stats for KPI dashboard (counts computed server-side from all jobs)
  app.get('/api/jobs/stats', (req, res) => {
    try {
      const all = getAllJobs();
      const pending = all.filter((j) => j.state === 'pending').length;
      const matched = all.filter((j) => j.state === 'matched' || j.state === 'tailored' || j.state === 'ready').length;
      const tailored = all.filter((j) => j.state === 'tailored' || j.state === 'ready').length;
      const applied = all.filter((j) => j.state === 'applied').length;
      const scored = all.filter((j) => j.matchScore !== undefined);
      const avgScore = scored.length > 0
        ? Math.round(scored.reduce((acc, j) => acc + (j.matchScore || 0), 0) / scored.length)
        : 0;

      const byState: Record<string, number> = { pending: 0, matched: 0, tailored: 0, ready: 0, applied: 0 };
      for (const j of all) if (byState[j.state] !== undefined) byState[j.state]++;

      res.json({ total: all.length, pending, matched, tailored, applied, scoredCount: scored.length, avgScore, byState });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Jobs list with filters & pagination
  // HR / Recruiter contacts
  app.get('/api/contacts', (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const company = typeof req.query.company === 'string' ? req.query.company : '';
      res.json({ contacts: listContacts({ q, company }), companies: listContactCompanies() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/jobs/:id/contacts', (req, res) => {
    try {
      const job = getJobById(req.params.id);
      const contacts = listContactsForJob(req.params.id, job?.recruiterUrl);
      res.json({ contacts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/:id/hide', (req, res) => {
    try {
      res.json({ success: setContactHidden(req.params.id, true) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/:id/unhide', (req, res) => {
    try {
      res.json({ success: setContactHidden(req.params.id, false) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/contacts/stats', (req, res) => {
    try {
      res.json({ stats: getContactStats() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/:id/notes', (req, res) => {
    try {
      const note = typeof req.body?.note === 'string' ? req.body.note : '';
      res.json({ success: addContactNote(req.params.id, note) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/:id/followup', (req, res) => {
    try {
      const date = typeof req.body?.date === 'string' && req.body.date ? req.body.date : null;
      res.json({ success: setContactFollowUp(req.params.id, date) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/:id/followedup', (req, res) => {
    try {
      res.json({ success: setContactFollowedUp(req.params.id, !!req.body?.value) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/:id/pipeline', (req, res) => {
    try {
      const status = typeof req.body?.status === 'string' ? req.body.status : null;
      res.json({ success: setContactPipeline(req.params.id, status) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/contacts/:id/emails', (req, res) => {
    try {
      res.json({ emails: listContactEmails(req.params.id) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/emails/templates', (req, res) => {
    try {
      res.json({ templates: listEmailTemplates() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/emails/templates', (req, res) => {
    try {
      const { name, subject, body } = req.body || {};
      if (!name?.trim() || !subject?.trim() || !body?.trim()) {
        return res.status(400).json({ error: 'Name, subject and body are required.' });
      }
      res.json({ template: saveEmailTemplate({ name, subject, body }) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/emails/templates/:id', (req, res) => {
    try {
      res.json({ success: deleteEmailTemplate(req.params.id) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/contacts/export', (req, res) => {
    try {
      const rows = listContactsCsv();
      const esc = (v: string | null): string => {
        const s = v ?? '';
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        'Email,Name,Company,Job Role,Phone,WhatsApp,LinkedIn,Type,Context,Last Seen',
        ...rows.map((r) => [r.email, r.name, r.company, r.jobRole, r.phone, r.whatsapp ? 'yes' : '', r.recruiterUrl, r.typeLabel, r.context, r.lastSeen].map(esc).join(',')),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="recruiters.csv"');
      res.send('\uFEFF' + lines.join('\r\n'));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/contacts/bulk-hide', (req, res) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const count = ids.filter((id) => setContactHidden(id, true)).length;
      res.json({ success: count > 0, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cold email (L2 SMTP) ────────────────────────────────────────────────

  // AI-draft a cold email for a recruiter contact (personalized from their
  // job posting + the candidate's own Master CV). Nothing is sent here.
  app.post('/api/emails/draft', async (req, res) => {
    try {
      const { contactId } = req.body || {};
      const contact = getContactById(contactId);
      if (!contact) {
        res.status(404).json({ error: 'Contact not found.' });
        return;
      }
      const masterCv = getMasterCv();
      const job = contact.sourceJobId ? getJobById(contact.sourceJobId) : undefined;
      const name = contact.name || contact.recruiterName || 'there';
      const company = contact.company || job?.company || 'your company';
      const role = job?.title || contact.jobRole || 'the role';
      const firstName = (contact.name || contact.recruiterName || '').trim().split(/\s+/)[0] || '';
      // Heuristic: only greet with a first name when it actually looks like
      // a personal name. Extracted "names" are often companies or
      // departments ("Company Mob", "Talent Acquisition", "O CLRS").
      const NON_NAME_TOKENS = ['talent', 'acquisition', 'delivery', 'consulting', 'recruiting', 'recruitment', 'careers', 'company', 'mob', 'hr', 'team', 'sourcing', 'staffing', 'people', 'support', 'operations', 'engineering', 'hiring'];
      const companyFirst = company.trim().split(/\s+/)[0]?.toLowerCase() || '';
      const firstLower = firstName.toLowerCase();
      const looksLikeName =
        firstName.length >= 4 &&
        !NON_NAME_TOKENS.includes(firstLower) &&
        firstLower !== companyFirst &&
        contact.type !== 'careers';
      const greetingName = looksLikeName ? firstName : '';

      const prompt = `You are a senior career coach writing a cold outreach email that reads like a real human wrote it.

Recruiter name: ${name}
Company: ${company}
Role they are hiring for: ${role}
Job description (if available): ${(job?.description || '').slice(0, 1200)}
Candidate: ${masterCv?.fullName || 'the candidate'}
Candidate summary: ${(masterCv?.summary || '').slice(0, 600)}
Candidate location: ${masterCv?.location || ''}

Rules — this must feel human, not AI:
- FIRST LINE: a greeting — literally "${greetingName ? 'Hi ' + greetingName + ',' : 'Hi there,'}" followed by a newline, then continue with the email. Nothing may appear before the greeting.
- Write in the FIRST PERSON as the candidate: always "I", "my", "me". Never refer to the candidate by name, and never write in the third person ("he/she/their CV").
- 55-80 words total (excluding the greeting and signature). Three short paragraphs maximum, ideally two.
- No AI-sounding phrases. NEVER use: "I'm writing to express", "I hope this email finds you well", "I would be glad", "Would you be open to", "leverage", "passionate", "delve", "I trust this", exclamation marks.
- Open with a direct, specific line tied to their role or company (one sentence).
- Middle: ONE concrete link between the candidate's experience and their opening. No buzzword lists.
- Close with a soft, natural ask (e.g. "Happy to chat briefly this week if it's useful.") — not a formal request.
- Do NOT include any signature, name, phone, or sign-off in the body — the system adds it.
- Sign nothing. No "Best regards". No name at the end.

Return valid JSON only, no markdown:
{ "subject": string (max 8 words, no fluff), "body": string }`;

      const raw = await ask(prompt, 0.5);
      const parsed = JSON.parse(raw);
      const body = String(parsed.body || '').trim();
      // Deterministic signature: candidate name, then their saved phone and
      // portfolio URL (from the Master CV) — each line only when it exists.
      // The portfolio keeps its full https:// URL so mail clients render it
      // as a clickable link in the sent email.
      const nameLine = masterCv?.fullName ? masterCv.fullName.trim() : '';
      const phoneLine = masterCv?.phone ? masterCv.phone.trim() : '';
      const portfolioLine = masterCv?.website ? masterCv.website.trim() : '';
      const signature = [nameLine, phoneLine, portfolioLine].filter(Boolean).join('\n');
      res.json({
        success: true,
        draft: {
          to: contact.email || '',
          subject: String(parsed.subject || '').slice(0, 160),
          body: body ? `${body}\n\n${signature}` : '',
        },
      });
    } catch (err: any) {
      console.error('Email draft error:', err);
      res.status(500).json({ error: 'Failed to draft email.' });
    }
  });

  // AI-enrich a contact's identity (name / job role) from LinkedIn + job context.
  app.post('/api/contacts/:id/enrich', async (req, res) => {
    try {
      const contact = getContactById(req.params.id);
      if (!contact) { res.status(404).json({ error: 'Contact not found.' }); return; }
      const job = contact.sourceJobId ? getJobById(contact.sourceJobId) : undefined;
      const prompt = `You are a recruiting-database curator. Given the following clues about an HR/recruiter contact, infer the person's real name (or null), job title (or null), and LinkedIn headline (or null). Respond ONLY with JSON: {"name": string|null, "title": string|null, "headline": string|null}.

Contact:
- current name: ${contact.name || contact.recruiterName || 'unknown'}
- company: ${contact.company || 'unknown'}
- role/context: ${contact.jobRole || 'unknown'}
- context quote: ${contact.context || 'none'}
- LinkedIn URL: ${contact.recruiterUrl || 'none'}
- job posting: ${job?.title || 'none'} at ${job?.company || 'unknown'}

Rules: if the name looks like a company/department ("Talent Acquisition", "Company Mob"), return null for name. Never invent an email or phone.`;
      const raw = await ask(prompt, 0.1);
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
      const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;
      const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null;
      updateContactIdentity(contact.id, { name, jobRole: title });
      res.json({ success: true, contact: { ...contact, name: name ?? contact.name, jobRole: title ?? contact.jobRole } });
    } catch (err: any) {
      console.error('Contact enrich error:', err);
      res.status(500).json({ error: 'Failed to enrich contact.' });
    }
  });

  // Send a cold email through the user's own SMTP (from Settings → Email).
  // Optional attachment: attachMaster generates the Master CV PDF on the
  // fly; attachment { filename, data(base64) } attaches an uploaded file.
  app.post('/api/emails/send', async (req, res) => {
    try {
      const { contactId, to, subject, body, attachMaster, attachment } = req.body || {};
      const emailCfg = loadConfig().email;
      if (!emailCfg.host || !emailCfg.user || !emailCfg.password) {
        res.status(400).json({ error: 'SMTP is not configured — add it in Settings → Email.' });
        return;
      }
      if (!to || !String(to).includes('@')) {
        res.status(400).json({ error: 'A valid recipient email is required.' });
        return;
      }
      if (!subject || !body) {
        res.status(400).json({ error: 'Subject and body are required.' });
        return;
      }

      const transport = nodemailer.createTransport({
        host: emailCfg.host,
        port: Number(emailCfg.port) || 587,
        secure: emailCfg.secure === true,
        auth: { user: emailCfg.user, pass: emailCfg.password },
        tls: { rejectUnauthorized: false },
      });

      const fromLabel = (emailCfg.fromName || '').trim();
      const from = fromLabel ? `"${fromLabel}" <${emailCfg.user}>` : emailCfg.user;

      // Build attachments: Master CV PDF and/or an uploaded file (one of
      // each max — the UI offers both options, user picks one).
      const attachments: any[] = [];
      if (attachMaster) {
        const m = getMasterCv();
        if (m && m.fullName) {
          const masterTemplate = ['harvard', 'jake', 'atanu', 'atanu-pro'].includes(m.templateId || '') ? m.templateId : 'harvard';
          const pdf = await generatePdfBuffer(masterCvToTailoredCv(m), masterTemplate);
          const cvName = m.downloadFilename || `${m.fullName.replace(/\s+/g, '_')}_CV`;
          attachments.push({ filename: `${cvName}.pdf`, content: pdf });
        }
      }
      if (attachment && typeof attachment.filename === 'string' && typeof attachment.data === 'string') {
        attachments.push({ filename: attachment.filename, content: Buffer.from(attachment.data, 'base64') });
      }

      const info = await transport.sendMail({
        from,
        to: String(to).trim(),
        subject: String(subject),
        text: String(body),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (contactId) {
        recordContactEmail(contactId, 'sent', info.messageId);
        recordContactEmailDetail(contactId, {
          recipient: to, subject, body,
          attachmentName: attachMaster ? 'Master CV' : (attachment?.filename || null),
          status: 'sent',
        });
      }
      res.json({ success: true, messageId: info.messageId });
    } catch (err: any) {
      if (req.body?.contactId) {
        recordContactEmail(req.body.contactId, 'failed');
        recordContactEmailDetail(req.body.contactId, {
          recipient: req.body.to,
          subject: req.body.subject,
          body: req.body.body,
          status: 'failed',
        });
      }
      console.error('Email send error:', err);
      res.status(500).json({ error: err?.message || 'Failed to send email.' });
    }
  });

  // Verify the configured SMTP credentials (Settings → Email → Test connection).
  // If the connection fails with a TLS/plaintext mismatch (e.g. SSL on a
  // STARTTLS port or vice versa), retry once with the secure flag flipped
  // and report which mode worked.
  app.post('/api/emails/test', async (req, res) => {
    try {
      const { host, port, secure, user, password } = req.body || {};
      if (!host || !user || !password) {
        res.status(400).json({ ok: false, error: 'Host, username and password are required.' });
        return;
      }
      const attempt = async (useSecure: boolean) => {
        const transport = nodemailer.createTransport({
          host: String(host),
          port: Number(port) || 587,
          secure: useSecure,
          auth: { user: String(user), pass: String(password) },
          tls: { rejectUnauthorized: false },
        });
        await transport.verify();
        return useSecure;
      };
      try {
        await attempt(secure === true);
        res.json({ ok: true });
      } catch (firstErr: any) {
        const msg = String(firstErr?.message || '');
        const tlsMismatch = /SSL|TLS|wrong version|handshake|ECONNRESET|socket hang up/i.test(msg);
        if (tlsMismatch) {
          try {
            const worked = await attempt(secure !== true);
            res.json({ ok: true, autoCorrected: true, secureUsed: worked, note: `Connected with ${worked ? 'SSL' : 'STARTTLS'} — the SSL/TLS toggle was adjusted automatically.` });
            return;
          } catch { /* fall through to the original error */ }
        }
        res.status(400).json({ ok: false, error: msg.includes('Invalid login') || msg.includes('535') || msg.includes('authentication')
          ? 'Authentication failed — check username and password (Gmail needs an App Password).'
          : `${msg}${tlsMismatch ? ' — check the SSL/TLS toggle: port 465 uses SSL, port 587 uses STARTTLS.' : ''}` });
      }
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err?.message || 'Connection failed.' });
    }
  });

  app.get('/api/jobs', (req, res) => {
    try {
      const queryParams: JobFilterQueryParams = {
        state: (req.query.state as any) || 'all',
        source: (req.query.source as any) || 'all',
        search: (req.query.search as string) || '',
        jobType: (req.query.jobType as any) || 'all',
        location: (req.query.location as string) || '',
        datePostedFilter: (req.query.datePostedFilter as any) || 'all',
        under10Applicants: req.query.under10Applicants === 'true',
        minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
        maxScore: req.query.maxScore ? Number(req.query.maxScore) : undefined,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 25,
      };

      const result = queryJobs(queryParams);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single job details
  app.get('/api/jobs/:id', (req, res) => {
    const job = getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }
    res.json(job);
  });

  // Single Job Match Scoring
  app.post('/api/jobs/:id/match', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const job = getJobById(req.params.id);
      if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }

      const masterCv = getMasterCv();
      const config = loadConfig();
      const matcher = new LlmMatcher();

      const result = await matcher.matchJob(
        job,
        masterCv,
        config.thresholds.earlyBlockThreshold
      );

      const updatedJob = updateJobInStorage({
        ...job,
        matchScore: result.matchScore,
        gapAnalysis: result.gapAnalysis,
        state: result.isEarlyBlocked ? 'pending' : 'matched',
        matchedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        matchScore: result.matchScore,
        gapAnalysis: result.gapAnalysis,
        isEarlyBlocked: result.isEarlyBlocked,
        job: updatedJob,
      });
    } catch (err: any) {
      const mapped = mapLlmError(err);
      console.error('Match error:', err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Batch Job Match Scoring (Score all pending)
  app.post('/api/jobs/batch-match', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const { jobIds } = req.body || {};
      const allJobs = getAllJobs();
      const targetJobs = jobIds && jobIds.length > 0
        ? allJobs.filter((j) => jobIds.includes(j.id))
        : allJobs.filter((j) => j.state === 'pending');

      const masterCv = getMasterCv();
      const config = loadConfig();
      const matcher = new LlmMatcher();

      // Process concurrently (bounded) so a large batch finishes fast
      // and the rest of the app keeps working.
      const CONCURRENCY = 3;
      const updatedResults: any[] = [];
      let cursor = 0;

      const worker = async () => {
        while (cursor < targetJobs.length) {
          const job = targetJobs[cursor++];
          try {
            const result = await matcher.matchJob(
              job,
              masterCv,
              config.thresholds.earlyBlockThreshold
            );

            const updated = updateJobInStorage({
              ...job,
              matchScore: result.matchScore,
              gapAnalysis: result.gapAnalysis,
              state: result.isEarlyBlocked ? 'pending' : 'matched',
              matchedAt: new Date().toISOString(),
            });

            updatedResults.push(updated);
          } catch (err) {
            console.warn(`Batch match failed for job ${job.id}:`, err);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targetJobs.length) }, () => worker()));

      res.json({
        success: true,
        processedCount: updatedResults.length,
        jobs: updatedResults,
      });
    } catch (err: any) {
      const mapped = mapLlmError(err);
      console.error('Batch match error:', err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Tailor CV for Single Job
  app.post('/api/jobs/:id/tailor', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const job = getJobById(req.params.id);
      if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }

      let jobToTailor = job;
      if (!job.gapAnalysis) {
        const masterCv = getMasterCv();
        const matcher = new LlmMatcher();
        const matchResult = await matcher.matchJob(job, masterCv);
        jobToTailor = updateJobInStorage({
          ...job,
          matchScore: matchResult.matchScore,
          gapAnalysis: matchResult.gapAnalysis,
          state: 'matched',
          matchedAt: new Date().toISOString(),
        });
      }

      const masterCv = getMasterCv();
      const tailorEngine = new LlmCvTailor();

      const tailoredCv = await tailorEngine.tailorCv(jobToTailor, masterCv);

      const updatedJob = updateJobInStorage({
        ...jobToTailor,
        tailoredCv,
        state: 'tailored',
        tailoredAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        tailoredCv,
        job: updatedJob,
      });
    } catch (err: any) {
      const mapped = mapLlmError(err);
      console.error('Tailor CV error:', err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Batch Tailor CVs for Matched Jobs (>= threshold)
  app.post('/api/jobs/batch-tailor', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const config = loadConfig();
      const minScore = config.thresholds.minMatchForTailor;

      const allJobs = getAllJobs();
      const candidateJobs = allJobs.filter(
        (j) => j.state === 'matched' && (j.matchScore || 0) >= minScore
      );

      const masterCv = getMasterCv();
      const tailorEngine = new LlmCvTailor();

      // Process concurrently (bounded) so a large batch finishes fast
      // and the rest of the app keeps working.
      const CONCURRENCY = 3;
      const tailoredResults: any[] = [];
      let cursor = 0;

      const worker = async () => {
        while (cursor < candidateJobs.length) {
          const job = candidateJobs[cursor++];
          try {
            const tailoredCv = await tailorEngine.tailorCv(job, masterCv);

            const updated = updateJobInStorage({
              ...job,
              tailoredCv,
              state: 'tailored',
              tailoredAt: new Date().toISOString(),
            });

            tailoredResults.push(updated);
          } catch (err) {
            console.warn(`Batch tailor failed for job ${job.id}:`, err);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidateJobs.length) }, () => worker()));

      res.json({
        success: true,
        processedCount: tailoredResults.length,
        jobs: tailoredResults,
      });
    } catch (err: any) {
      const mapped = mapLlmError(err);
      console.error('Batch tailor error:', err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Analyze a manual JD (no scraping needed)
  const manualResults = new Map<string, { tailoredCv: any; title: string; company: string }>();

  app.post('/api/analyze-jd', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const { title, company, description } = req.body;
      if (!title || !description) {
        res.status(400).json({ error: 'Title and description are required.' });
        return;
      }

      const masterCv = getMasterCv();
      if (!masterCv) {
        res.status(400).json({ error: 'No master CV found. Create one first.' });
        return;
      }

      const virtualJob: Job = {
        id: `manual-${Date.now()}`,
        title: title.trim(),
        company: company?.trim() || 'Unknown Company',
        location: 'Remote',
        source: 'Custom',
        description: description.trim(),
        url: '',
        postedDate: new Date().toISOString(),
        postedDateParsed: new Date().toISOString().split('T')[0],
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Match only — no tailoring yet
      const matcher = new LlmMatcher();
      const matchResult = await matcher.matchJob(virtualJob, masterCv);

      // Persist to history (per user)
      let historyId: string | undefined;
      try {
        const saved = saveManualAnalysis({
          role: virtualJob.title,
          company: virtualJob.company,
          description: virtualJob.description,
          score: matchResult.matchScore,
          gapAnalysis: matchResult.gapAnalysis,
          diff: null,
          tailoredCv: null,
        });
        historyId = saved.id;
      } catch (err) {
        console.warn('Manual JD history save failed:', err);
      }

      res.json({
        success: true,
        matchScore: matchResult.matchScore,
        gapAnalysis: matchResult.gapAnalysis,
        historyId,
      });
    } catch (err: any) {
      console.error('Analyze JD error:', err);
      const mapped = mapLlmError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Tailor a manually analyzed JD (separate step after user updates master CV)
  app.post('/api/analyze-jd/tailor', async (req, res) => {
    if (!hasApiKeyConfigured()) {
      res.status(428).json({ error: 'No API token configured — add your API key in Settings. This process will not run.', code: 'no_api_key' });
      return;
    }
    try {
      const { title, company, description, gapAnalysis, matchScore, historyId, includeSkills } = req.body;
      if (!title || !description) {
        res.status(400).json({ error: 'Title and description are required.' });
        return;
      }

      const masterCv = getMasterCv();
      if (!masterCv) {
        res.status(400).json({ error: 'No master CV found. Create one first.' });
        return;
      }

      const virtualJob: Job = {
        id: `manual-${Date.now()}`,
        title: title.trim(),
        company: company?.trim() || 'Unknown Company',
        location: 'Remote',
        source: 'Custom',
        description: description.trim(),
        url: '',
        postedDate: new Date().toISOString(),
        postedDateParsed: new Date().toISOString().split('T')[0],
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Pass through the analysis so the tailor engine knows what to integrate
        ...(gapAnalysis ? { gapAnalysis } : {}),
        ...(matchScore !== undefined ? { matchScore: Number(matchScore) } : {}),
      };

      const tailorEngine = new LlmCvTailor();
      const tailoredCv = await tailorEngine.tailorCv(
        virtualJob,
        masterCv,
        Array.isArray(includeSkills) && includeSkills.length > 0 ? { includeSkills } : undefined
      );

      const token = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      manualResults.set(token, {
        tailoredCv,
        title: virtualJob.title,
        company: virtualJob.company,
      });
      setTimeout(() => manualResults.delete(token), 30 * 60 * 1000);

      // Per-bullet before → after diff: pair each original responsibility
      // with its tailored highlight so the UI can show exactly what changed.
      const bulletRewrites: { original: string; rewritten: string }[] = [];
      const origExps = masterCv.experiences || [];
      const newExps = tailoredCv.workExperience || [];
      origExps.forEach((exp, i) => {
        const newExp = newExps[i];
        if (!newExp) return;
        (exp.responsibilities || []).forEach((orig, j) => {
          const rewritten = newExp.highlights?.[j];
          if (rewritten && String(rewritten).trim() !== String(orig).trim()) {
            bulletRewrites.push({ original: String(orig), rewritten: String(rewritten) });
          }
        });
      });

      // Diff payload for the UI's "what we add & why" panel
      const audit = tailoredCv.audit;
      const diffPayload = {
        beforeScore: audit?.beforeScore ?? 0,
        afterScore: audit?.afterScore ?? 0,
        scoreBoost: audit?.scoreBoost ?? 0,
        scoreBreakdown: audit?.scoreBreakdown ?? { alreadyMatched: 0, newlyIntegrated: 0, remainingGap: 0 },
        missingBefore: audit?.missingBefore ?? { skills: [], keywords: [] },
        addedAfter: audit?.addedAfter ?? {
          keywordsIncorporated: [],
          keywordsInExperience: [],
          keywordsInSkills: [],
          rephrasedHighlightsCount: 0,
          skillsAdded: [],
        },
        notIntegrable: audit?.notIntegrable ?? [],
        auditNotes: audit?.auditNotes ?? [],
        bulletRewrites,
      };

      // Update the history record with the diff + tailored CV
      if (historyId) {
        try {
          const existing = getManualAnalysis(historyId);
          if (existing) {
            saveManualAnalysis({
              id: historyId,
              role: existing.role,
              company: existing.company,
              description: existing.description,
              score: existing.score,
              gapAnalysis: existing.gapAnalysis,
              diff: diffPayload,
              tailoredCv,
            });
          }
        } catch (err) {
          console.warn('Manual JD history update failed:', err);
        }
      }

      res.json({
        success: true,
        downloadToken: token,
        historyId,
        diff: diffPayload,
        tailoredCv,
      });
    } catch (err: any) {
      console.error('Tailor JD error:', err);
      const mapped = mapLlmError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  // Download manual JD tailored CV
  app.get('/api/analyze-jd/download', async (req, res) => {
    try {
      const token = req.query.token as string;
      const format = (req.query.format as string) || 'pdf';
      const data = manualResults.get(token);

      if (!data) {
        res.status(404).json({ error: 'Analysis result expired or not found. Please re-analyze.' });
        return;
      }

      const safeName = data.tailoredCv.candidateName.replace(/ /g, '_');
      const safeCompany = data.company.replace(/[^a-zA-Z0-9]/g, '_');

      // Template: explicit ?template= wins (Manual JD selector); otherwise
      // the Master CV's template is the default.
      const requestedTemplate = req.query.template as string | undefined;
      const masterTemplate = ['harvard', 'jake', 'atanu', 'atanu-pro'].includes(getMasterCv()?.templateId || '') ? getMasterCv()?.templateId : 'harvard';
      const effectiveTemplate = requestedTemplate && ['harvard', 'jake', 'atanu', 'atanu-pro'].includes(requestedTemplate) ? requestedTemplate : masterTemplate;

      if (format === 'pdf') {
        const pdfBuffer = await generatePdfBuffer(data.tailoredCv, effectiveTemplate);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${safeCompany}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'txt') {
        const textCv = generatePlainTextCv(data.tailoredCv);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${safeCompany}.txt"`);
        res.send(textCv);
      } else if (format === 'json') {
        // Used by the Manual JD comparison slider to render the new CV.
        res.json(data.tailoredCv);
      } else {
        const pdfBuffer = await generatePdfBuffer(data.tailoredCv, effectiveTemplate);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${safeCompany}.pdf"`);
        res.send(pdfBuffer);
      }
    } catch (err: any) {
      console.error('Manual download error:', err);
      res.status(500).json({ error: 'Failed to generate file.' });
    }
  });

  // ── Manual JD history (per user) ──
  app.get('/api/manual-jd/history', (req, res) => {
    res.json({ analyses: listManualAnalyses() });
  });

  app.get('/api/manual-jd/history/:id', (req, res) => {
    try {
      const record = getManualAnalysis(req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Analysis not found.' });
        return;
      }
      // Re-issue a download token if the record has a tailored CV,
      // so downloads keep working long after the original session.
      let downloadToken: string | undefined;
      if (record.tailoredCv) {
        downloadToken = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        manualResults.set(downloadToken, {
          tailoredCv: record.tailoredCv,
          title: record.role,
          company: record.company,
        });
        setTimeout(() => manualResults.delete(downloadToken), 30 * 60 * 1000);
      }
      res.json({ analysis: record, downloadToken });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/manual-jd/history/:id', (req, res) => {
    try {
      const deleted = deleteManualAnalysis(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Job Status
  app.put('/api/jobs/:id/status', (req, res) => {
    try {
      const { state } = req.body;
      const job = getJobById(req.params.id);
      if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }

      const updated = updateJobInStorage({
        ...job,
        state,
      });

      res.json({ success: true, job: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create Job manually
  app.post('/api/jobs', (req, res) => {
    try {
      const { title, company, location, description, url, source } = req.body;
      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Title is required.' });
        return;
      }
      const job: Job = {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        company: company?.trim() || 'Unknown Company',
        location: location?.trim() || 'Remote',
        source: source || 'Custom',
        description: description?.trim() || '',
        url: url?.trim() || '',
        postedDate: new Date().toISOString(),
        postedDateParsed: new Date().toISOString().split('T')[0],
        jobType: 'Full-time',
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { added, skipped } = saveNewJobs([job]);
      res.json({ success: true, job: added[0] || job, skippedDuplicates: skipped });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete Job
  app.delete('/api/jobs/:id', (req, res) => {
    const deleted = deleteJobFromStorage(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Clear All Jobs
  app.delete('/api/jobs', (req, res) => {
    const count = deleteAllJobs();
    res.json({ success: true, deletedCount: count });
  });

  // Download ATS .pdf CV
  app.get('/api/jobs/:id/download-pdf', async (req, res) => {
    try {
      const job = getJobById(req.params.id);
      if (!job || !job.tailoredCv) {
        res.status(400).json({ error: 'Job or tailored CV not available for download.' });
        return;
      }

      const pdfBuffer = await generatePdfBuffer(job.tailoredCv, ['harvard', 'jake', 'atanu', 'atanu-pro'].includes(getMasterCv()?.templateId || '') ? getMasterCv()?.templateId : 'harvard');

      const safeName = job.tailoredCv.candidateName.replace(/ /g, '_');
      const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_${safeCompany}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('Download pdf error:', err);
      res.status(500).json({ error: 'Failed to generate pdf file.' });
    }
  });

  // Download ATS CV in dynamic format (?format=docx|pdf|txt)
  app.get('/api/jobs/:id/download', async (req, res) => {
    try {
      const job = getJobById(req.params.id);
      if (!job || !job.tailoredCv) {
        res.status(400).json({ error: 'Job or tailored CV not available for download.' });
        return;
      }

      const format = ((req.query.format as string) || 'pdf').toLowerCase();
      const safeName = job.tailoredCv.candidateName.replace(/ /g, '_');
      const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_');
      const baseName = `${safeName}_${safeCompany}`;

      if (format === 'pdf') {
        const pdfBuffer = await generatePdfBuffer(job.tailoredCv, ['harvard', 'jake', 'atanu', 'atanu-pro'].includes(getMasterCv()?.templateId || '') ? getMasterCv()?.templateId : 'harvard');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'txt') {
        const textCv = generatePlainTextCv(job.tailoredCv);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.txt"`);
        res.send(textCv);
      } else {
        const pdfBuffer = await generatePdfBuffer(job.tailoredCv, ['harvard', 'jake', 'atanu', 'atanu-pro'].includes(getMasterCv()?.templateId || '') ? getMasterCv()?.templateId : 'harvard');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
        res.send(pdfBuffer);
      }
    } catch (err: any) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Failed to generate requested document.' });
    }
  });

  // Storage Migration endpoint
  app.post('/api/storage/migrate', (req, res) => {
    const { targetMode } = req.body;
    const mode = targetMode === 'sqlite' ? 'sqlite' : 'json';
    const result = runStorageMigration(mode);
    res.json(result);
  });

  // --- VITE / SERVING FRONTEND ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ATS Job Search & CV Tailor server running at http://0.0.0.0:${PORT}`);
  });

  // One-time backfill: extract recruiter/HR emails from descriptions of
  // jobs that were scraped before the contacts feature existed.
  try {
    let total = 0;
    for (const u of listUsers()) {
      runWithUser(u.id, () => {
        total += backfillContacts();
      });
    }
    console.log(`[Contacts] Backfilled ${total} new contact rows from existing job descriptions`);
  } catch (err: any) {
    console.warn('[Contacts] Backfill skipped:', err?.message || err);
  }
}

startServer();
