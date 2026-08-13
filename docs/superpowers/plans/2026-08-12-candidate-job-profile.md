# Candidate Job Profile (Account-level) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-account **Job Preferences profile** (separate from the CV) that captures work-mode preference, preferred locations, notice period/availability, compensation (current/expected), employment-type preference, relocation/travel willingness, work authorization, languages, industries, and a free-text recruiter note — and feed it to the AI email draft alongside the Master CV so drafts become more personalized (availability, work mode, location fit).

**Architecture:**
1. Storage: new `candidate_profile` table (`user_id` PK, JSON payload + `updated_at`) in `server/storage/fileStorage.ts`, mirroring the `master_cv` pattern — flexible schema, no migration churn when fields evolve.
2. API: `GET /api/profile` and `PUT /api/profile` (auth-scoped like `/api/cv/master`).
3. UI: **Settings → Account** gains a "Job Preferences" section (right side of the Account tab) with grouped fields; saved with the existing "Apply Config"-style save flow. Uses the `searchLocations` lib for preferred-location autocomplete.
4. AI: the email-draft endpoint loads `getCandidateProfile()` and injects availability/preferences into the prompt. **Compensation fields are stored for future AI matching/negotiation but are NOT sent in cold emails by default** (recruiters don't need expected salary in an intro email; notice period and work mode ARE included — they're the classic "fit" signals recruiters ask first).

**Tech Stack:** Existing stack. No new dependencies (locations use the already-added `country-state-city` via `src/lib/locations.ts`).

## Global Constraints

- Gate: `npx tsc --noEmit`, `npm test`, `npx vite build` all pass; 0 new vulnerabilities
- No new runtime dependencies
- Follow existing patterns: storage exports in `fileStorage.ts`, routes in `server.ts`, scoped CSS in component `<style>` blocks, Settings uses its scoped `--st-*` tokens
- Per-user isolation: every read/write scoped via `getCurrentUserId()` / `runWithUser`
- All fields optional; empty profile = feature inert (no draft behavior change until the user fills it)
- Commit per task with the plan's messages; never push unless the user asks

---

### Task 1: Storage — `candidate_profile` table + CRUD functions

**Files:**
- Modify: `server/storage/fileStorage.ts`
- Test: `tests/recruiters/storage.test.ts` (add cases) — extend `tests/recruiters/initDb.ts` if needed

**Interfaces:**
- Consumes: existing `getDb`, `runWithUser`, `getCurrentUserId`
- Produces (used by later tasks — exact signatures):
  - `export interface CandidateProfile { workModes: string[]; preferredLocations: string[]; noticePeriod: string; availableFrom: string; employmentTypes: string[]; yearsExperience: string; currentRole: string; currentCompany: string; currentSalary: string; expectedSalaryMin: string; expectedSalaryMax: string; salaryCurrency: string; jobSearchStatus: string; willingToRelocate: boolean; willingToTravelPct: string; workAuthorization: string; needsSponsorship: boolean; languages: string[]; preferredIndustries: string[]; preferredCompanySize: string; recruiterNote: string; }`
  - `getCandidateProfile(): CandidateProfile` — returns stored profile or an all-empty default (never throws)
  - `saveCandidateProfile(p: CandidateProfile): void` — upsert by user_id

- [ ] **Step 1: Write failing storage tests**

Append to `tests/recruiters/storage.test.ts`:

```ts
import { ..., getCandidateProfile, saveCandidateProfile } from '../../server/storage/fileStorage';

  it('returns an empty default profile when none saved', () => {
    runWithUser('u1', () => {
      const p = getCandidateProfile();
      expect(p.noticePeriod).toBe('');
      expect(p.workModes).toEqual([]);
    });
  });

  it('saves and reloads a candidate profile', () => {
    runWithUser('u1', () => {
      const p = getCandidateProfile();
      const filled = { ...p, noticePeriod: '30 days', workModes: ['remote', 'hybrid'], preferredLocations: ['Kolkata, West Bengal, India'], expectedSalaryMin: '1200000', expectedSalaryMax: '1800000', salaryCurrency: 'INR' };
      saveCandidateProfile(filled);
      const reloaded = getCandidateProfile();
      expect(reloaded.noticePeriod).toBe('30 days');
      expect(reloaded.workModes).toEqual(['remote', 'hybrid']);
      expect(reloaded.expectedSalaryMax).toBe('1800000');
    });
  });

  it('keeps profiles isolated per user', () => {
    runWithUser('u1', () => {
      const p = getCandidateProfile();
      saveCandidateProfile({ ...p, noticePeriod: 'immediate' });
    });
    runWithUser('u2', () => {
      expect(getCandidateProfile().noticePeriod).toBe('');
    });
  });
```

