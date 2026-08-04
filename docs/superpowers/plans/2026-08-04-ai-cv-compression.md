# AI CV Compression Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI assistant in the Master CV screen that compresses the CV to 1–2 pages without losing keywords or meaning, backed by current market data from the user's scraped jobs, with automatic backup + restore.

**Architecture:** Three server phases (analyze → rewrite → verify) orchestrated in `server/ai/cvCompressor.ts`, market keywords from `server/ai/marketData.ts` reading the SQLite `jobs` table, all LLM calls via existing `ask()` (BYOK). Frontend adds an AI Compress button, progress overlay, side-by-side preview (reusing `CvPdfPreview`), guidance strip, confirm modal, and a versions drawer backed by a new `cv_versions` table.

**Tech Stack:** TypeScript, Express 4, better-sqlite3, React 19, existing `ask()` LLM adapter, existing `CvPdfPreview` component.

## Global Constraints

- All LLM calls go through `ask(prompt, temperature?)` from `server/llm/llmAdapter.ts` — never a new provider client.
- LLM JSON responses are parsed with try/catch and validated for required fields before use (mirror `llmCvTailor.ts` patterns).
- All storage functions are user-scoped via `getCurrentUserId()` (AsyncLocalStorage request context).
- The compressed CV is a MasterCv-shaped working document (user keeps editing it), NOT a one-off TailoredCv artifact.
- Page counts are computed client-side from rendered `CvPdfPreview` instances; the server only returns word counts.
- No real-time web browsing — market data comes only from the local `jobs` table.
- `tsc --noEmit` must pass after every task.

---

### Task 1: cv_versions storage (SQLite)

**Files:**
- Modify: `server/storage/fileStorage.ts` (add table to `getDb` schema; append functions at end of file)

**Interfaces:**
- Consumes: `getDb()`, `getCurrentUserId()` (already exported)
- Produces:
  - `saveCvVersion(data: MasterCv, note: string, pages?: number): void`
  - `listCvVersions(): { id: string; note: string; pages: number; createdAt: string }[]`
  - `getCvVersion(id: string): { data: MasterCv; note: string } | undefined`
  - `deleteCvVersion(id: string): boolean`

- [ ] **Step 1: Add the table to the schema**

In `getDb()`'s `db.exec(...)`, after the `manual_analysis` table, add:

```sql
CREATE TABLE IF NOT EXISTS cv_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  note TEXT,
  pages INTEGER DEFAULT 0,
  created_at TEXT
);
```

- [ ] **Step 2: Append the storage functions at the end of fileStorage.ts**

```ts
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
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/storage/fileStorage.ts
git commit -m "feat: cv_versions table for AI compression backups"
```

---

### Task 2: marketData module

**Files:**
- Create: `server/ai/marketData.ts`
- Test: manual via node REPL after Task 4 (module is exercised by the API)

**Interfaces:**
- Consumes: `getAllJobs()` from `server/storage/fileStorage.ts`
- Produces:
  - `getMarketData(targetRole: string): { jobCount: number; topKeywords: string[]; sampleRequirements: string[] }`

**Logic:** fetch all jobs; filter those whose `title` contains any word of the target role (case-insensitive, role words split on non-alphanumerics); take the 20 most recent by `postedDate`; tokenize descriptions (split on non-alphanumerics, lowercase, filter stopwords + words < 3 chars); count frequency; return top 15 keywords and up to 5 sentences containing the top keyword (as sample requirements).

- [ ] **Step 1: Create server/ai/marketData.ts**

