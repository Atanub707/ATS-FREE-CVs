# Apify Job Fields + Filters + skipJobId — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture 4 structured fields from the Apify actor, send contract-type/experience-level filter codes to it, and pass `skipJobId` so repeat searches don't re-fetch or re-charge existing jobs.

**Architecture:** New optional fields on `Job` mapped in `mapItem`; ScraperBar sends filter codes through `ScraperParams` to the actor input; the scrape route gathers existing LinkedIn job IDs and passes them as `skipJobId`; UI renders badges + company link. Other scrapers ignore the new params.

**Tech Stack:** TypeScript, Express, React 19, Tailwind. No new dependencies.

## Global Constraints

- All new Job fields optional; jobs without them behave exactly as before.
- Only the Apify path consumes `contractType`/`experienceLevel`/`jobIds`; free scrapers must not change behavior.
- LinkedIn codes (exact values): contractType `F`=Full-time, `P`=Part-time, `C`=Contract, `T`=Temporary, `I`=Internship; experienceLevel `1`=Internship, `2`=Entry, `3`=Associate, `4`=Mid-Senior, `5`=Director, `6`=Executive.
- `skipJobId` list capped at 1000; IDs are the actor's numeric LinkedIn job ids (DB ids stripped of the `linkedin-` prefix).
- `npx tsc --noEmit` and `npx vite build` pass after every task; Docker boots with "server running".
- Existing filters (remote/date/limit/under-10-applicants) unaffected.

---

### Task 1: Job type fields + Apify mapping

**Files:**
- Modify: `src/types.ts` (Job interface)
- Modify: `server/scraper/apifyScraper.ts` (`mapItem`)

**Interfaces:**
- Produces: `Job.experienceLevel?: string`, `Job.contractType?: string`, `Job.companyUrl?: string`, `Job.applyType?: string` — consumed by Task 4 (UI).

- [ ] **Step 1: Add the optional fields to the `Job` interface**

In `src/types.ts`, inside the `Job` interface (next to `recruiterName`/`recruiterUrl`), add:

```ts
  experienceLevel?: string;
  contractType?: string;
  companyUrl?: string;
  applyType?: string;
```

- [ ] **Step 2: Map the actor output in `mapItem`**

In `server/scraper/apifyScraper.ts`, in the object returned by `mapItem` (after the recruiterUrl line), add:

```ts
    ...(item.experienceLevel ? { experienceLevel: String(item.experienceLevel) } : {}),
    ...(item.contractType ? { contractType: String(item.contractType) } : {}),
    ...(item.companyUrl ? { companyUrl: String(item.companyUrl) } : {}),
    ...(item.applyType ? { applyType: String(item.applyType) } : {}),
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → `✓ built in <n>ms`

- [ ] **Step 4: Commit**

```bash
git add src/types.ts server/scraper/apifyScraper.ts
git commit -m "feat: capture experienceLevel/contractType/companyUrl/applyType from the Apify actor"
```

---

### Task 2: Filter codes — contract type + experience level reach the actor

**Files:**
- Modify: `src/types.ts` (`ScraperParams`)
- Modify: `src/components/ScraperBar.tsx` (selects)
- Modify: `server.ts` (route param forwarding)
- Modify: `server/scraper/apifyScraper.ts` (input)

**Interfaces:**
- Consumes: existing `ScraperParams.experienceLevel?: ExperienceLevel`; replaces its semantics.
- Produces: `ScraperParams.contractType?: string` (actor code), `ScraperParams.experienceLevel?: string` (actor code). Consumed by `apifyScraper.scrape`.

- [ ] **Step 1: Update `ScraperParams`**

In `src/types.ts`, change:

```ts
export interface ScraperParams {
  ...
  jobTitle?: string;
  experienceLevel?: ExperienceLevel;
  under10Applicants?: boolean;
}
```

to:

```ts
export interface ScraperParams {
  ...
  jobTitle?: string;
  contractType?: string;
  experienceLevel?: string;
  under10Applicants?: boolean;
}
```

Remove the now-unused `ExperienceLevel` type if it becomes unused (check first; if referenced elsewhere keep it).

- [ ] **Step 2: Update the ScraperBar selects**

In `src/components/ScraperBar.tsx`:

Replace the experience-level select options (currently `all`/`entry`/`mid`/`senior`/`lead`) with:

```tsx
<option value="">Any level</option>
<option value="1">Internship</option>
<option value="2">Entry</option>
<option value="3">Associate</option>
<option value="4">Mid-Senior</option>
<option value="5">Director</option>
<option value="6">Executive</option>
```

Add a new Contract type select next to it (same layout as the other filters):

```tsx
<select
  value={contractType}
  onChange={(e) => setContractType(e.target.value)}
  className={selectClass}