- [ ] **Step 2: Run tests — verify RED**

Run: `npm test`
Expected: FAIL — `getCandidateProfile is not a function`

- [ ] **Step 3: Implement**

In `fileStorage.ts`, near the master_cv functions:

```ts
export interface CandidateProfile {
  workModes: string[];
  preferredLocations: string[];
  noticePeriod: string;
  availableFrom: string;
  employmentTypes: string[];
  yearsExperience: string;
  currentRole: string;
  currentCompany: string;
  currentSalary: string;
  expectedSalaryMin: string;
  expectedSalaryMax: string;
  salaryCurrency: string;
  jobSearchStatus: string;
  willingToRelocate: boolean;
  willingToTravelPct: string;
  workAuthorization: string;
  needsSponsorship: boolean;
  languages: string[];
  preferredIndustries: string[];
  preferredCompanySize: string;
  recruiterNote: string;
}

const EMPTY_CANDIDATE_PROFILE: CandidateProfile = {
  workModes: [], preferredLocations: [], noticePeriod: '', availableFrom: '',
  employmentTypes: [], yearsExperience: '', currentRole: '', currentCompany: '',
  currentSalary: '', expectedSalaryMin: '', expectedSalaryMax: '', salaryCurrency: '',
  jobSearchStatus: '', willingToRelocate: false, willingToTravelPct: '',
  workAuthorization: '', needsSponsorship: false, languages: [],
  preferredIndustries: [], preferredCompanySize: '', recruiterNote: '',
};

function ensureCandidateProfileTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidate_profile (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
```

Call `ensureCandidateProfileTable(db);` in the `getDb()` schema block (next to `ensureContactEmailsTable`).

```ts
export function getCandidateProfile(): CandidateProfile {
  const userId = getCurrentUserId();
  if (!userId) return { ...EMPTY_CANDIDATE_PROFILE };
  try {
    const row = getDb().prepare('SELECT data FROM candidate_profile WHERE user_id = ?').get(userId) as { data: string } | undefined;
    if (row) return { ...EMPTY_CANDIDATE_PROFILE, ...JSON.parse(row.data) };
  } catch (err) {
    console.error('Error reading candidate profile:', err);
  }
  return { ...EMPTY_CANDIDATE_PROFILE };
}

export function saveCandidateProfile(p: CandidateProfile): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    getDb().prepare(`
      INSERT INTO candidate_profile (user_id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(userId, JSON.stringify(p), new Date().toISOString());
  } catch (err) {
    console.error('Error saving candidate profile:', err);
  }
}
```

- [ ] **Step 4: Run tests — verify GREEN**

Run: `npm test`
Expected: all pass (3 new cases)

- [ ] **Step 5: Gates + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add server/storage/fileStorage.ts tests/recruiters/storage.test.ts && git commit -m "feat(profile): candidate job profile table + storage CRUD"`

---

### Task 2: API — `GET/PUT /api/profile`

**Files:**
- Modify: `server.ts` (near `/api/cv/master` routes)

**Interfaces:**
- Consumes: `getCandidateProfile`, `saveCandidateProfile`
- Produces:
  - `GET /api/profile` → `{ profile: CandidateProfile }` (401 when signed out)
  - `PUT /api/profile` body `{ profile: CandidateProfile }` → `{ success: true, profile }` (401 when signed out)

- [ ] **Step 1: Add routes**

Insert after the `/api/cv/master` POST block:

```ts
  app.get('/api/profile', (req, res) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return res.status(401).json({ error: 'Not signed in.' });
      res.json({ profile: getCandidateProfile() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/profile', (req, res) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) return res.status(401).json({ error: 'Not signed in.' });
      const profile = req.body?.profile;
      if (!profile || typeof profile !== 'object') {
        return res.status(400).json({ error: 'Profile is required.' });
      }
      saveCandidateProfile(profile);
      res.json({ success: true, profile: getCandidateProfile() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
```