```ts
import { getAllJobs } from '../storage/fileStorage.js';

const STOPWORDS = new Set([
  'the','and','for','with','you','are','will','our','your','have','this','that','from',
  'they','their','what','why','not','can','all','any','but','out','who','which','into',
  'experience','years','year','work','job','role','team','must','able','including','etc',
  'strong','excellent','good','well','plus','min','new','candidate','should','per','within',
  'across','using','used','use','one','two','well','also','may','like','make','day','days',
  'week','weeks','month','months','required','requirements','requirement','knowledge','ability',
  'etc','us','uk','india','remote','onsite','hybrid','fulltime','parttime','contract','salary',
]);

export function getMarketData(targetRole: string): { jobCount: number; topKeywords: string[]; sampleRequirements: string[] } {
  try {
    const roleWords = targetRole.toLowerCase().split(/[^a-z0-9+.#-]+/).filter((w) => w.length > 1);
    const all = getAllJobs();
    const matching = all
      .filter((j) => {
        const t = (j.title || '').toLowerCase();
        return roleWords.some((w) => t.includes(w));
      })
      .sort((a, b) => (b.postedDate || '').localeCompare(a.postedDate || ''))
      .slice(0, 20);

    if (matching.length === 0) {
      return { jobCount: 0, topKeywords: [], sampleRequirements: [] };
    }

    const freq = new Map<string, number>();
    const descPool = matching.map((j) => j.description || '').join(' ');
    const tokens = descPool.toLowerCase().split(/[^a-z0-9+.#-]+/);
    for (const t of tokens) {
      if (t.length < 3 || STOPWORDS.has(t)) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }

    const topKeywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k]) => k);

    const samples = matching
      .map((j) => (j.description || '').split(/(?<=\.)\s+/).find((s) => s.toLowerCase().includes(topKeywords[0] || '')))
      .filter(Boolean)
      .slice(0, 5) as string[];

    return { jobCount: matching.length, topKeywords, sampleRequirements: samples };
  } catch {
    return { jobCount: 0, topKeywords: [], sampleRequirements: [] };
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/ai/marketData.ts
git commit -m "feat: market data extraction from scraped jobs"
```

---

### Task 3: cvCompressor orchestration (analyze → rewrite → verify)

**Files:**
- Create: `server/ai/cvCompressor.ts`

**Interfaces:**
- Consumes: `ask()` from `../llm/llmAdapter.js`, `MasterCv`, `TailoredCv` types from `../../src/types.js`, `getMarketData` from `./marketData.js`
- Produces:
  - `interface CompressGuidance { sections: { name: string; changes: { type: 'tighten' | 'merge' | 'keep'; bulletIndexes: number[]; reason: string }[] }[] }`
  - `interface CompressResult { guidance: CompressGuidance; compressedCv: TailoredCv; verification: { preserved: string[]; dropped: string[] }; marketSummary: { jobCount: number; topKeywords: string[] }; wordCountBefore: number; wordCountAfter: number }`
  - `compressCv(masterCv: MasterCv, targetRole: string, marketData: { jobCount: number; topKeywords: string[]; sampleRequirements: string[] }): Promise<CompressResult>`

**Prompt contract (Phase 2):** the LLM returns a TailoredCv-shaped JSON with the same fields as `llmCvTailor` output: `candidateName, contactInfo, professionalSummary, targetRole, coreCompetencies, workExperience[{title, company, location, dates, highlights[]}], education[], technicalSkills[{category, skills[]}], projects?, certifications?`. No `audit` needed.

- [ ] **Step 1: Create server/ai/cvCompressor.ts**