>
  <option value="">Any contract</option>
  <option value="F">Full-time</option>
  <option value="P">Part-time</option>
  <option value="C">Contract</option>
  <option value="T">Temporary</option>
  <option value="I">Internship</option>
</select>
```

Update state: `const [contractType, setContractType] = useState('');` and change the experience state default to `''` (values now actor codes). Pass both in the `onScrape` call:

```tsx
contractType: contractType || undefined,
experienceLevel: experienceLevel || undefined,
```

- [ ] **Step 3: Forward in the scrape route**

In `server.ts` (the scrape route, around line 970), add `contractType` to the destructure and pass it through:

```ts
const { ..., contractType, experienceLevel, under10Applicants } = req.body;
...
contractType: contractType || undefined,
experienceLevel: experienceLevel || undefined,
```

- [ ] **Step 4: Actor input**

In `server/scraper/apifyScraper.ts` `scrape()`, after the `remote` input block, add:

```ts
      if (params.experienceLevel) {
        input.experienceLevel = [params.experienceLevel];
      }
      if (params.contractType) {
        input.contractType = [params.contractType];
      }
```

(actor schema: `experienceLevel` array of 1-6 strings, `contractType` array of F/P/C/T/I/O strings)

- [ ] **Step 5: Type-check, build, deploy, live check**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → ✓ built
Run: `docker-compose build -q && docker-compose up -d && sleep 5 && docker-compose logs --tail 2 2>&1 | grep "server running"`

Live check — a 3-job search with Contract=Full-time (`F`) and level Entry (`2`):
```bash
curl -s -c /tmp/f-cookie.txt -X POST http://localhost:3000/api/auth/guest -H "Content-Type: application/json" -d '{"name":"FiltTest"}'
curl -s -b /tmp/f-cookie.txt -X POST http://localhost:3000/api/jobs/scrape -H "Content-Type: application/json" -d '{"keywords":"DevOps Engineer","location":"Worldwide","sources":["LinkedIn"],"datePostedFilter":"30d","jobType":"remote","maxJobsPerSource":3,"contractType":"F","experienceLevel":"2","under10Applicants":false}'
docker exec ats-cv-tailor node -e "const db=require('better-sqlite3')('/app/data/ats_jobs.sqlite');const rows=db.prepare('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 3').all();rows.forEach(r=>{const j=JSON.parse(r.data);console.log(j.title?.slice(0,28),'| contract:',j.contractType||'-','| level:',j.experienceLevel||'-','| easy:',j.applyType||'-')})"
```
Expected: the newest jobs carry `contractType: "Full-time"` and `experienceLevel: "Entry"` (the actor echoes them back).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/components/ScraperBar.tsx server.ts server/scraper/apifyScraper.ts
git commit -m "feat: send contract-type and experience-level codes to the Apify actor"
```

---

### Task 3: skipJobId — don't re-fetch existing LinkedIn jobs

**Files:**
- Modify: `src/types.ts` (`ScraperParams.jobIds`)
- Modify: `server.ts` (gather ids, pass to scrape)
- Modify: `server/scraper/apifyScraper.ts` (input.skipJobId)

**Interfaces:**
- Produces: `ScraperParams.jobIds?: string[]` (numeric LinkedIn ids) — consumed by `apifyScraper.scrape`.

- [ ] **Step 1: Add `jobIds` to `ScraperParams`**

In `src/types.ts`:

```ts
  under10Applicants?: boolean;
  jobIds?: string[];
```

- [ ] **Step 2: Gather existing LinkedIn ids in the scrape route**

In `server.ts`, inside the scrape route, before `ScraperFactory.scrape(...)`, add (use the already-imported `getAllJobs` or query directly):

```ts
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
```

Pass it in the scrape params:

```ts
        jobIds,
```

- [ ] **Step 3: Actor input**

In `server/scraper/apifyScraper.ts` `scrape()`, add:

```ts
      if (params.jobIds && params.jobIds.length > 0) {
        input.skipJobId = params.jobIds;
      }
```