Add `getCandidateProfile, saveCandidateProfile` to the storage import block in server.ts.

- [ ] **Step 2: Gates + commit**

Run: `npx tsc --noEmit && npm test && npx vite build`
Commit: `git add server.ts && git commit -m "feat(profile): GET/PUT /api/profile endpoints"`

---

### Task 3: Settings UI — Job Preferences section

**Files:**
- Modify: `src/components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/profile`, `searchLocations` from `../lib/locations`
- Produces: local state `candidateProfile: CandidateProfile`, loaded on Settings open, saved via a **"Save Job Preferences"** button with a saved-toast

- [ ] **Step 1: Load + save handlers**

Add state near the other Settings state:

```ts
const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
const [profileLocOptions, setProfileLocOptions] = useState<string[]>([]);
const [profileSaved, setProfileSaved] = useState(false);
const [profileSaving, setProfileSaving] = useState(false);
```

Load on Settings open (alongside the existing config load — find the effect that fetches config when the modal opens):

```ts
fetch('/api/profile').then((r) => r.json()).then((d) => setCandidateProfile(d.profile || null)).catch(() => setCandidateProfile(null));
```

Save handler:

```ts
const saveCandidateProfile = async () => {
  if (!candidateProfile) return;
  setProfileSaving(true);
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: candidateProfile }),
    });
    if (res.ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  } catch { /* ignore */ }
  setProfileSaving(false);
};
```

Location autocomplete (same pattern as ScraperBar):

```ts
const onProfileLocationInput = (v: string) => {
  setCandidateProfile((p) => (p ? { ...p, preferredLocations: v.split(',').map((s) => s.trim()).filter(Boolean) } : p));
  if (v.trim().length >= 1) {
    searchLocations(v.split(',').pop() || '', 8).then((list) => setProfileLocOptions(list.map((l) => l.label)));
  } else {
    setProfileLocOptions([]);
  }
};
```

**Note:** a comma-separated input for locations is simpler than a chip editor; document it in the section subtitle ("comma-separated — e.g. Kolkata, Bengaluru, Remote").

- [ ] **Step 2: Render the section**

In the **Account** tab content (find the existing account section in the Settings modal — the tab that shows name/email), add after the account details, a `Job Preferences` card:

