# Recruiters Apify Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the Apify actor's `recruiterName`/`recruiterUrl` on jobs, create/enrich Recruiters-channel contacts from them (profile-only entries included), and surface recruiter LinkedIn profiles in the Recruiters screen and the Job Detail modal.

**Architecture:** The actor output already carries recruiter metadata — `apifyScraper.ts` currently drops it. We map it onto the `Job` type, then the existing per-job contact upsert (`upsertContactsFromJob`) gains a recruiter branch: dedupe by LinkedIn URL → merge by name → insert a profile-only contact. UI reads the same `/api/contacts` payload plus the job object.

**Tech Stack:** TypeScript, Express + better-sqlite3 (server), React 19 (client). No new dependencies. Existing patterns: scoped `<style>` blocks with `rc-` prefixed classes in RecruitersScreen, Tailwind elsewhere, `node --experimental-strip-types` for one-off server-module checks.

## Global Constraints

- No new npm packages; no changes to auth, scraping triggers, or other navigation.
- `hr_contacts` migrations follow the existing rebuild pattern (idempotent, guarded by a `pragma table_info` column check) used for the `phone` column.
- Recruiter fields are **optional**; jobs without them (free scrapers, Manual JD) must behave exactly as before.
- `npx tsc --noEmit` and `npx vite build` must pass after every task.
- Docker rebuild + `docker-compose logs` must show "server running".
- UI copy: "Recruiter:" label in Job Detail; LinkedIn button tooltip "Open LinkedIn profile".
- Profile-only contacts get `type = 'recruit'`, `type_label = 'Recruiting'`.

---

### Task 1: Job type fields + Apify mapping

**Files:**
- Modify: `src/types.ts` (Job interface)
- Modify: `server/scraper/apifyScraper.ts` (`mapItem`, returned object ~line 155-175)

**Interfaces:**
- Produces: `Job.recruiterName?: string`, `Job.recruiterUrl?: string` — consumed by Task 2 (`upsertContactsFromJob`) and Task 4 (`JobDetailModal`).

- [ ] **Step 1: Add the optional fields to the `Job` interface**

In `src/types.ts`, inside the `Job` interface (next to the other optional fields such as `lowCompetition`), add:

```ts
  recruiterName?: string;
  recruiterUrl?: string;
```

- [ ] **Step 2: Map the actor output in `mapItem`**

In `server/scraper/apifyScraper.ts`, in the object returned by `mapItem` (after the `...(applicants.lowCompetition ? { lowCompetition: true } : {})` line), add:

```ts
    ...(item.recruiterName ? { recruiterName: String(item.recruiterName) } : {}),
    ...(item.recruiterUrl ? { recruiterUrl: String(item.recruiterUrl) } : {}),
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

Run: `npx vite build 2>&1 | tail -1`
Expected: `✓ built in <n>ms`

- [ ] **Step 4: Commit**

```bash
git add src/types.ts server/scraper/apifyScraper.ts
git commit -m "feat: carry recruiterName/recruiterUrl from the Apify actor onto jobs"
```

---

### Task 2: Storage — columns, migration, upsert branch, list mapping

**Files:**
- Modify: `server/storage/fileStorage.ts`
  - `HrContact` interface (~line 20)
  - `migrateContactsTable` (guard + rebuild SQL)
  - `upsertContactsFromJob` (recruiter branch after the email/phone loop)
  - `listContacts` row mapping

**Interfaces:**
- Consumes: `Job.recruiterName` / `Job.recruiterUrl` (Task 1).
- Produces: `HrContact.recruiterName: string | null`, `HrContact.recruiterUrl: string | null`; `/api/contacts` rows carry them — consumed by Task 3.

- [ ] **Step 1: Extend the `HrContact` interface**

Add after `phone: string | null;`:

```ts
  recruiterName: string | null;
  recruiterUrl: string | null;