```ts
import { ask } from '../llm/llmAdapter.js';
import { MasterCv, TailoredCv } from '../../src/types.js';
import { getMarketData } from './marketData.js';

export interface CompressGuidance {
  sections: { name: string; changes: { type: 'tighten' | 'merge' | 'keep'; bulletIndexes: number[]; reason: string }[] }[];
}

export interface CompressResult {
  guidance: CompressGuidance;
  compressedCv: TailoredCv;
  verification: { preserved: string[]; dropped: string[] };
  marketSummary: { jobCount: number; topKeywords: string[] };
  wordCountBefore: number;
  wordCountAfter: number;
}

function experienceLevel(masterCv: MasterCv): 'entry' | 'mid' | 'senior' {
  const totalYrs = masterCv.experiences.reduce((acc, e) => {
    const m = e.dates.match(/(\d{4})/g);
    if (m && m.length >= 2) return acc + (parseInt(m[1], 10) - parseInt(m[0], 10));
    return acc;
  }, 0);
  if (totalYrs < 3) return 'entry';
  if (totalYrs < 8) return 'mid';
  return 'senior';
}

function countWords(s: string): number {
  return (s || '').split(/\s+/).filter(Boolean).length;
}

function extractKeywords(text: string): string[] {
  const tokens = text.toLowerCase().split(/[^a-z0-9+.#-]+/).filter((t) => t.length >= 3);
  return [...new Set(tokens)];
}

export async function compressCv(
  masterCv: MasterCv,
  targetRole: string,
  marketData: ReturnType<typeof getMarketData>
): Promise<CompressResult> {
  const level = experienceLevel(masterCv);
  const targetPages = level === 'entry' ? 1 : 2;

  const marketBlock = marketData.jobCount > 0
    ? `LIVE MARKET DATA (${marketData.jobCount} recent job postings matching "${targetRole}"):