```tsx
{candidateProfile && (
  <div className="st-card" style={{ marginTop: 18 }}>
    <div className="st-card-title">Job Preferences</div>
    <p className="st-card-sub">Extra details for the AI — used alongside your CV when drafting cold emails and matching jobs. Nothing here goes on your CV.</p>

    <div className="st-grid2">
      <div className="st-field">
        <label className="st-label">Work mode preference</label>
        <div className="st-chips">
          {['remote', 'onsite', 'hybrid', 'flexible'].map((m) => (
            <button key={m} type="button" className={`st-chip ${candidateProfile.workModes.includes(m) ? 'on' : ''}`}
              onClick={() => setCandidateProfile((p) => p && { ...p, workModes: p.workModes.includes(m) ? p.workModes.filter((x) => x !== m) : [...p.workModes, m] })}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="st-field">
        <label className="st-label">Preferred locations</label>
        <input list="profile-locations" className="st-input" placeholder="e.g. Kolkata, Bengaluru, Remote"
          value={candidateProfile.preferredLocations.join(', ')}
          onChange={(e) => onProfileLocationInput(e.target.value)} />
        <datalist id="profile-locations">{profileLocOptions.map((o) => <option key={o} value={o} />)}</datalist>
      </div>
      <div className="st-field">
        <label className="st-label">Notice period</label>
        <select className="st-input" value={candidateProfile.noticePeriod}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, noticePeriod: e.target.value })}>
          <option value="">Not set</option>
          <option>Immediate</option>
          <option>15 days</option>
          <option>30 days</option>
          <option>45 days</option>
          <option>60 days</option>
          <option>90 days</option>
          <option>Serving notice</option>
        </select>
      </div>
      <div className="st-field">
        <label className="st-label">Available from</label>
        <input type="date" className="st-input" value={candidateProfile.availableFrom}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, availableFrom: e.target.value })} />
      </div>
      <div className="st-field">
        <label className="st-label">Employment type preference</label>
        <div className="st-chips">
          {['full-time', 'part-time', 'contract', 'freelance'].map((m) => (
            <button key={m} type="button" className={`st-chip ${candidateProfile.employmentTypes.includes(m) ? 'on' : ''}`}
              onClick={() => setCandidateProfile((p) => p && { ...p, employmentTypes: p.employmentTypes.includes(m) ? p.employmentTypes.filter((x) => x !== m) : [...p.employmentTypes, m] })}>
              {m === 'full-time' ? 'Full-time' : m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="st-field">
        <label className="st-label">Years of experience</label>
        <input className="st-input" placeholder="e.g. 4+ years" value={candidateProfile.yearsExperience}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, yearsExperience: e.target.value })} />
      </div>
      <div className="st-field">
        <label className="st-label">Current role / company</label>
        <input className="st-input" placeholder="e.g. Senior DevSecOps Engineer @ Human Managed" value={`${candidateProfile.currentRole}${candidateProfile.currentRole && candidateProfile.currentCompany ? ' @ ' : ''}${candidateProfile.currentCompany}`}
          onChange={(e) => {
            const [role, company] = e.target.value.split(' @ ');
            setCandidateProfile((p) => p && { ...p, currentRole: (role || '').trim(), currentCompany: (company || '').trim() });
          }} />
      </div>
      <div className="st-field">
        <label className="st-label">Job search status</label>
        <select className="st-input" value={candidateProfile.jobSearchStatus}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, jobSearchStatus: e.target.value })}>
          <option value="">Not set</option>
          <option>Actively looking</option>
          <option>Open to opportunities</option>
          <option>Not looking</option>
        </select>
      </div>
    </div>

    <div className="st-section-title" style={{ marginTop: 16 }}>Compensation (kept private — used by the AI for matching, never sent in cold emails)</div>
    <div className="st-grid2">
      <div className="st-field">
        <label className="st-label">Current salary</label>
        <input className="st-input" placeholder="e.g. 14,00,000" value={candidateProfile.currentSalary}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, currentSalary: e.target.value })} />
      </div>
      <div className="st-field">
        <label className="st-label">Expected salary (min – max)</label>
        <div className="st-inline">
          <input className="st-input" placeholder="Min" value={candidateProfile.expectedSalaryMin}
            onChange={(e) => setCandidateProfile((p) => p && { ...p, expectedSalaryMin: e.target.value })} />
          <input className="st-input" placeholder="Max" value={candidateProfile.expectedSalaryMax}
            onChange={(e) => setCandidateProfile((p) => p && { ...p, expectedSalaryMax: e.target.value })} />
        </div>
      </div>
      <div className="st-field">
        <label className="st-label">Currency</label>
        <select className="st-input" value={candidateProfile.salaryCurrency}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, salaryCurrency: e.target.value })}>
          <option value="">Not set</option>
          <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>SGD</option><option>AUD</option><option>AED</option>
        </select>
      </div>
      <div className="st-field">
        <label className="st-label">Work authorization</label>
        <select className="st-input" value={candidateProfile.workAuthorization}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, workAuthorization: e.target.value })}>
          <option value="">Not set</option>
          <option>Citizen</option><option>Permanent resident</option><option>Work visa</option><option>Student visa</option><option>Open to sponsorship</option>
        </select>
      </div>
      <div className="st-field st-check">
        <label className="st-check-label">
          <input type="checkbox" checked={candidateProfile.needsSponsorship}
            onChange={(e) => setCandidateProfile((p) => p && { ...p, needsSponsorship: e.target.checked })} />
          I need visa sponsorship
        </label>
      </div>
      <div className="st-field">
        <label className="st-label">Willing to relocate</label>
        <div className="st-chips">
          {['yes', 'no', 'certain cities'].map((m) => (
            <button key={m} type="button" className={`st-chip ${(candidateProfile.willingToRelocate ? (m === 'yes' ? 'on' : '') : m === 'no' ? 'on' : '')}`}
              onClick={() => setCandidateProfile((p) => p && { ...p, willingToRelocate: m === 'yes' })}>
              {m === 'certain cities' ? 'Certain cities' : m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="st-field">
        <label className="st-label">Willing to travel (%)</label>
        <input className="st-input" placeholder="e.g. 25" value={candidateProfile.willingToTravelPct}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, willingToTravelPct: e.target.value })} />
      </div>
      <div className="st-field">
        <label className="st-label">Languages</label>
        <input className="st-input" placeholder="e.g. English, Hindi, Bengali" value={candidateProfile.languages.join(', ')}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </div>
      <div className="st-field">
        <label className="st-label">Preferred industries</label>
        <input className="st-input" placeholder="e.g. SaaS, Fintech, Healthcare" value={candidateProfile.preferredIndustries.join(', ')}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, preferredIndustries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </div>
      <div className="st-field">
        <label className="st-label">Preferred company size</label>
        <select className="st-input" value={candidateProfile.preferredCompanySize}
          onChange={(e) => setCandidateProfile((p) => p && { ...p, preferredCompanySize: e.target.value })}>
          <option value="">Not set</option>
          <option>Startup (1–50)</option><option>Mid-size (51–500)</option><option>Large (500+)</option><option>Any</option>
        </select>
      </div>
    </div>

    <div className="st-field" style={{ marginTop: 16 }}>
      <label className="st-label">Anything else a recruiter should know</label>
      <textarea className="st-input" rows={3} placeholder="e.g. Open to contract-to-hire, prefer teams with on-call rotation, relocating to Bangalore in Jan…"
        value={candidateProfile.recruiterNote}
        onChange={(e) => setCandidateProfile((p) => p && { ...p, recruiterNote: e.target.value })} />
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
      <button type="button" className="st-save" onClick={saveCandidateProfile} disabled={profileSaving}>
        {profileSaving ? 'Saving…' : 'Save Job Preferences'}
      </button>
      {profileSaved && <span className="st-saved-note">Saved ✓</span>}
    </div>
  </div>
)}
```