- [ ] **Step 4: Type-check, build, deploy, live check**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → ✓ built
Run: `docker-compose build -q && docker-compose up -d && sleep 5 && docker-compose logs --tail 2 2>&1 | grep "server running"`

Run the SAME search twice with the FiltTest cookie (3 jobs, 30d, remote):
```bash
curl -s -b /tmp/f-cookie.txt -X POST http://localhost:3000/api/jobs/scrape -H "Content-Type: application/json" -d '{"keywords":"DevOps Engineer","location":"Worldwide","sources":["LinkedIn"],"datePostedFilter":"30d","jobType":"remote","maxJobsPerSource":3,"under10Applicants":false}'
```
Expected: first run `added: 3` (or fewer if the user already has them); second run `added: 0` (or fewer than the first) — the actor skips the ids already stored. Check the server log for the `[Apify] Got N LinkedIn jobs` line dropping on the second run.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts server.ts server/scraper/apifyScraper.ts
git commit -m "feat: skipJobId — Apify skips LinkedIn jobs already in the database"
```

---

### Task 4: UI badges + company link

**Files:**
- Modify: `src/components/JobMatrix.tsx` (job card badges)
- Modify: `src/components/JobDetailModal.tsx` (badges + company link)

**Interfaces:**
- Consumes: `Job.experienceLevel`, `Job.contractType`, `Job.companyUrl`, `Job.applyType` (Task 1).

- [ ] **Step 1: Job card badges**

In `src/components/JobMatrix.tsx`, find where the job card renders the skill chips row (the flex of keyword chips, e.g. `vulnerability management`, `Windows`, ...) and add, just before/after that row, a badges row:

```tsx
{(job.contractType || job.experienceLevel || job.applyType === 'EASY_APPLY') && (
  <div className="flex flex-wrap gap-1.5 mb-1.5">
    {job.applyType === 'EASY_APPLY' && (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">⚡ Easy Apply</span>
    )}
    {job.contractType && (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">{job.contractType}</span>
    )}
    {job.experienceLevel && (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">{job.experienceLevel}</span>
    )}
  </div>
)}
```

(Adjust the exact insertion point to wherever the keyword chips render; keep the badges visually subtle.)

- [ ] **Step 2: Job Detail badges + company link**

In `src/components/JobDetailModal.tsx`, in the details tab header area (near the title/company block), add:

```tsx
{(job.contractType || job.experienceLevel || job.applyType === 'EASY_APPLY') && (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {job.applyType === 'EASY_APPLY' && (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">⚡ Easy Apply</span>
    )}
    {job.contractType && (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">{job.contractType}</span>
    )}
    {job.experienceLevel && (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">{job.experienceLevel}</span>
    )}
  </div>
)}
{job.companyUrl && (
  <a href={job.companyUrl} target="_blank" rel="noreferrer"
     className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-blue-600 hover:underline">
    Open company <ExternalLink size={11} />
  </a>
)}
```

(`ExternalLink` is already imported in JobDetailModal.)

- [ ] **Step 3: Type-check, build, deploy, browser check**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → ✓ built
Run: `docker-compose build -q && docker-compose up -d && sleep 5 && docker-compose logs --tail 2 2>&1 | grep "server running"`

Browser: log in as a guest, search once, and confirm a job with contract/level data shows the badges on the card and in the detail modal; a job with `companyUrl` shows "Open company".

- [ ] **Step 4: Commit**

```bash
git add src/components/JobMatrix.tsx src/components/JobDetailModal.tsx
git commit -m "feat: show contract type, experience level, Easy Apply and company link on jobs"
```

---

### Task 5: Final gate

- [ ] **Step 1: Full gate**

```bash
npx tsc --noEmit && npm audit --audit-level=high 2>&1 | tail -1 && npx vite build 2>&1 | tail -1
```

Expected: tsc exit 0, `found 0 vulnerabilities`, `✓ built in <n>ms`.

- [ ] **Step 2: Regression**

- Existing filters (Remote, Posted, Limit, Under 10 applicants) still work.
- Recruiters screen unaffected.
- Non-Apify sources unaffected (their scrapers ignore the new params).
- Badges don't break the card layout.

- [ ] **Step 3: Commit any stragglers**

```bash
git status --short
git add -A && git commit -m "chore: final polish"  # only if uncommitted changes exist
```