Top keywords by frequency: ${marketData.topKeywords.join(', ') || '(none)'}
Sample requirement lines:
${marketData.sampleRequirements.map((s) => `- ${s}`).join('\n')}`
    : `No live market data available for "${targetRole}". Use your professional knowledge of the role's current market.`;

  const cvBlock = `CANDIDATE MASTER CV (current, ${countWords(JSON.stringify(masterCv))} words):
${JSON.stringify(masterCv, null, 2)}`;

  // ── Phase 1: analyze ──
  const analyzePrompt = `You are a senior executive resume consultant with deep knowledge of the ${targetRole} market.

${marketBlock}

${cvBlock}

TASK — ANALYZE ONLY. Return valid JSON (no markdown, no code fences):
{
  "sections": [
    {
      "name": "Work Experience" | "Summary" | "Skills" | "Projects" | "Education" | "Certifications",
      "changes": [
        { "type": "tighten" | "merge" | "keep", "bulletIndexes": [indices of experience bullets or 0 for single-block sections], "reason": "short English explanation of what to change and why, preserving meaning" }
      ]
    }
  ]
}

RULES:
- Tighten = shorten wording, keep every keyword and metric. Merge = combine overlapping bullets into one, keeping both keywords/metrics. Keep = leave untouched.
- Never recommend dropping meaning, metrics, or keywords. Every statement's meaning must survive.
- Use the market keywords to suggest which skills to surface or add to Skills.
- Target ${targetPages} page${targetPages > 1 ? 's' : ''} for this candidate (${level} level).
- Be concrete and specific.`;

  const analyzeRaw = await ask(analyzePrompt, 0.2);
  const guidance: CompressGuidance = JSON.parse(analyzeRaw);

  // ── Phase 2: rewrite ──
  const rewritePrompt = `You are a senior executive resume writer. Rewrite the candidate's CV to fit ${targetPages} page${targetPages > 1 ? 's' : ''} WITHOUT losing any meaning, keyword, or metric.

${marketBlock}

${cvBlock}

Guidance from the analysis phase:
${JSON.stringify(guidance, null, 2)}

Return valid JSON ONLY (no markdown, no code fences) in EXACTLY this shape:
{
  "candidateName": string,
  "contactInfo": { "email": string, "phone": string, "location": string, "linkedin": string, "github": string, "website": string },
  "professionalSummary": string,
  "targetRole": string,
  "coreCompetencies": string[],
  "workExperience": [{ "title": string, "company": string, "location": string, "dates": string, "highlights": string[] }],
  "education": [{ "degree": string, "institution": string, "dates": string, "details": string }],
  "technicalSkills": [{ "category": string, "skills": string[] }],
  "projects": [{ "name": string, "description": string, "technologies": string[], "link": string, "dates": string }],
  "certifications": string[]
}

STRICT RULES:
- Keep the candidate's real title ("${masterCv.experiences[0]?.title || targetRole}") as targetRole. Never rename.
- Every original bullet's meaning and metrics must survive — tighten/merge, never drop substance.
- Weave the market keywords into bullets and skills naturally.
- Target role: ${targetRole}. Target: ${targetPages} page${targetPages > 1 ? 's' : ''}.`;

  const rewriteRaw = await ask(rewritePrompt, 0.2);
  const compressedCv: TailoredCv = JSON.parse(rewriteRaw);

  // ── Phase 3: verify (deterministic) ──
  const originalBullets = masterCv.experiences.flatMap((e) => e.responsibilities);
  const originalText = originalBullets.join(' ') + ' ' + masterCv.summary + ' ' +
    masterCv.skills.flatMap((s) => s.items).join(' ');
  const compressedText = [
    compressedCv.professionalSummary || '',
    ...(compressedCv.workExperience || []).flatMap((w) => w.highlights || []),
    ...(compressedCv.coreCompetencies || []),
    ...(compressedCv.technicalSkills || []).flatMap((t) => t.skills || []),
    ...(compressedCv.certifications || []).map((c) => (typeof c === 'string' ? c : c.name)),
  ].join(' ');

  const originalKeywords = extractKeywords(originalText);
  const preserved = originalKeywords.filter((k) => compressedText.toLowerCase().includes(k));
  const dropped = originalKeywords.filter((k) => !compressedText.toLowerCase().includes(k));

  return {
    guidance,
    compressedCv,
    verification: { preserved, dropped },
    marketSummary: { jobCount: marketData.jobCount, topKeywords: marketData.topKeywords },
    wordCountBefore: countWords(JSON.stringify(masterCv)),
    wordCountAfter: countWords(JSON.stringify(compressedCv)),
  };
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/ai/cvCompressor.ts
git commit -m "feat: AI CV compression orchestration (analyze/rewrite/verify)"
```

---

### Task 4: API endpoints (analyze, accept, versions)

**Files:**
- Modify: `server.ts` (add routes near the master CV routes; import new functions)

**Interfaces:**
- Consumes: `compressCv` from `./server/ai/cvCompressor.js`, `getMarketData` from `./server/ai/marketData.js`, `getMasterCv`, `saveMasterCv`, `saveCvVersion`, `listCvVersions`, `getCvVersion`, `deleteCvVersion` from storage
- Produces:
  - `POST /api/cv/ai/analyze` → `{ success, guidance, compressedCv, verification, marketSummary, wordCountBefore, wordCountAfter }`
  - `POST /api/cv/ai/accept` → `{ success, cv: MasterCv }`
  - `GET /api/cv/versions` → `{ versions: [...] }`
  - `POST /api/cv/versions/:id/restore` → `{ success, cv: MasterCv }`
  - `DELETE /api/cv/versions/:id` → `{ success: boolean }`

**Compressed→MasterCv conversion:** the accept route converts the TailoredCv-shape back into MasterCv shape (reverse of `masterCvToPdfShape`): contactInfo → contact fields, workExperience → experiences (responsibilities = highlights, fresh ids), technicalSkills → skills, certifications objects → strings.

- [ ] **Step 1: Add imports to server.ts**

Add to the existing `fileStorage` import block:

```ts
  saveCvVersion,
  listCvVersions,
  getCvVersion,
  deleteCvVersion,