- [ ] **Step 3: CSS for the new classes (append to the Settings style block)**

```css
.st-card { background: var(--st-card, #fff); border: 1px solid var(--st-border, #E2E8F0); border-radius: 14px; padding: 18px; }
.st-card-title { font-size: 13px; font-weight: 800; color: var(--st-ink, #0F172A); }
.st-card-sub { font-size: 11.5px; color: var(--st-faint, #64748B); margin-top: 3px; line-height: 1.55; }
.st-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; margin-top: 14px; }
.st-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.st-field.st-check { justify-content: flex-end; }
.st-label { font-size: 11px; font-weight: 700; color: var(--st-muted, #475569); }
.st-input { width: 100%; border: 1.5px solid var(--st-hairline2, #CBD5E1); border-radius: 9px; padding: 8px 11px; font-size: 12.5px; color: var(--st-ink, #0F172A); background: var(--st-card, #fff); outline: none; font-family: inherit; }
.st-input:focus { border-color: var(--color-brand, #2563EB); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
.st-inline { display: flex; gap: 8px; }
.st-inline .st-input { flex: 1; }
.st-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.st-chip { font-size: 11px; font-weight: 700; border: 1.5px solid var(--st-hairline2, #CBD5E1); background: #fff; color: var(--st-muted, #475569); border-radius: 999px; padding: 5px 12px; cursor: pointer; font-family: inherit; transition: all .15s ease; }
.st-chip.on { background: var(--color-brand-soft, #EFF6FF); border-color: var(--color-brand-line, #BFDBFE); color: var(--color-brand, #2563EB); }
.st-section-title { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--st-faint, #64748B); }
.st-check-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--st-muted, #475569); cursor: pointer; }
.st-check-label input { accent-color: var(--color-brand, #2563EB); width: 15px; height: 15px; }
.st-save { padding: 9px 18px; border-radius: 10px; border: 0; background: linear-gradient(135deg, var(--color-brand, #2563EB), var(--color-brand-strong, #1D4ED8)); color: #fff; font-size: 12.5px; font-weight: 800; cursor: pointer; font-family: inherit; }
.st-save:disabled { opacity: .6; cursor: not-allowed; }
.st-saved-note { font-size: 12px; font-weight: 700; color: var(--color-cta, #059669); }
@media (max-width: 720px) { .st-grid2 { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Gates + commit**

Run: `npx tsc --noEmit && npm test && npx vite build`
Commit: `git add src/components/SettingsModal.tsx && git commit -m "feat(profile): Job Preferences section in Settings → Account"`

---

### Task 4: AI integration — draft uses the profile

**Files:**
- Modify: `server.ts` (draft endpoint)

**Interfaces:**
- Consumes: `getCandidateProfile()`
- Produces: prompt section `Candidate job preferences:` + a rule to weave availability/work-mode fit in naturally

- [ ] **Step 1: Extend the draft endpoint**

In `app.post('/api/emails/draft')`, after `const masterCv = getMasterCv();` add:

```ts
      const profile = getCandidateProfile();
      const profileLine = (label: string, value: string) => (value ? `${label}: ${value}` : '');
      const profileText = [
        profileLine('Notice period', profile.noticePeriod),
        profileLine('Available from', profile.availableFrom),
        profileLine('Work mode preference', profile.workModes.join(', ')),
        profileLine('Preferred locations', profile.preferredLocations.join(', ')),
        profileLine('Employment type preference', profile.employmentTypes.join(', ')),
        profileLine('Job search status', profile.jobSearchStatus),
        profileLine('Years of experience', profile.yearsExperience),
        profile.recruiterNote ? `Recruiter note: ${profile.recruiterNote}` : '',
      ].filter(Boolean).join('\n');
