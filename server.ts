import 'dotenv/config';
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
  saveManualAnalysis,
  listManualAnalyses,
  getManualAnalysis,
  deleteManualAnalysis,
} from './server/storage/fileStorage.js';
import { ScraperFactory } from './server/scraper/scraperFactory.js';
import { LlmMatcher } from './server/matcher/llmMatcher.js';
import { LlmCvTailor } from './server/builder/llmCvTailor.js';
import { generatePdfBuffer, generatePlainTextCv } from './server/builder/docxGenerator.js';
import { JobFilterQueryParams, Job } from './src/types.js';

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
  const COMPROMISED_KEYS = new Set(['sk-BGkiio5V8alNSZEipX2yMJ9d22S4N2dSDHHhaOrOYsubdYKHS2dhiSpFTYKoQqF0']);
  const configuredKey = loadConfig().llm.apiKey;
  if (COMPROMISED_KEYS.has(configuredKey)) {
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

  app.post('/api/config', (req, res) => {
    try {
      saveConfig(req.body);
      res.json({ success: true, config: loadConfig() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      const { email, password, name } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'A valid email is required.' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      const displayName = (name || '').trim() || email.split('@')[0];
      const user = createUser(email, displayName, password);
      const token = createSession(user.id);
      res.cookie('ats_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 90 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } });
    } catch (err: any) {
      res.status(409).json({ error: err.message });
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

      const masterAsTailored = {
        candidateName: m.fullName,
        contactInfo: {
          email: m.email,
          phone: m.phone,
          location: m.location,
          linkedin: m.linkedin,
          github: m.github,
          website: m.website,
        },
        targetRole: '',
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

      const safeName = m.fullName.replace(/ /g, '_');
      const filename = `${safeName}_Master_CV`;

      if (format === 'pdf') {
        const pdfBuffer = await generatePdfBuffer(masterAsTailored);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'txt') {
        const textCv = generatePlainTextCv(masterAsTailored);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        res.send(textCv);
      } else {
        const pdfBuffer = await generatePdfBuffer(masterAsTailored);
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
      const { keywords, location, sources, datePostedFilter, jobType, minSalary, maxJobsPerSource, jobTitle, experienceLevel, under10Applicants } = req.body;

      if (!keywords || !keywords.trim()) {
        res.status(400).json({ error: 'Keywords parameter is required.' });
        return;
      }

      const scrapedJobs = await ScraperFactory.runScrape({
        keywords: keywords.trim(),
        location: location || 'Remote',
        sources,
        datePostedFilter: datePostedFilter || 'all',
        jobType: jobType || 'all',
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxJobsPerSource: maxJobsPerSource ? Number(maxJobsPerSource) : 15,
        jobTitle: jobTitle?.trim() || undefined,
        experienceLevel: experienceLevel || 'all',
        under10Applicants: under10Applicants === true,
      });

      const { added, skipped } = saveNewJobs(scrapedJobs);

      res.json({
        success: true,
        scrapedTotal: scrapedJobs.length,
        addedCount: added.length,
        skippedDuplicates: skipped,
        addedJobs: added,
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
  app.get('/api/jobs', (req, res) => {
    try {
      const queryParams: JobFilterQueryParams = {
        state: (req.query.state as any) || 'all',
        source: (req.query.source as any) || 'all',
        search: (req.query.search as string) || '',
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
      console.error('Match error:', err);
      res.status(500).json({ error: err.message || 'Matching failed.' });
    }
  });

  // Batch Job Match Scoring (Score all pending)
  app.post('/api/jobs/batch-match', async (req, res) => {
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
      console.error('Batch match error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Tailor CV for Single Job
  app.post('/api/jobs/:id/tailor', async (req, res) => {
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
      console.error('Tailor CV error:', err);
      res.status(500).json({ error: err.message || 'CV Tailoring failed.' });
    }
  });

  // Batch Tailor CVs for Matched Jobs (>= threshold)
  app.post('/api/jobs/batch-tailor', async (req, res) => {
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
      console.error('Batch tailor error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Analyze a manual JD (no scraping needed)
  const manualResults = new Map<string, { tailoredCv: any; title: string; company: string }>();

  app.post('/api/analyze-jd', async (req, res) => {
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
      res.status(500).json({ error: err.message });
    }
  });

  // Tailor a manually analyzed JD (separate step after user updates master CV)
  app.post('/api/analyze-jd/tailor', async (req, res) => {
    try {
      const { title, company, description, gapAnalysis, matchScore, historyId } = req.body;
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
      const tailoredCv = await tailorEngine.tailorCv(virtualJob, masterCv);

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
      });
    } catch (err: any) {
      console.error('Tailor JD error:', err);
      res.status(500).json({ error: err.message });
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

      if (format === 'pdf') {
        const pdfBuffer = await generatePdfBuffer(data.tailoredCv);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${safeCompany}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'txt') {
        const textCv = generatePlainTextCv(data.tailoredCv);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${safeCompany}.txt"`);
        res.send(textCv);
      } else {
        const pdfBuffer = await generatePdfBuffer(data.tailoredCv);
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

      const pdfBuffer = await generatePdfBuffer(job.tailoredCv);

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
        const pdfBuffer = await generatePdfBuffer(job.tailoredCv);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === 'txt') {
        const textCv = generatePlainTextCv(job.tailoredCv);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.txt"`);
        res.send(textCv);
      } else {
        const pdfBuffer = await generatePdfBuffer(job.tailoredCv);
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
}

startServer();
