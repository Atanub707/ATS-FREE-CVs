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
  getMasterCv,
  saveMasterCv,
  getAllJobs,
  getJobById,
  updateJobInStorage,
  deleteJobFromStorage,
  deleteAllJobs,
  queryJobs,
  saveNewJobs,
  runStorageMigration,
} from './server/storage/sqliteStorage.js';
import { ScraperFactory } from './server/scraper/scraperFactory.js';
import { LlmMatcher } from './server/matcher/llmMatcher.js';
import { LlmCvTailor } from './server/builder/llmCvTailor.js';
import { generateDocxBuffer, generatePdfBuffer, generatePlainTextCv } from './server/builder/docxGenerator.js';
import { JobFilterQueryParams } from './src/types.js';

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

  // Seed sample jobs if store is completely empty on initial startup
  const initialJobs = getAllJobs();
  if (initialJobs.length === 0) {
    const sampleScrape = await ScraperFactory.runScrape({
      keywords: 'Full Stack TypeScript Engineer',
      location: 'Remote',
      sources: ['LinkedIn'],
      maxJobsPerSource: 5,
    });
    saveNewJobs(sampleScrape);
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

  // Master CV routes
  app.get('/api/cv/master', (req, res) => {
    res.json(getMasterCv());
  });

  app.post('/api/cv/master', (req, res) => {
    try {
      saveMasterCv(req.body);
      res.json({ success: true, cv: getMasterCv() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
      const format = ((req.query.format as string) || 'docx').toLowerCase();

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
        const docxBuffer = await generateDocxBuffer(masterAsTailored);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
        res.send(docxBuffer);
      }
    } catch (err: any) {
      console.error('Master CV download error:', err);
      res.status(500).json({ error: 'Failed to generate master CV document.' });
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

  // Scrape Jobs (LinkedIn & Indeed)
  app.post('/api/jobs/scrape', async (req, res) => {
    try {
      const { keywords, location, sources, datePostedFilter, minSalary, maxJobsPerSource, jobTitle, experienceLevel } = req.body;

      if (!keywords || !keywords.trim()) {
        res.status(400).json({ error: 'Keywords parameter is required.' });
        return;
      }

      const scrapedJobs = await ScraperFactory.runScrape({
        keywords: keywords.trim(),
        location: location || 'Remote',
        sources,
        datePostedFilter: datePostedFilter || 'all',
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxJobsPerSource: maxJobsPerSource ? Number(maxJobsPerSource) : 15,
        jobTitle: jobTitle?.trim() || undefined,
        experienceLevel: experienceLevel || 'all',
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

      const updatedResults = [];

      for (const job of targetJobs) {
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
      }

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

      const masterCv = getMasterCv();
      const tailorEngine = new LlmCvTailor();

      const tailoredCv = await tailorEngine.tailorCv(job, masterCv);

      const updatedJob = updateJobInStorage({
        ...job,
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

      const tailoredResults = [];

      for (const job of candidateJobs) {
        const tailoredCv = await tailorEngine.tailorCv(job, masterCv);

        const updated = updateJobInStorage({
          ...job,
          tailoredCv,
          state: 'tailored',
          tailoredAt: new Date().toISOString(),
        });

        tailoredResults.push(updated);
      }

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
      const [saved] = saveNewJobs([job]);
      res.json({ success: true, job: saved || job });
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

  // Download ATS .docx CV
  app.get('/api/jobs/:id/download-docx', async (req, res) => {
    try {
      const job = getJobById(req.params.id);
      if (!job || !job.tailoredCv) {
        res.status(400).json({ error: 'Job or tailored CV not available for download.' });
        return;
      }

      const docxBuffer = await generateDocxBuffer(job.tailoredCv);

      const safeName = job.tailoredCv.candidateName.replace(/ /g, '_');
      const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_${safeCompany}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(docxBuffer);
    } catch (err: any) {
      console.error('Download docx error:', err);
      res.status(500).json({ error: 'Failed to generate docx file.' });
    }
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

      const format = ((req.query.format as string) || 'docx').toLowerCase();
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
        const docxBuffer = await generateDocxBuffer(job.tailoredCv);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.docx"`);
        res.send(docxBuffer);
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