```

Add to the prompt, after `Candidate certifications: ${certsText}`:

```
Candidate job preferences (from their account — separate from the CV):
${profileText || '(none set)'}
```

Add rules (after the "Use ONLY the candidate's REAL data" rule):

```
- If "Candidate job preferences" has a notice period or availability, weave it in naturally when it helps the recruiter (e.g. "I'm available immediately" or "I'm on a 30-day notice period") — one short clause max. Do NOT invent availability if none is set.
- If the role's work mode (remote/onsite/hybrid from the job description) matches the candidate's stated preference, mention the fit briefly ("I work fully remote today, which fits this remote setup"). One clause max. Never mention salary expectations in the email body.
```

- [ ] **Step 2: Gates + commit**

Run: `npx tsc --noEmit && npm test && npx vite build`
Commit: `git add server.ts && git commit -m "feat(profile): email draft weaves in notice period + work-mode fit from account profile"`

---

### Task 5: Docs + changelog + E2E verification

**Files:**
- Modify: `docs/recruiters.md` (new section), `docs/recruiters.md` API table, `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: everything above

- [ ] **Step 1: Document**

`docs/recruiters.md` — add a `## Candidate job profile` section: purpose (account-level, not on CV), field list, API contract (`GET/PUT /api/profile`), which fields reach the email draft (notice period, availability, work mode fit) vs which stay private (compensation), test commands.

`CHANGELOG.md` — add under `## Unreleased`:

```markdown
### 👤 Candidate job profile (Settings → Account)
- Account-level job preferences kept off the CV: work mode (remote/onsite/hybrid/flexible), preferred locations (full country-state-city autocomplete), notice period + availability date, employment type, years of experience, current role/company, job search status, compensation (current + expected range + currency), work authorization + sponsorship, relocation/travel willingness, languages, industries, company size, and a free-text recruiter note.
- The AI cold-email draft now weaves in availability (notice period) and work-mode fit from the profile alongside the Master CV journey — compensation is stored but never sent in emails.
```

`README.md` — Features table: add row `**Candidate Job Profile** | Account-level job preferences (work mode, locations, notice period, salary expectations, sponsorship…) used by the AI for personalized outreach — kept off the CV |`

- [ ] **Step 2: Full gate**

Run: `npx tsc --noEmit && npm test && npm audit --audit-level=high && npx vite build`
Expected: all pass, 0 vulnerabilities

- [ ] **Step 3: Docker rebuild + browser E2E**

Run: `docker-compose build && docker-compose up -d`
Verify in browser: Settings → Account shows Job Preferences; save work modes + notice period + locations; reload Settings — values persist; draft an email to a contact — availability/work-mode fit appears in the body; compensation fields never appear.

- [ ] **Step 4: Commit**

`git add docs/recruiters.md CHANGELOG.md README.md && git commit -m "docs: candidate job profile — documentation, changelog, README"`

---

## Self-Review Checklist

- [ ] All 5 tasks map to the requested feature; nothing extra
- [ ] Compensation never enters the email prompt (verified in Task 4 code)
- [ ] All fields optional; empty profile is inert
- [ ] Signatures consistent across tasks (`CandidateProfile`, `getCandidateProfile`, `saveCandidateProfile`)
- [ ] Per-user isolation enforced in storage + routes
- [ ] No new dependencies
- [ ] No push instructions — commits stay local until the user asks