```

And new imports:

```ts
import { compressCv } from './server/ai/cvCompressor.js';
import { getMarketData } from './server/ai/marketData.js';
```

- [ ] **Step 2: Add the routes after the master CV download route (after `app.post('/api/cv/improve-summary'...)` block)**

```ts
  // ── AI CV Compression ──
  app.post('/api/cv/ai/analyze', async (req, res) => {
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
      res.status(500).json({ error: err.message });
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
      const certifications = (compressed.certifications || []).map((c: any) =>
        typeof c === 'string' ? c : c.name || ''
      ).filter(Boolean);

      const newCv: any = {
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
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat: AI compress API + CV version backup/restore endpoints"
```

---

### Task 5: Frontend — AI Compress button, progress overlay, result view

**Files:**
- Modify: `src/components/MasterCvScreen.tsx` (header buttons + new state/handlers + result view + guidance strip)
- Modify: `src/components/CvPdfPreview.tsx` (export a helper to compute page count for a shape — see Step 4)

**Interfaces:**
- Consumes: `CvPdfPreview`, `masterCvToPdfShape`, `PdfCvShape` (already exported); `POST /api/cv/ai/analyze`, `POST /api/cv/ai/accept`
- Produces (frontend state): `aiState: 'idle' | 'running' | 'result'`, `compressResult`, `aiError`, `confirmOpen`, `versions`, `versionsOpen`

- [ ] **Step 1: Add a page-count probe helper to CvPdfPreview.tsx**

Add an exported component `CvPdfPreviewWithCount` that wraps `CvPdfPreview` and reports page count via an optional callback. Modify `CvPdfPreview` to accept `onPageCount?: (n: number) => void` and call `onPageCount(pages.length)` in a `useEffect` on `pages`:

```tsx
// inside CvPdfPreview component
useEffect(() => {
  onPageCount?.(pages.length);
}, [pages, onPageCount]);
```

Add `onPageCount` to `CvPdfPreviewProps` (optional).

- [ ] **Step 2: Add state and handlers in MasterCvScreen**

```tsx
const [aiState, setAiState] = useState<'idle' | 'running' | 'result'>('idle');
const [compressResult, setCompressResult] = useState<any>(null);
const [aiError, setAiError] = useState<string | null>(null);
const [aiStep, setAiStep] = useState(0);
const [confirmOpen, setConfirmOpen] = useState(false);
const [versionsOpen, setVersionsOpen] = useState(false);
const [versions, setVersions] = useState<{ id: string; note: string; pages: number; createdAt: string }[]>([]);
const [pagesBefore, setPagesBefore] = useState(0);
const [pagesAfter, setPagesAfter] = useState(0);
const aiStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
```

Handlers (place after `handleSave`):

```tsx
const AI_STEPS = ['Reading the market…', 'Analyzing your CV…', 'Rewriting…', 'Verifying keywords & page count…'];

const handleAiCompress = async () => {
  setAiState('running');
  setAiError(null);
  setAiStep(0);
  aiStepTimer.current = setInterval(() => {
    setAiStep((s) => Math.min(s + 1, AI_STEPS.length - 1));
  }, 2500);
  try {
    const res = await fetch('/api/cv/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) { setAiError(data.error || 'Compression failed'); return; }
    setCompressResult(data);
    setAiState('result');
  } catch (e: any) {
    setAiError(e.message || 'Compression failed');
  } finally {
    if (aiStepTimer.current) clearInterval(aiStepTimer.current);
  }
};

const handleAcceptCompressed = async () => {
  try {
    const res = await fetch('/api/cv/ai/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compressedCv: compressResult.compressedCv }),
    });
    const data = await res.json();
    if (!res.ok) { setAiError(data.error || 'Apply failed'); return; }
    setFormData(data.cv);
    setConfirmOpen(false);
    setAiState('idle');
    setCompressResult(null);
    onSaveMasterCv(data.cv);
  } catch (e: any) {
    setAiError(e.message || 'Apply failed');
  }
};

const loadVersions = async () => {
  try {
    const res = await fetch('/api/cv/versions');
    if (res.ok) setVersions((await res.json()).versions || []);
  } catch { /* ignore */ }
};

const restoreVersion = async (id: string) => {
  try {
    const res = await fetch(`/api/cv/versions/${id}/restore`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.cv) {
      setFormData(data.cv);
      setAiState('idle');
      onSaveMasterCv(data.cv);
    }
  } catch { /* ignore */ }
};
```

- [ ] **Step 3: Add the AI Compress + Versions buttons in the header**

In the header (next to the existing Download/Save buttons, before the Close button), add:

```tsx
<button
  type="button"
  onClick={() => { setVersionsOpen(true); loadVersions(); }}
  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
>
  <History className="w-3.5 h-3.5" />
  <span>Versions</span>
</button>
<button
  type="button"
  onClick={handleAiCompress}
  disabled={aiState === 'running'}
  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shadow-md shadow-blue-600/20"
>
  <Sparkles className="w-3.5 h-3.5" />
  <span>{aiState === 'running' ? 'Compressing…' : 'AI Compress'}</span>
</button>
```

Add `History` to the lucide imports in this file.

- [ ] **Step 4: Add the progress overlay + result view + confirm modal + versions drawer**

Insert immediately before the closing `</div>` of the component's root (after the right preview panel). Key structure:

```tsx
{/* AI progress overlay */}
{aiState === 'running' && (
  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6">
      <div className="flex items-center space-x-2.5">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">AI Compressing your CV</p>
          <p className="text-[11px] text-slate-400">Analyzing against live market data</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {AI_STEPS.map((label, i) => (
          <div key={label} className="flex items-center space-x-3">
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
              i < aiStep ? 'border-emerald-500 bg-emerald-500 text-white'
              : i === aiStep ? 'border-blue-500 text-blue-600'
              : 'border-slate-200 text-slate-300'
            }`}>
              {i < aiStep ? '✓' : i + 1}
            </span>
            <span className={`text-xs font-medium ${i <= aiStep ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
            {i === aiStep && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{/* AI error */}
{aiError && aiState !== 'running' && (
  <div className="absolute top-16 right-6 z-50 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-4 py-2.5 shadow-lg">
    {aiError}
  </div>
)}

{/* Result view: side-by-side */}
{aiState === 'result' && compressResult && (
  <div className="fixed inset-0 z-50 bg-white flex flex-col">
    <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
      <div className="flex items-center space-x-3">
        <span className="text-sm font-extrabold text-slate-900">AI Compression Result</span>
        <span className="text-xs font-bold text-slate-400 line-through">{pagesBefore > 0 ? `${pagesBefore} pages` : '…'}</span>
        <span className="text-slate-300">→</span>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">{pagesAfter > 0 ? `${pagesAfter} pages` : '…'}</span>
        <span className="text-[10.5px] text-slate-400 font-semibold">
          · {compressResult.verification?.preserved?.length ?? 0} keywords preserved · {compressResult.verification?.dropped?.length ?? 0} dropped
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <button type="button" onClick={() => { setAiState('idle'); setCompressResult(null); }}
          className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 cursor-pointer">
          Cancel
        </button>
        <button type="button" onClick={() => setConfirmOpen(true)}
          className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 cursor-pointer">
          Use this version
        </button>
      </div>
    </div>
    <div className="flex-1 flex min-h-0">
      {/* Original */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-200">
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <span className="text-[9.5px] font-extrabold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">ORIGINAL</span>
          <span className="text-[11px] font-bold text-slate-700">Current Master CV</span>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <CvPdfPreview cv={masterCvToPdfShape(formData)} zoom={50} onPageCount={setPagesBefore} />
        </div>
      </div>
      {/* AI compressed */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <span className="text-[9.5px] font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full px-2 py-0.5">AI ✦</span>
          <span className="text-[11px] font-bold text-slate-700">Compressed · ATS Optimized</span>
          <span className="ml-auto text-[10px] font-bold text-emerald-600">−{Math.max(0, Math.round((1 - compressResult.wordCountAfter / Math.max(1, compressResult.wordCountBefore)) * 100))}% words</span>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className={`mb-3 px-3.5 py-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-2 ${
            (compressResult.verification?.dropped?.length ?? 0) > 0
              ? 'bg-amber-50 border border-amber-200 text-amber-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}>
            {compressResult.verification?.dropped?.length > 0
              ? <>⚠ {compressResult.verification.dropped.join(', ')} not found in compressed CV</>
              : <>✓ All {compressResult.verification?.preserved?.length ?? 0} keywords preserved</>}
          </div>
          <CvPdfPreview cv={compressedCvToPdfShape(compressResult.compressedCv)} zoom={50} onPageCount={setPagesAfter} />
        </div>
      </div>
    </div>
    {/* Guidance strip */}
    <div className="border-t border-slate-200 bg-white max-h-56 overflow-y-auto shrink-0">
      <div className="max-w-5xl mx-auto px-6 py-4">
        <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">✦ What changed — and why</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['tighten', 'merge', 'keep'] as const).map((type) => {
            const items = compressResult.guidance?.sections?.flatMap((s: any) => s.changes || [])?.filter((c: any) => c.type === type) || [];
            if (items.length === 0) return null;
            return (
              <div key={type} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                <p className="text-[10.5px] font-extrabold mb-2.5 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                    type === 'tighten' ? 'bg-blue-50 text-blue-700' : type === 'merge' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>{type.toUpperCase()}</span>
                  <span className="text-slate-500">{items.length} bullet{items.length > 1 ? 's' : ''}</span>
                </p>
                <div className="space-y-2">
                  {items.map((c: any, i: number) => (
                    <div key={i} className="text-[10.5px] leading-relaxed">
                      <b className="text-slate-800">Bullet {c.bulletIndexes?.map((b: number) => b + 1).join(', ') || '—'}:</b>{' '}
                      <span className="text-slate-500">{c.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
)}

{/* Confirm modal */}
{confirmOpen && compressResult && (
  <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-6">
      <p className="text-sm font-extrabold text-slate-900">Apply AI-compressed CV?</p>
      <p className="text-[11px] text-slate-500 mt-1">The original will be saved automatically — you can restore it anytime.</p>
      <div className="grid grid-cols-3 gap-2.5 my-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div className="text-base font-extrabold text-blue-600">{pagesBefore > 0 ? `${pagesBefore} → ${pagesAfter}` : '…'}</div>
          <div className="text-[9px] text-slate-400 font-semibold mt-0.5">pages before → after</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div className="text-base font-extrabold text-emerald-600">{compressResult.verification?.preserved?.length ?? 0}</div>
          <div className="text-[9px] text-slate-400 font-semibold mt-0.5">keywords preserved</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <div className="text-base font-extrabold text-emerald-600">{compressResult.verification?.dropped?.length ?? 0}</div>
          <div className="text-[9px] text-slate-400 font-semibold mt-0.5">keywords dropped</div>
        </div>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10.5px] text-slate-600 leading-relaxed">
        <b className="text-slate-800">What changes:</b> bullets tightened and merged without losing meaning. Original saved as
        <b> “Before AI compression”</b>. You can restore it via <b>Versions</b>.
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={() => setConfirmOpen(false)} className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 cursor-pointer">
          Keep original
        </button>
        <button type="button" onClick={handleAcceptCompressed} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 cursor-pointer">
          Yes, apply &amp; backup
        </button>
      </div>
    </div>
  </div>
)}

{/* Versions drawer */}
{versionsOpen && (
  <div className="fixed inset-0 z-[60] bg-black/20 flex justify-end">
    <div className="w-96 max-w-[90vw] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <History className="w-4 h-4 text-blue-600" />
          <span>CV Versions</span>
        </p>
        <button type="button" onClick={() => setVersionsOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {versions.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No backups yet. AI compression creates them automatically.</p>}
        {versions.map((v) => (
          <div key={v.id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
            <p className="text-xs font-bold text-slate-900">{v.note || 'CV version'}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{v.pages > 0 ? `${v.pages} pages · ` : ''}{new Date(v.createdAt).toLocaleString()}</p>
            <button type="button" onClick={() => restoreVersion(v.id)}
              className="mt-2.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer">
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

Also add a helper `compressedCvToPdfShape(cv: any): PdfCvShape` in `CvPdfPreview.tsx` (exported):

```tsx
export function compressedCvToPdfShape(cv: any): PdfCvShape {
  return {
    candidateName: cv.candidateName || '',
    targetRole: cv.targetRole || '',
    contactInfo: cv.contactInfo || {},
    professionalSummary: cv.professionalSummary || '',
    technicalSkills: Array.isArray(cv.technicalSkills) ? cv.technicalSkills : [],
    coreCompetencies: Array.isArray(cv.coreCompetencies) ? cv.coreCompetencies : [],
    workExperience: Array.isArray(cv.workExperience) ? cv.workExperience : [],
    projects: Array.isArray(cv.projects) ? cv.projects : [],
    education: Array.isArray(cv.education) ? cv.education : [],
    certifications: Array.isArray(cv.certifications) ? cv.certifications : [],
  };
}
```

- [ ] **Step 5: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/MasterCvScreen.tsx src/components/CvPdfPreview.tsx
git commit -m "feat: AI compress UI — button, progress, side-by-side, guidance, versions"
```

---

### Task 6: End-to-end verification

**Files:**
- None (verification only)

- [ ] **Step 1: Build and deploy**

Run:
```bash
npx vite build
docker-compose build
docker-compose up -d
```
Expected: build succeeds, container starts, `docker logs ats-cv-tailor` shows "server running".

- [ ] **Step 2: API smoke test — analyze**

Run (requires a logged-in session cookie; reuse `/tmp/admin.txt` from prior sessions or re-login via `/api/auth/guest`):

```bash
curl -s -c /tmp/admin.txt -X POST http://localhost:3000/api/auth/guest -H "Content-Type: application/json" -d '{"name":"Admin"}'
curl -s -b /tmp/admin.txt -X POST http://localhost:3000/api/cv/ai/analyze -H "Content-Type: application/json" -d '{}'
```
Expected: JSON with `success: true`, `compressedCv.workExperience` non-empty, `verification.preserved` large, `guidance.sections` present.

- [ ] **Step 3: API smoke test — accept creates a version**

```bash
# capture analyze output, extract compressedCv into /tmp/compressed.json, then:
curl -s -b /tmp/admin.txt -X POST http://localhost:3000/api/cv/ai/accept -H "Content-Type: application/json" -d @/tmp/accept.json
curl -s -b /tmp/admin.txt http://localhost:3000/api/cv/versions
```
Expected: `success: true`; versions list contains one entry with note "Before AI compression".

- [ ] **Step 4: Browser test — full flow**

Open http://localhost:3000 → account menu → Master Candidate CV → click **AI Compress** → watch 4 progress steps → result view shows two previews + guidance → click **Use this version** → confirm modal → **Yes, apply & backup** → screen returns to editor with the compressed CV → **Versions** → backup entry present → **Restore** → original CV returns.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: AI compression polish after e2e verification"
git push origin main
```

---

## Self-Review Notes

- Spec coverage: marketData (Task 2), 3 phases (Task 3), BYOK via `ask()` (Task 3), backup/restore (Tasks 1+4), confirm modal (Task 5), page counts client-side (Task 5 via `onPageCount`), guidance UI (Task 5), error handling (Task 5 `aiError` + Task 4 status codes). All spec sections covered.
- Placeholder scan: every step has concrete code; no TBDs.
- Type consistency: `CompressResult` fields used identically in Task 4 route and Task 5 UI (`guidance`, `compressedCv`, `verification.preserved/dropped`, `wordCountBefore/After`, `marketSummary`). `getMarketData` return shape matches `compressCv` param type via `ReturnType<typeof getMarketData>`.