```

- [ ] **Step 2: Extend the migration**

In `migrateContactsTable`, change the guard from `if (!cols.has('phone'))` to:

```ts
    if (!cols.has('phone') || !cols.has('recruiter_url')) {
```

In the rebuild SQL inside that block, add the two columns to `CREATE TABLE hr_contacts_new` and to the `INSERT ... SELECT` (the `ALTER TABLE ... RENAME` carries them automatically):

```sql
        CREATE TABLE hr_contacts_new (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT, name TEXT,
          type TEXT NOT NULL DEFAULT 'company', type_label TEXT NOT NULL DEFAULT 'Company',
          company TEXT, job_role TEXT, source_job_id TEXT, source_job_url TEXT,
          job_count INTEGER DEFAULT 1, context TEXT, hidden INTEGER DEFAULT 0,
          first_seen TEXT, last_seen TEXT, phone TEXT,
          recruiter_name TEXT, recruiter_url TEXT
        );
        INSERT INTO hr_contacts_new (id, user_id, email, name, type, type_label, company, job_role, source_job_id, source_job_url, job_count, context, hidden, first_seen, last_seen, phone, recruiter_name, recruiter_url)
          SELECT id, user_id, email, name, type, type_label, company, job_role, source_job_id, source_job_url, job_count, context, hidden, first_seen, last_seen, phone, NULL, NULL FROM hr_contacts;
```

- [ ] **Step 3: Add the recruiter branch to `upsertContactsFromJob`**

After the existing `for (const c of contacts) { ... }` loop, add:

```ts
  // Recruiter enrichment — Apify actor output. Dedupe by LinkedIn URL,
  // then merge into a name-matching contact, else insert profile-only.
  const recruiterName = (job as any).recruiterName ? String((job as any).recruiterName) : '';
  const recruiterUrl = (job as any).recruiterUrl ? String((job as any).recruiterUrl) : '';
  if (recruiterName || recruiterUrl) {
    const recFindByUrl = d.prepare('SELECT * FROM hr_contacts WHERE user_id = ? AND recruiter_url = ?');
    const recFindByName = d.prepare('SELECT * FROM hr_contacts WHERE user_id = ? AND lower(name) = lower(?)');
    const recUpdate = d.prepare(`
      UPDATE hr_contacts SET
        job_count = job_count + 1,
        last_seen = ?,
        type = 'recruit',
        type_label = 'Recruiting',
        name = CASE WHEN ? IS NOT NULL THEN ? ELSE name END,
        recruiter_name = COALESCE(?, recruiter_name),
        recruiter_url = COALESCE(?, recruiter_url),
        company = CASE WHEN company = '' THEN ? ELSE company END,
        job_role = CASE WHEN job_role = '' THEN ? ELSE job_role END
      WHERE id = ?
    `);
    const existingRec =
      (recruiterUrl ? recFindByUrl.get(userId, recruiterUrl) : undefined) ||
      (recruiterName ? recFindByName.get(userId, recruiterName) : undefined);
    if (existingRec) {
      recUpdate.run(now, recruiterName || null, recruiterName || null, recruiterName || null, recruiterUrl || null, job.company || '', job.title || '', existingRec.id);
    } else {
      const rid = `hr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      insert.run(rid, userId, null, null, recruiterName || null, 'recruit', 'Recruiting', job.company || '', job.title || '', job.id, job.url || '', '', now, now);
      d.prepare('UPDATE hr_contacts SET recruiter_name = ?, recruiter_url = ? WHERE id = ?').run(recruiterName || null, recruiterUrl || null, rid);
    }
  }
```

(Note: the `insert` statement already accepts nullable email/phone — its parameter order is `id, user_id, email, phone, name, type, type_label, company, job_role, source_job_id, source_job_url, context, first_seen, last_seen`.)

- [ ] **Step 4: Map the new columns in `listContacts`**

In the row-mapping object, add after `phone: r.phone || null,`:

```ts
      recruiterName: r.recruiter_name || null,
      recruiterUrl: r.recruiter_url || null,
```

- [ ] **Step 5: Type-check, build, restart**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → `✓ built in <n>ms`
Run: `docker-compose build -q && docker-compose up -d && sleep 4 && docker-compose logs --tail 6 2>&1 | grep -iE "Contacts|server running"`
Expected: a `[Contacts] hr_contacts migrated to support phones` line (first boot after this task) and `server running at http://0.0.0.0:3000`.

- [ ] **Step 6: Live end-to-end verification (small real search)**

Create a guest session and run a 5-job Apify search:

```bash
curl -s -c /tmp/rec-cookie.txt -X POST http://localhost:3000/api/auth/guest -H "Content-Type: application/json" -d '{"name":"RecTest"}'
curl -s -b /tmp/rec-cookie.txt -X POST http://localhost:3000/api/jobs/scrape -H "Content-Type: application/json" -d '{"keywords":"DevOps Engineer","location":"Worldwide","sources":["LinkedIn"],"datePostedFilter":"7d","jobType":"remote","maxJobsPerSource":5,"experienceLevel":"all"}'
```

Expected: `added: 5` (or fewer if duplicates already exist in this account).

Then confirm the stored jobs carry the recruiter fields and the contacts API exposes them:

```bash
docker exec ats-cv-tailor node -e "const db=require('better-sqlite3')('/app/data/ats_jobs.sqlite');const rows=db.prepare('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 5').all();rows.forEach(r=>{const j=JSON.parse(r.data);console.log(j.title?.slice(0,30),'| recruiter:',j.recruiterName||'-','|',j.recruiterUrl||'')})"
curl -s -b /tmp/rec-cookie.txt http://localhost:3000/api/contacts | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('contacts:',j.contacts.length);j.contacts.filter(c=>c.recruiterUrl).forEach(c=>console.log('-',c.name,'|',c.recruiterUrl,'| x'+c.jobCount))})"
```

Expected: at least one job line with a `recruiter:` value, and at least one contact row with `recruiterUrl` (profile-only or merged).

- [ ] **Step 7: Dedupe check — run the same search again**

```bash
curl -s -b /tmp/rec-cookie.txt -X POST http://localhost:3000/api/jobs/scrape -H "Content-Type: application/json" -d '{"keywords":"DevOps Engineer","location":"Worldwide","sources":["LinkedIn"],"datePostedFilter":"7d","jobType":"remote","maxJobsPerSource":5,"experienceLevel":"all"}'
curl -s -b /tmp/rec-cookie.txt http://localhost:3000/api/contacts | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('contacts after 2nd run:',j.contacts.length)})"
```

Expected: contact count does NOT double; recruiter rows show `job_count > 1`.

- [ ] **Step 8: Commit**

```bash
git add server/storage/fileStorage.ts
git commit -m "feat: store recruiter name/LinkedIn URL on contacts (URL dedupe, name merge, profile-only rows)"
```

---

### Task 3: Recruiters screen — LinkedIn profile buttons + profile-only rows

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `Contact.recruiterName` / `Contact.recruiterUrl` from the `/api/contacts` payload (Task 2).

- [ ] **Step 1: Extend the `Contact` interface**

Add after `phone: string | null;`:

```ts
  recruiterName: string | null;
  recruiterUrl: string | null;
```

- [ ] **Step 2: Copy fallback — LinkedIn URL when no email/phone**

Change `copyEmail` so the copied value falls back to the recruiter URL:

```ts
  const copyEmail = async (c: Contact) => {
    const value = c.email || c.phone || c.recruiterUrl || '';
```

- [ ] **Step 3: Search matches recruiter names**

In the `visible` filter, extend the query condition:

```ts
      (!ql || (c.name || '').toLowerCase().includes(ql) || (c.recruiterName || '').toLowerCase().includes(ql) || (c.email || '').toLowerCase().includes(ql) || (c.phone || '').includes(ql) || c.company.toLowerCase().includes(ql))
```

- [ ] **Step 4: LinkedIn button on cards**

In the contact card, inside `.rc-acts` (before the Copy button), add a LinkedIn button that renders only when `recruiterUrl` exists:

```tsx
                  {c.recruiterUrl && (
                    <a className="rc-btn rc-linkedin" href={c.recruiterUrl} target="_blank" rel="noreferrer" title="Open LinkedIn profile">
                      <Linkedin size={13} /> LinkedIn
                    </a>
                  )}
```

Add `Linkedin` to the lucide import in this file.

- [ ] **Step 5: Card name display for profile-only rows**

The name line already falls back to email local-part or phone; extend it to fall back to the recruiter name:

```tsx
                    {c.name || (c.email ? c.email.split('@')[0] : c.phone || c.recruiterName || 'Contact')}
```

- [ ] **Step 6: Style the LinkedIn button**

In the `<style>` block, after the `.rc-btn.copied` rule, add:

```css
        .rc-linkedin { border-color: #B3C7F0; color: #0A66C2; background: #F5F8FE; }
        .rc-linkedin:hover { background: #E9F0FC; border-color: #0A66C2; }
```

- [ ] **Step 7: Type-check, build, deploy**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → `✓ built in <n>ms`
Run: `docker-compose build -q && docker-compose up -d && sleep 4 && docker-compose logs --tail 2 2>&1 | grep "server running"`

- [ ] **Step 8: Browser verification**

Log in as the `RecTest` guest, open **Recruiters** from the appbar, and verify:
- At least one card shows a **LinkedIn** button; profile-only rows render name + tag + meta without an email/phone chip
- Clicking LinkedIn opens the profile in a new tab
- The copy button on a profile-only row copies the LinkedIn URL
- Searching a recruiter's name filters to their rows

- [ ] **Step 9: Commit**

```bash
git add src/components/RecruitersScreen.tsx
git commit -m "feat: LinkedIn profile buttons + profile-only rows in Recruiters"
```

---

### Task 4: Job Detail modal — recruiter row

**Files:**
- Modify: `src/components/JobDetailModal.tsx`

**Interfaces:**
- Consumes: `Job.recruiterName` / `Job.recruiterUrl` (Task 1).

- [ ] **Step 1: Render the recruiter row**

In the details tab, immediately after the contacts box block (`{jobEmails.length > 0 && (...)}`), add:

```tsx
                {job.recruiterName && job.recruiterUrl && (
                  <div className="mt-3 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Recruiter: <b className="text-slate-800">{job.recruiterName}</b>
                    </span>
                    <a href={job.recruiterUrl} target="_blank" rel="noreferrer"
                      className="ml-auto text-[11px] font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
                      LinkedIn <ExternalLink size={11} />
                    </a>
                  </div>
                )}
```

(`ExternalLink` is already imported in this file.)

- [ ] **Step 2: Type-check, build, deploy**

Run: `npx tsc --noEmit` → exit 0
Run: `npx vite build 2>&1 | tail -1` → `✓ built in <n>ms`
Run: `docker-compose build -q && docker-compose up -d && sleep 4 && docker-compose logs --tail 2 2>&1 | grep "server running"`

- [ ] **Step 3: Browser verification**

As `RecTest`, open a job from the search results that carries recruiter data (check the DB from Task 2 Step 6 output for a job id with `recruiterName`), open its detail modal, and verify the "Recruiter: <name> · LinkedIn ↗" row renders and links out.

- [ ] **Step 4: Commit**

```bash
git add src/components/JobDetailModal.tsx
git commit -m "feat: show recruiter name + LinkedIn profile in job details"
```

---

### Task 5: Final gate

- [ ] **Step 1: Full gate**

```bash
npx tsc --noEmit && npm audit --audit-level=high 2>&1 | tail -1 && npx vite build 2>&1 | tail -1
```

Expected: tsc exit 0, `found 0 vulnerabilities`, `✓ built in <n>ms`.

- [ ] **Step 2: Regression pass**

- Existing email/phone extraction still works (Recruiters shows email chips, phone chips, copy-all).
- Hide/dismiss, search, company filter all still work.
- Non-LinkedIn jobs (e.g., a Manual JD analysis) do not create recruiter rows.

- [ ] **Step 3: Commit any stragglers**

```bash
git status --short
git add -A && git commit -m "chore: final polish"  # only if there are uncommitted changes
```
