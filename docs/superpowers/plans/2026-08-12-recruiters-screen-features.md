# Recruiters Screen Feature Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 17 features to the Recruiters screen in 5 phases (data & organization, follow-up & pipeline, smarter sending, enrichment, polish) with full test coverage and documentation.

**Architecture:** All features live in three layers, following existing patterns:
1. `server/storage/fileStorage.ts` — SQLite storage functions (new columns on `hr_contacts` + two new tables), testable via `runWithUser` + in-memory DB
2. `server.ts` — REST endpoints following the existing `/api/contacts` route style
3. `src/components/RecruitersScreen.tsx` — UI in the existing scoped `<style>` block pattern

**Tech Stack:** Existing stack (React 19, TS, Express, better-sqlite3) + NEW dev dependency: `vitest` (test runner). No other new runtime dependencies.

## Global Constraints

- Every task must pass: `npx tsc --noEmit`, `npx vitest run`, `npx vite build`
- No new runtime dependencies — vitest is devDependency-only
- Follow existing patterns: storage functions exported from `fileStorage.ts`, routes in `server.ts`, UI styles in the component's scoped `<style>` block
- Use the existing whitish multi-tint design tokens (`--color-brand`, `--color-cta`, etc.)
- TypeScript strict; `HrContact` row mapping in `fileStorage.ts` must be kept in sync
- Tests: vitest, unit tests for pure logic + storage functions (in-memory SQLite via `runWithUser`); API routes verified via curl/browser
- Commit after every task with the message convention: `feat(recruiters): <feature>`
- Never push — commits stay local until the user requests a push

---

### Task 0: Vitest test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/recruiters/filterUtils.test.ts` (first real test, written here as scaffolding)
- Create: `tests/recruiters/filterUtils.ts` (will be fully expanded in Task 3)
- Modify: `package.json` (devDependencies + `test` script)
- Modify: `.gitignore` (if needed)

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` script; vitest runnable; the `filterUtils.ts` module pattern for later tasks

- [ ] **Step 1: Install vitest**

Run: `npm i -D vitest@^3.2.4`
Expected: vitest added to package.json devDependencies

- [ ] **Step 2: Add test script to package.json**

```json
"scripts": {
  ...
  "test": "vitest run"
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write the scaffolding test**

Create `tests/recruiters/filterUtils.ts`:

```ts
export function matchesSearch(contact: { name?: string | null; recruiterName?: string | null; email?: string | null; phone?: string | null; company: string }, q: string): boolean {
  const ql = q.trim().toLowerCase();
  if (!ql) return true;
  return [
    contact.name || '',
    contact.recruiterName || '',
    contact.email || '',
    contact.phone || '',
    contact.company || '',
  ].some((v) => v.toLowerCase().includes(ql));
}
```

Create `tests/recruiters/filterUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchesSearch } from './filterUtils';

describe('matchesSearch', () => {
  const c = { name: 'Nicole', recruiterName: null, email: 'nicole@ioon.io', phone: null, company: 'IOON' };

  it('matches by name', () => expect(matchesSearch(c, 'nicole')).toBe(true));
  it('matches by email', () => expect(matchesSearch(c, 'ioon')).toBe(true));
  it('matches case-insensitively', () => expect(matchesSearch(c, 'NICOLE')).toBe(true));
  it('returns true for empty query', () => expect(matchesSearch(c, '')).toBe(true));
  it('rejects non-matches', () => expect(matchesSearch(c, 'zebra')).toBe(false));
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/
git commit -m "test: add vitest infra + recruiters filterUtils scaffold"
```

---

### Task 1: DB migrations + storage functions for all new features

**Files:**
- Modify: `server/storage/fileStorage.ts` (schema block + new exports)
- Test: `tests/recruiters/storage.test.ts`
- Create: `tests/recruiters/initDb.ts` (test helper)

**Interfaces:**
- Consumes: existing `runWithUser`, `getDb`, `authContext`
- Produces (used by later tasks — exact signatures):
  - `initDbWithPath(path: string): Database.Database` — test-only helper
  - `addContactNote(id: string, note: string): boolean`
  - `setContactFollowUp(id: string, date: string | null): boolean`
  - `setContactFollowedUp(id: string, value: boolean): boolean`
  - `setContactPipeline(id: string, status: string | null): boolean`
  - `listContactEmails(contactId: string): ContactEmail[]` where `ContactEmail = { id: string; recipient: string; subject: string; body: string; attachmentName: string | null; status: string; sentAt: string }`
  - `recordContactEmailDetail(contactId: string, detail: { recipient: string; subject: string; body: string; attachmentName?: string | null; status: 'sent' | 'failed' }): void`
  - `listEmailTemplates(): EmailTemplate[]` where `EmailTemplate = { id: string; name: string; subject: string; body: string; createdAt: string }`
  - `saveEmailTemplate(tpl: { name: string; subject: string; body: string }): EmailTemplate`
  - `deleteEmailTemplate(id: string): boolean`
  - `getContactStats(): { total: number; withEmail: number; withPhone: number; sent: number; companies: number }`
  - `listContactsCsv(): Array<{ email: string | null; name: string | null; company: string; jobRole: string; phone: string | null; whatsapp: boolean; recruiterUrl: string | null; typeLabel: string; context: string; lastSeen: string }>`

- [ ] **Step 1: Add `initDbWithPath` export (testability)**

Add above `getDb` in `fileStorage.ts`:

```ts
let dbPathOverride: string | null = null;

export function initDbWithPath(path: string): Database.Database {
  dbPathOverride = path;
  if (db) { try { db.close(); } catch { /* noop */ } db = null; }
  return getDb();
}

export function resetDbForTests(): void {
  dbPathOverride = null;
  if (db) { try { db.close(); } catch { /* noop */ } db = null; }
}
```

In `getDb()`, change `new Database(SQLITE_DB_PATH)` to `new Database(dbPathOverride || SQLITE_DB_PATH)`.

- [ ] **Step 2: Add migration functions and call them**

In the schema block, add after `ensureEmailColumns(db)` calls:

```ts
  ensureRecruitersFeatureColumns(db);
  ensureContactEmailsTable(db);
  ensureEmailTemplatesTable(db);
```

Add the functions near `ensureEmailColumns`:

```ts
function ensureRecruitersFeatureColumns(db: Database.Database): void {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(hr_contacts)`).all() as { name: string }[]).map((c) => c.name)
  );
  const adds: Array<[string, string]> = [
    ['notes', 'TEXT'],
    ['follow_up_at', 'TEXT'],
    ['followed_up', 'INTEGER DEFAULT 0'],
    ['pipeline_status', 'TEXT'],
  ];
  for (const [name, def] of adds) {
    if (!cols.has(name)) db.exec(`ALTER TABLE hr_contacts ADD COLUMN ${name} ${def}`);
  }
}

function ensureContactEmailsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_emails (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      attachment_name TEXT,
      status TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contact_emails_contact ON contact_emails(contact_id);
  `);
}

function ensureEmailTemplatesTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
```

- [ ] **Step 3: Extend `mapContactRow`**

Add fields to the `HrContact` mapping (returned by `mapContactRow`):

```ts
    notes: r.notes || '',
    followUpAt: r.follow_up_at || undefined,
    followedUp: !!r.followed_up,
    pipelineStatus: r.pipeline_status || undefined,
```

Update the `HrContact` interface in `server.ts` types accordingly (search for `interface HrContact` — add the 4 fields as optional).

- [ ] **Step 4: Write the storage functions**

Add near `setContactHidden`:

```ts
export function addContactNote(id: string, note: string): boolean {
  const userId = getCurrentUserId();
  if (!userId || !id) return false;
  return getDb().prepare('UPDATE hr_contacts SET notes = ? WHERE id = ? AND user_id = ?').run(note, id, userId).changes > 0;
}

export function setContactFollowUp(id: string, date: string | null): boolean {
  const userId = getCurrentUserId();
  if (!userId || !id) return false;
  return getDb().prepare('UPDATE hr_contacts SET follow_up_at = ? WHERE id = ? AND user_id = ?').run(date, id, userId).changes > 0;
}

export function setContactFollowedUp(id: string, value: boolean): boolean {
  const userId = getCurrentUserId();
  if (!userId || !id) return false;
  return getDb().prepare('UPDATE hr_contacts SET followed_up = ? WHERE id = ? AND user_id = ?').run(value ? 1 : 0, id, userId).changes > 0;
}

export function setContactPipeline(id: string, status: string | null): boolean {
  const userId = getCurrentUserId();
  if (!userId || !id) return false;
  const valid = ['replied', 'interview', 'offer', 'rejected'];
  const v = status && valid.includes(status) ? status : null;
  return getDb().prepare('UPDATE hr_contacts SET pipeline_status = ? WHERE id = ? AND user_id = ?').run(v, id, userId).changes > 0;
}

export function recordContactEmailDetail(contactId: string, detail: { recipient: string; subject: string; body: string; attachmentName?: string | null; status: 'sent' | 'failed' }): void {
  const userId = getCurrentUserId();
  if (!userId || !contactId) return;
  getDb().prepare(
    `INSERT INTO contact_emails (id, user_id, contact_id, recipient, subject, body, attachment_name, status, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, contactId, detail.recipient, detail.subject, detail.body, detail.attachmentName || null, detail.status, new Date().toISOString());
}

export function listContactEmails(contactId: string): ContactEmail[] {
  const userId = getCurrentUserId();
  if (!userId || !contactId) return [];
  const rows = getDb().prepare(
    'SELECT * FROM contact_emails WHERE user_id = ? AND contact_id = ? ORDER BY sent_at DESC'
  ).all(userId, contactId) as any[];
  return rows.map((r) => ({
    id: r.id, recipient: r.recipient, subject: r.subject, body: r.body,
    attachmentName: r.attachment_name || null, status: r.status, sentAt: r.sent_at,
  }));
}

export function listEmailTemplates(): EmailTemplate[] {
  const userId = getCurrentUserId();
  if (!userId) return [];
  const rows = getDb().prepare(
    'SELECT * FROM email_templates WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as any[];
  return rows.map((r) => ({ id: r.id, name: r.name, subject: r.subject, body: r.body, createdAt: r.created_at }));
}

export function saveEmailTemplate(tpl: { name: string; subject: string; body: string }): EmailTemplate {
  const userId = getCurrentUserId();
  const id = crypto.randomUUID();
  const t = { id, name: tpl.name.trim(), subject: tpl.subject.trim(), body: tpl.body.trim(), createdAt: new Date().toISOString() };
  getDb().prepare(
    'INSERT INTO email_templates (id, user_id, name, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, t.name, t.subject, t.body, t.createdAt);
  return t;
}

export function deleteEmailTemplate(id: string): boolean {
  const userId = getCurrentUserId();
  if (!userId || !id) return false;
  return getDb().prepare('DELETE FROM email_templates WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

export function getContactStats(): { total: number; withEmail: number; withPhone: number; sent: number; companies: number } {
  const userId = getCurrentUserId();
  if (!userId) return { total: 0, withEmail: 0, withPhone: 0, sent: 0, companies: 0 };
  const d = getDb();
  const one = (sql: string): number => (d.prepare(sql).get(userId) as { n: number }).n || 0;
  return {
    total: one('SELECT count(*) AS n FROM hr_contacts WHERE user_id = ? AND hidden = 0'),
    withEmail: one('SELECT count(*) AS n FROM hr_contacts WHERE user_id = ? AND hidden = 0 AND email IS NOT NULL AND email != ""'),
    withPhone: one('SELECT count(*) AS n FROM hr_contacts WHERE user_id = ? AND hidden = 0 AND phone IS NOT NULL AND phone != ""'),
    sent: one('SELECT count(*) AS n FROM hr_contacts WHERE user_id = ? AND hidden = 0 AND email_status = "sent"'),
    companies: one('SELECT count(DISTINCT company) AS n FROM hr_contacts WHERE user_id = ? AND hidden = 0 AND company != ""'),
  };
}

export function listContactsCsv(): Array<{ email: string | null; name: string | null; company: string; jobRole: string; phone: string | null; whatsapp: boolean; recruiterUrl: string | null; typeLabel: string; context: string; lastSeen: string }> {
  const userId = getCurrentUserId();
  if (!userId) return [];
  const rows = getDb().prepare(
    'SELECT * FROM hr_contacts WHERE user_id = ? AND hidden = 0 ORDER BY last_seen DESC'
  ).all(userId) as any[];
  return rows.map((r) => ({
    email: r.email || null, name: r.name || r.recruiter_name || null, company: r.company || '',
    jobRole: r.job_role || '', phone: r.phone || null, whatsapp: !!r.whatsapp,
    recruiterUrl: r.recruiter_url || null, typeLabel: r.type_label || '',
    context: r.context || '', lastSeen: r.last_seen || '',
  }));
}
```

Define the types near the top of `fileStorage.ts`:

```ts
export interface ContactEmail { id: string; recipient: string; subject: string; body: string; attachmentName: string | null; status: string; sentAt: string; }
export interface EmailTemplate { id: string; name: string; subject: string; body: string; createdAt: string; }
```

- [ ] **Step 5: Write storage tests**

Create `tests/recruiters/initDb.ts`:

```ts
import { initDbWithPath, resetDbForTests } from '../../server/storage/fileStorage';

export function setupTestDb(): void {
  initDbWithPath(':memory:');
}

export function teardownTestDb(): void {
  resetDbForTests();
}
```

Create `tests/recruiters/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser, addContactNote, setContactFollowUp, setContactFollowedUp, setContactPipeline, recordContactEmailDetail, listContactEmails, saveEmailTemplate, listEmailTemplates, deleteEmailTemplate, getContactStats, listContactsCsv, getDb } from '../../server/storage/fileStorage';

describe('recruiter storage', () => {
  beforeEach(() => { setupTestDb(); runWithUser('u1', () => {
    getDb().prepare('INSERT INTO hr_contacts (id, user_id, email, name, company, job_role, phone, type, type_label, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('c1', 'u1', 'a@x.com', 'Alice', 'ACME', 'Engineer', '+1 555', 'recruit', 'Recruiter', new Date().toISOString());
    getDb().prepare('INSERT INTO hr_contacts (id, user_id, email, name, company, job_role, phone, type, type_label, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('c2', 'u1', null, 'Bob', 'BETA', 'HR', null, 'hr', 'HR', new Date().toISOString());
  }); });
  afterEach(() => teardownTestDb());

  it('adds a note', () => {
    runWithUser('u1', () => {
      expect(addContactNote('c1', 'Likes Kubernetes')).toBe(true);
      expect(getDb().prepare('SELECT notes FROM hr_contacts WHERE id = ?').get('c1').notes).toBe('Likes Kubernetes');
    });
  });

  it('sets follow-up and followed-up flags', () => {
    runWithUser('u1', () => {
      expect(setContactFollowUp('c1', '2026-09-01T00:00:00.000Z')).toBe(true);
      expect(setContactFollowedUp('c1', true)).toBe(true);
      const row = getDb().prepare('SELECT follow_up_at, followed_up FROM hr_contacts WHERE id = ?').get('c1');
      expect(row.follow_up_at).toBe('2026-09-01T00:00:00.000Z');
      expect(row.followed_up).toBe(1);
    });
  });

  it('validates pipeline status', () => {
    runWithUser('u1', () => {
      expect(setContactPipeline('c1', 'interview')).toBe(true);
      expect(setContactPipeline('c1', 'bogus')).toBe(true); // stores null
      expect(getDb().prepare('SELECT pipeline_status FROM hr_contacts WHERE id = ?').get('c1').pipeline_status).toBeNull();
    });
  });

  it('records and lists sent emails', () => {
    runWithUser('u1', () => {
      recordContactEmailDetail('c1', { recipient: 'a@x.com', subject: 'Hi', body: 'Body', status: 'sent' });
      const list = listContactEmails('c1');
      expect(list).toHaveLength(1);
      expect(list[0].subject).toBe('Hi');
      expect(list[0].status).toBe('sent');
    });
  });

  it('saves, lists and deletes templates', () => {
    runWithUser('u1', () => {
      const t = saveEmailTemplate({ name: 'Intro', subject: 'Hello', body: 'World' });
      expect(listEmailTemplates()).toHaveLength(1);
      expect(deleteEmailTemplate(t.id)).toBe(true);
      expect(listEmailTemplates()).toHaveLength(0);
    });
  });

  it('computes stats', () => {
    runWithUser('u1', () => {
      const s = getContactStats();
      expect(s.total).toBe(2);
      expect(s.withEmail).toBe(1);
      expect(s.withPhone).toBe(1);
      expect(s.companies).toBe(2);
    });
  });

  it('exports CSV rows with display name', () => {
    runWithUser('u1', () => {
      const rows = listContactsCsv();
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Alice');
    });
  });
});
```

- [ ] **Step 6: Run tests — they must pass**

Run: `npm test`
Expected: storage suite passes. If `crypto.randomUUID` is unavailable, add `import { randomUUID } from 'crypto'` — the file already imports from 'crypto' (check top of file) — use `randomUUID()` where needed.

- [ ] **Step 7: Run type check + build**

Run: `npx tsc --noEmit && npx vite build`
Expected: both pass

- [ ] **Step 8: Commit**

```bash
git add server/storage/fileStorage.ts tests/
git commit -m "feat(recruiters): DB migrations + storage functions for notes, follow-ups, pipeline, email history, templates, stats, CSV"
```

---

### Task 2: API endpoints for new storage functions

**Files:**
- Modify: `server.ts` (add routes near the existing `/api/contacts` block, ~line 1107)

**Interfaces:**
- Consumes: all storage exports from Task 1
- Produces (exact endpoints, used by all UI tasks):
  - `GET /api/contacts/stats` → `{ stats: { total, withEmail, withPhone, sent, companies } }`
  - `POST /api/contacts/:id/notes` body `{ note }` → `{ success }`
  - `POST /api/contacts/:id/followup` body `{ date: string | null }` → `{ success }`
  - `POST /api/contacts/:id/followedup` body `{ value: boolean }` → `{ success }`
  - `POST /api/contacts/:id/pipeline` body `{ status: string | null }` → `{ success }`
  - `GET /api/contacts/:id/emails` → `{ emails: ContactEmail[] }`
  - `GET /api/emails/templates` → `{ templates: EmailTemplate[] }`
  - `POST /api/emails/templates` body `{ name, subject, body }` → `{ template }`
  - `DELETE /api/emails/templates/:id` → `{ success }`
  - `GET /api/contacts/export` → CSV text (Content-Type: text/csv, BOM prefix, `Content-Disposition: attachment; filename="recruiters.csv"`)
  - `POST /api/contacts/bulk-hide` body `{ ids: string[] }` → `{ success, count }`

- [ ] **Step 1: Add routes to server.ts**

Insert after the existing `app.post('/api/contacts/:id/unhide', ...)` block:

```ts
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
```

Update the `/api/emails/send` handler to also record history — in the success branch (near line 1278, where `recordContactEmail(contactId, 'sent', info.messageId)` is called), add:

```ts
      if (contactId) {
        recordContactEmail(contactId, 'sent', info.messageId);
        recordContactEmailDetail(contactId, {
          recipient: to, subject, body,
          attachmentName: attachMaster ? 'Master CV' : (attachment?.filename || null),
          status: 'sent',
        });
      }
```

And in the failure path of that handler, add `recordContactEmailDetail(contactId, { recipient: to, subject, body, status: 'failed' })` (guard `contactId` exists).

Check the imports at the top of `server.ts` — the `from './server/storage/fileStorage'` import must include the new functions.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: passes

- [ ] **Step 3: Verify with curl**

Run (app must be running — the Docker container serves the OLD code, so use the local build instead):
`npx vite build && npm start &` — or rely on the pre-existing dev container after rebuild (see Task 17 verification note). Minimal check:

```bash
node -e "const s=require('./dist/server.cjs')" 
```

If the server isn't trivially startable in this environment, verify via `npx tsc --noEmit` + the Task 1 storage tests only, and note manual API verification for the final build.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat(recruiters): API endpoints for stats, notes, follow-ups, pipeline, email history, templates, CSV export, bulk-hide"
```

---

### Task 3: Stats header + type filter + sort (features 1, 2, 3)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`
- Modify: `tests/recruiters/filterUtils.ts` + `tests/recruiters/filterUtils.test.ts`

**Interfaces:**
- Consumes: `GET /api/contacts/stats`, contact `type` field (`recruit | hr | careers | company` + `typeLabel`)
- Produces: UI state — `typeFilter: string` ('all' | type), `sortBy: 'last_seen' | 'name' | 'company' | 'job_count' | 'last_email_sent'`

- [ ] **Step 1: Write failing tests for pure filter/sort utils**

Extend `tests/recruiters/filterUtils.ts`:

```ts
export type ContactLite = {
  name?: string | null; company: string; type: string; lastSeen?: string;
  jobCount: number; lastEmailSent?: string;
};

export const TYPE_LABELS: Record<string, string> = { recruit: 'Recruiter', hr: 'HR', careers: 'Careers', company: 'Company' };

export function filterByType(c: ContactLite, t: string): boolean {
  return t === 'all' || c.type === t;
}

export function sortContacts<T extends ContactLite>(list: T[], by: string): T[] {
  const out = [...list];
  switch (by) {
    case 'name': return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'company': return out.sort((a, b) => a.company.localeCompare(b.company));
    case 'job_count': return out.sort((a, b) => b.jobCount - a.jobCount);
    case 'last_email_sent': return out.sort((a, b) => (b.lastEmailSent || '').localeCompare(a.lastEmailSent || ''));
    default: return out.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  }
}

export function typeCounts(list: ContactLite[]): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
}
```

Add tests in `filterUtils.test.ts`:

```ts
import { filterByType, sortContacts, typeCounts } from './filterUtils';

describe('filterByType', () => {
  const c = { type: 'recruit', company: 'X', jobCount: 1 };
  it('all passes everything', () => expect(filterByType(c, 'all')).toBe(true));
  it('matches type', () => expect(filterByType(c, 'recruit')).toBe(true));
  it('rejects other types', () => expect(filterByType(c, 'hr')).toBe(false));
});

describe('sortContacts', () => {
  const a = { name: 'Zoe', company: 'Alpha', type: 'recruit', jobCount: 1, lastSeen: '2026-08-01', lastEmailSent: undefined };
  const b = { name: 'Ann', company: 'Beta', type: 'recruit', jobCount: 5, lastSeen: '2026-08-03', lastEmailSent: '2026-08-02' };
  it('sorts by name', () => expect(sortContacts([a, b], 'name').map((x) => x.name)).toEqual(['Ann', 'Zoe']));
  it('sorts by job count desc', () => expect(sortContacts([a, b], 'job_count').map((x) => x.jobCount)).toEqual([5, 1]));
  it('sorts by last seen desc by default', () => expect(sortContacts([a, b], 'last_seen').map((x) => x.name)).toEqual(['Ann', 'Zoe']));
});

describe('typeCounts', () => {
  it('counts per type', () => {
    const list = [{ type: 'recruit', company: 'X', jobCount: 1 }, { type: 'recruit', company: 'Y', jobCount: 1 }, { type: 'hr', company: 'Z', jobCount: 1 }];
    expect(typeCounts(list)).toEqual({ recruit: 2, hr: 1 });
  });
});
```

- [ ] **Step 2: Run tests — verify new tests fail (no exports yet)**

Run: `npm test`
Expected: FAIL — `filterByType` not exported

- [ ] **Step 3: Implement the utils (fill in the file above) and re-run**

Run: `npm test`
Expected: all pass

- [ ] **Step 4: Add UI — stats header, type chips, sort dropdown**

In `RecruitersScreen.tsx`:
1. New state: `const [stats, setStats] = useState<{ total: number; withEmail: number; withPhone: number; sent: number; companies: number } | null>(null);`, `const [typeFilter, setTypeFilter] = useState('all');`, `const [sortBy, setSortBy] = useState('last_seen');`
2. In `load()`: also `fetch('/api/contacts/stats').then((r) => r.json()).then((d) => setStats(d.stats))`
3. Compute visible with filter/sort:

```ts
const typeCountsMap = typeCounts(visibleRaw as any);
const visibleRaw = contacts.filter(
  (c) =>
    (!company || c.company === company) &&
    (!ql || (c.name || '').toLowerCase().includes(ql) || (c.recruiterName || '').toLowerCase().includes(ql) || (c.email || '').toLowerCase().includes(ql) || (c.phone || '').includes(ql) || c.company.toLowerCase().includes(ql))
);
const visible = sortContacts(visibleRaw.filter((c) => filterByType(c as any, typeFilter)), sortBy);
```

(Keep the existing search predicate identical; add type filter + sort on top.)

4. Render the stats header row + toolbar additions (replace the existing `.rc-toolbar` block):

```tsx
{stats && (
  <div className="rc-stats">
    <span className="rc-stat"><b>{stats.total}</b> contacts</span>
    <span className="rc-stat"><b>{stats.withEmail}</b> with email</span>
    <span className="rc-stat"><b>{stats.withPhone}</b> with phone</span>
    <span className="rc-stat sent"><b>{stats.sent}</b> sent</span>
    <span className="rc-stat"><b>{stats.companies}</b> companies</span>
  </div>
)}
<div className="rc-types">
  {['all', 'recruit', 'hr', 'careers', 'company'].map((t) => (
    <button key={t} className={`rc-typechip ${typeFilter === t ? 'on' : ''}`} onClick={() => setTypeFilter(t)}>
      {t === 'all' ? 'All' : TYPE_LABELS[t]}
      <span className="rc-typecount">{t === 'all' ? contacts.length : typeCountsMap[t] || 0}</span>
    </button>
  ))}
</div>
<div className="rc-toolbar">
  ...existing search + company select...
  <select className="rc-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
    <option value="last_seen">Sort: newest</option>
    <option value="name">Sort: name</option>
    <option value="company">Sort: company</option>
    <option value="job_count">Sort: most jobs</option>
    <option value="last_email_sent">Sort: recently emailed</option>
  </select>
</div>
```

5. Import `filterByType, sortContacts, typeCounts, TYPE_LABELS` from `../tests/recruiters/filterUtils` — **do not import from tests/**. Instead, move the utils to `src/lib/recruiters/filterUtils.ts` and have `tests/recruiters/filterUtils.ts` re-export:

```ts
export * from '../../src/lib/recruiters/filterUtils';
```

Create `src/lib/recruiters/filterUtils.ts` with the same content as the test file above, and update `tests/recruiters/filterUtils.ts` to the one-line re-export. Update test imports accordingly (`from './filterUtils'` still works).

6. Add scoped CSS (in the `<style>` block):

```css
.rc-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.rc-stat { font-size: 11.5px; font-weight: 600; color: var(--muted); background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; }
.rc-stat b { color: var(--blue); }
.rc-stat.sent b { color: var(--green); }
.rc-types { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.rc-typechip { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 5px 11px; cursor: pointer; font-family: inherit; transition: all .15s ease; }
.rc-typechip:hover { border-color: var(--blue-border); color: var(--blue); }
.rc-typechip.on { background: var(--blue-soft); border-color: var(--blue-border); color: var(--blue); }
.rc-typecount { margin-left: 5px; opacity: .65; }
```

- [ ] **Step 5: Type check + tests + build**

Run: `npx tsc --noEmit && npm test && npx vite build`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/components/RecruitersScreen.tsx src/lib/recruiters/filterUtils.ts tests/recruiters/
git commit -m "feat(recruiters): stats header, type filter chips, sort dropdown"
```

---

### Task 4: Load-more pagination (feature 4)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `visible` array from Task 3
- Produces: state `pageSize` (24) and `shownCount`

- [ ] **Step 1: Add state + slice**

```ts
const [shownCount, setShownCount] = useState(24);
```

After computing `visible`:

```ts
const shown = visible.slice(0, shownCount);
const canLoadMore = shownCount < visible.length;
```

- [ ] **Step 2: Render `shown` instead of `visible` and add the button**

Replace `{visible.map((c, i) => {` with `{shown.map((c, i) => {` and add after the grid:

```tsx
{canLoadMore && (
  <div className="rc-morewrap">
    <button className="rc-more" onClick={() => setShownCount((s) => s + 24)}>
      Show {Math.min(24, visible.length - shownCount)} more ({visible.length - shownCount} left)
    </button>
  </div>
)}
```

Reset `shownCount` to 24 when `typeFilter`, `company`, or `q` changes:

```ts
useEffect(() => setShownCount(24), [typeFilter, company, q]);
```

- [ ] **Step 3: CSS**

```css
.rc-morewrap { text-align: center; padding: 18px 0 4px; }
.rc-more { padding: 9px 20px; border-radius: 10px; border: 1px solid var(--blue-border); background: var(--blue-soft); color: var(--blue); font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s ease; }
.rc-more:hover { filter: brightness(.97); }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vite build`
Expected: passes. Manual: open Recruiters with >24 contacts, click "Show more".

- [ ] **Step 5: Commit**

```bash
git add src/components/RecruitersScreen.tsx
git commit -m "feat(recruiters): load-more pagination"
```

---

### Task 5: Source job link on card (feature 5)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `sourceJobUrl` field on Contact (already present in the interface)
- Produces: a "View job" anchor in the card meta row

- [ ] **Step 1: Add link in the meta row**

In the `.rc-idmeta` block, after the role span, when `c.sourceJobUrl` exists:

```tsx
{c.sourceJobUrl && (
  <a className="rc-srcjob" href={c.sourceJobUrl} target="_blank" rel="noreferrer">
    <ExternalLink size={10} /> Job
  </a>
)}
```

- [ ] **Step 2: CSS**

```css
.rc-srcjob { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; color: var(--blue); text-decoration: none; padding: 2px 7px; border-radius: 6px; background: var(--blue-soft); border: 1px solid var(--blue-border); }
.rc-srcjob:hover { filter: brightness(.96); }
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): source job link on identity cards"`

---

### Task 6: CSV export button (feature 6)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `GET /api/contacts/export` (Task 2)
- Produces: download of `recruiters.csv`

- [ ] **Step 1: Add export handler + button**

```ts
const exportCsv = async () => {
  try {
    const res = await fetch('/api/contacts/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recruiters.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  } catch {
    showToast('Could not export');
  }
};
```

In the sticky action bar, before the "Copy all emails" button:

```tsx
<button className="rc-btn2" onClick={exportCsv} disabled={!contacts.length}>
  <FileText size={14} /> Export CSV
</button>
```

`FileText` is already imported.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): export contacts as CSV"`

---

### Task 7: Notes per contact (feature 7)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`
- Modify: `server/storage/fileStorage.ts` (`HrContact` map already extended in Task 1 — nothing new)

**Interfaces:**
- Consumes: `Contact.notes` (from Task 1 map), `POST /api/contacts/:id/notes`
- Produces: state `noteDrafts: Record<string, string>` and `editingNoteId: string | null`

- [ ] **Step 1: Add state + save handler**

```ts
const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

const saveNote = async (c: Contact) => {
  const note = (noteDrafts[c.id] ?? c.notes ?? '').trim();
  await fetch(`/api/contacts/${c.id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, notes: note } : x)));
  setEditingNoteId(null);
};
```

- [ ] **Step 2: Render in the card (after the context quote)**

```tsx
{editingNoteId === c.id ? (
  <div className="rc-note-edit">
    <textarea
      className="rc-note-ta"
      rows={2}
      placeholder="Add a note…"
      value={noteDrafts[c.id] ?? c.notes ?? ''}
      onChange={(e) => setNoteDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
    />
    <div className="rc-note-acts">
      <button className="rc-note-btn primary" onClick={() => saveNote(c)}>Save</button>
      <button className="rc-note-btn" onClick={() => setEditingNoteId(null)}>Cancel</button>
    </div>
  </div>
) : c.notes ? (
  <div className="rc-note">
    <span className="rc-note-txt">{c.notes}</span>
    <button className="rc-note-editbtn" onClick={() => setEditingNoteId(c.id)} title="Edit note"><PencilLine size={11} /></button>
  </div>
) : (
  <button className="rc-note-add" onClick={() => setEditingNoteId(c.id)}>+ Add note</button>
)}
```

Add `PencilLine` to the lucide imports in this file.

- [ ] **Step 3: CSS**

```css
.rc-note { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 6px 9px; }
.rc-note-txt { flex: 1; line-height: 1.45; }
.rc-note-editbtn { border: 0; background: none; color: var(--faint); cursor: pointer; padding: 2px; display: inline-flex; }
.rc-note-editbtn:hover { color: var(--amber); }
.rc-note-add { border: 1px dashed var(--border); background: none; color: var(--faint); font-size: 10.5px; font-weight: 700; padding: 5px 10px; border-radius: 7px; cursor: pointer; font-family: inherit; }
.rc-note-add:hover { color: var(--blue); border-color: var(--blue-border); }
.rc-note-edit { display: flex; flex-direction: column; gap: 6px; }
.rc-note-ta { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 7px 9px; font-size: 11.5px; font-family: inherit; color: var(--text); outline: none; resize: vertical; }
.rc-note-ta:focus { border-color: var(--blue); }
.rc-note-acts { display: flex; gap: 6px; }
.rc-note-btn { font-size: 10.5px; font-weight: 700; border: 1px solid var(--border); background: var(--card); color: var(--muted); border-radius: 7px; padding: 4px 10px; cursor: pointer; font-family: inherit; }
.rc-note-btn.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm test && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): sticky notes per contact"`

---

### Task 8: Follow-up reminders (feature 8)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`
- Test: `tests/recruiters/followupUtils.ts` + `.test.ts`

**Interfaces:**
- Consumes: `Contact.followUpAt?`, `Contact.followedUp` (Task 1), `POST /api/contacts/:id/followup`, `POST /api/contacts/:id/followedup`
- Produces: `followupDue(followUpAt?: string, followedUp?: boolean): boolean`, `followupDaysLeft(followUpAt?: string): number`

- [ ] **Step 1: Write failing tests**

Create `tests/recruiters/followupUtils.ts`:

```ts
export function followupDue(followUpAt?: string, followedUp?: boolean): boolean {
  if (!followUpAt || followedUp) return false;
  return new Date(followUpAt).getTime() <= Date.now();
}

export function followupDaysLeft(followUpAt?: string): number {
  if (!followUpAt) return 0;
  return Math.max(0, Math.ceil((new Date(followUpAt).getTime() - Date.now()) / 86400000));
}
```

Tests:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { followupDue, followupDaysLeft } from './followupUtils';

describe('followupUtils', () => {
  afterEach(() => vi.useRealTimers());
  it('due when past date and not followed up', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDue('2026-08-10T00:00:00Z', false)).toBe(true);
  });
  it('not due when followed up', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDue('2026-08-10T00:00:00Z', true)).toBe(false);
  });
  it('not due when future', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDue('2026-08-20T00:00:00Z', false)).toBe(false);
  });
  it('not due when no date', () => expect(followupDue(undefined, false)).toBe(false));
  it('days left computes', () => {
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'));
    expect(followupDaysLeft('2026-08-15T00:00:00Z')).toBe(3);
    expect(followupDaysLeft('2026-08-10T00:00:00Z')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify fail, then implement**

Run: `npm test` → FAIL. Then create the file above with the implementation; move to `src/lib/recruiters/followupUtils.ts` and re-export from tests (same pattern as Task 3). Re-run: PASS.

- [ ] **Step 3: UI — quick-set + mark done + overdue chip**

State + handlers:

```ts
const setFollowUp = async (c: Contact, days: number) => {
  const date = new Date(Date.now() + days * 86400000).toISOString();
  await fetch(`/api/contacts/${c.id}/followup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) });
  setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, followUpAt: date, followedUp: false } : x)));
  showToast(days === 0 ? 'Follow-up cleared' : `Follow-up in ${days} day${days === 1 ? '' : 's'}`);
};

const markFollowedUp = async (c: Contact) => {
  await fetch(`/api/contacts/${c.id}/followedup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: !c.followedUp }) });
  setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, followedUp: !x.followedUp } : x)));
};
```

Card rendering — add a row between the meta and the context quote:

```tsx
{(c.followUpAt || c.emailStatus === 'sent') && (
  <div className="rc-furow">
    {c.followUpAt && !c.followedUp && followupDue(c.followUpAt, false) && (
      <span className="rc-fuchip overdue"><AlertTriangle size={10} /> Follow up</span>
    )}
    {c.followUpAt && !c.followedUp && !followupDue(c.followUpAt, false) && (
      <span className="rc-fuchip"><Clock size={10} /> {followupDaysLeft(c.followUpAt)}d</span>
    )}
    {c.followedUp && <span className="rc-fuchip done"><CheckCircle2 size={10} /> Followed up</span>}
    <span className="rc-fu-spacer" />
    {c.followUpAt && !c.followedUp && (
      <button className="rc-fubtn" onClick={() => markFollowedUp(c)}>Mark done</button>
    )}
    <button className="rc-fubtn ghost" onClick={() => setFollowUp(c, 0)}>Clear</button>
  </div>
)}
<div className="rc-furow quick">
  <button className="rc-fubtn ghost" onClick={() => setFollowUp(c, 3)}>+3d</button>
  <button className="rc-fubtn ghost" onClick={() => setFollowUp(c, 7)}>+7d</button>
</div>
```

Add `Clock` to lucide imports. Import `followupDue, followupDaysLeft` from `../lib/recruiters/followupUtils`.

- [ ] **Step 4: CSS**

```css
.rc-furow { display: flex; align-items: center; gap: 6px; }
.rc-furow.quick { justify-content: flex-end; margin-top: -4px; }
.rc-fuchip { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
.rc-fuchip.overdue { background: var(--color-danger-soft); color: var(--color-danger); border: 1px solid #FECACA; }
.rc-fuchip { background: var(--amber-soft); color: var(--amber); border: 1px solid var(--amber-border); }
.rc-fuchip.done { background: var(--color-cta-soft); color: var(--green); border: 1px solid var(--color-cta-line); }
.rc-fu-spacer { flex: 1; }
.rc-fubtn { font-size: 10px; font-weight: 700; border: 1px solid var(--border); background: var(--card); color: var(--muted); border-radius: 6px; padding: 3px 8px; cursor: pointer; font-family: inherit; }
.rc-fubtn:hover { border-color: var(--blue-border); color: var(--blue); }
.rc-fubtn.ghost { border: 0; background: none; color: var(--faint); }
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm test && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx src/lib/recruiters/followupUtils.ts tests/recruiters/ && git commit -m "feat(recruiters): follow-up reminders with overdue chips"`

---

### Task 9: Pipeline status tracking (feature 9)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `Contact.pipelineStatus` (Task 1), `POST /api/contacts/:id/pipeline`
- Produces: `PIPELINE: Array<{ value: string | null; label: string }>` constant

- [ ] **Step 1: Add constant + handler**

```ts
const PIPELINE: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'No status' },
  { value: 'replied', label: 'Replied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
];

const setPipeline = async (c: Contact, status: string | null) => {
  await fetch(`/api/contacts/${c.id}/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, pipelineStatus: status || undefined } : x)));
};
```

- [ ] **Step 2: Render a status select on the card (in the actions row, before the copy button)**

```tsx
<select className={`rc-pipe rc-pipe-${c.pipelineStatus || 'none'}`} value={c.pipelineStatus || ''} onChange={(e) => setPipeline(c, e.target.value || null)}>
  {PIPELINE.map((p) => (
    <option key={p.value || 'none'} value={p.value || ''}>{p.label}</option>
  ))}
</select>
```

- [ ] **Step 3: CSS**

```css
.rc-pipe { font-size: 10.5px; font-weight: 700; border: 1px solid var(--border); border-radius: 7px; padding: 4px 6px; background: var(--card); color: var(--muted); font-family: inherit; cursor: pointer; outline: none; }
.rc-pipe-replied { color: #0A66C2; border-color: #B9D0EF; background: #F0F6FD; }
.rc-pipe-interview { color: var(--green); border-color: var(--color-cta-line); background: var(--color-cta-soft); }
.rc-pipe-offer { color: var(--amber); border-color: var(--amber-border); background: var(--amber-soft); }
.rc-pipe-rejected { color: var(--color-danger); border-color: #FECACA; background: var(--color-danger-soft); }
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): pipeline status tracking"`

---

### Task 10: Email history + sent-content view (features 10 & 16)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `GET /api/contacts/:id/emails` (Task 2), `ContactEmail` shape
- Produces: state `emailHistory: Record<string, ContactEmail[]>`, `historyFor: Contact | null`

- [ ] **Step 1: Add state + loader**

```ts
const [emailHistory, setEmailHistory] = useState<Record<string, ContactEmail[]>>({});
const [historyFor, setHistoryFor] = useState<Contact | null>(null);
```

Define the type locally: `interface SentEmail { id: string; recipient: string; subject: string; body: string; attachmentName: string | null; status: string; sentAt: string; }`

```ts
const openHistory = async (c: Contact) => {
  setHistoryFor(c);
  if (!emailHistory[c.id]) {
    try {
      const res = await fetch(`/api/contacts/${c.id}/emails`);
      const d = await res.json();
      setEmailHistory((h) => ({ ...h, [c.id]: d.emails || [] }));
    } catch { /* ignore */ }
  }
};
```

- [ ] **Step 2: History popover + "View" affordance**

Make the sent/failed chips clickable and add a "History" ghost button:

```tsx
{c.emailStatus === 'sent' && c.lastEmailSent && (
  <button className="rc-emailchip sent clickable" onClick={() => openHistory(c)}>
    <CheckCircle2 size={11} /> Sent {new Date(c.lastEmailSent).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
  </button>
)}
{c.emailStatus === 'failed' && (
  <button className="rc-emailchip failed clickable" onClick={() => openHistory(c)}>
    <AlertTriangle size={11} /> Failed — resend
  </button>
)}
{c.emailStatus !== 'failed' && (emailHistory[c.id]?.length || 0) === 0 && c.emailStatus === 'sent' && null}
```

Simpler and always available — in the actions row add:

```tsx
<button className="rc-ghost" title="Email history" onClick={() => openHistory(c)}>
  <Clock size={14} />
</button>
```

(Clock already imported from Task 8.)

History modal (reuse the compose modal backdrop pattern):

```tsx
{historyFor && (
  <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setHistoryFor(null)}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900">Email history — {historyFor.name || historyFor.email}</h3>
        <button onClick={() => setHistoryFor(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {(emailHistory[historyFor.id] || []).length === 0 ? (
          <p className="text-[12px] text-slate-500">No emails sent to this contact yet.</p>
        ) : (
          (emailHistory[historyFor.id] || []).map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                <span className={`px-2 py-0.5 rounded-full ${e.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{e.status}</span>
                <span className="truncate">{new Date(e.sentAt).toLocaleString()}</span>
              </div>
              <p className="text-[12.5px] font-bold text-slate-800 mt-1.5">{e.subject}</p>
              <p className="text-[11.5px] text-slate-500 whitespace-pre-wrap leading-relaxed mt-1 line-clamp-4">{e.body}</p>
              {e.attachmentName && <p className="text-[10.5px] text-blue-600 mt-1">📎 {e.attachmentName}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: CSS for clickable chips**

```css
.rc-emailchip.clickable { cursor: pointer; }
.rc-emailchip.clickable:hover { filter: brightness(.97); }
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): email history with sent-content viewer"`

---

### Task 11: Email templates (feature 11)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/emails/templates` (Task 2), `EmailTemplate` shape
- Produces: state `templates: EmailTemplate[]`, `templateName: string`, `saveTemplateOpen: boolean`

- [ ] **Step 1: State + load + helpers**

```ts
interface EmailTemplate { id: string; name: string; subject: string; body: string; createdAt: string; }
const [templates, setTemplates] = useState<EmailTemplate[]>([]);
const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
const [templateName, setTemplateName] = useState('');

const loadTemplates = async () => {
  try {
    const res = await fetch('/api/emails/templates');
    const d = await res.json();
    setTemplates(d.templates || []);
  } catch { /* ignore */ }
};

useEffect(() => { if (composeContact) loadTemplates(); }, [composeContact]);

const applyTemplate = (t: EmailTemplate) => {
  setComposeSubject(t.subject);
  setComposeBody(t.body);
  setComposeMsg(null);
};

const saveTemplate = async () => {
  if (!templateName.trim() || !composeSubject.trim() || !composeBody.trim()) return;
  const res = await fetch('/api/emails/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: templateName, subject: composeSubject, body: composeBody }),
  });
  if (res.ok) { setTemplateName(''); setSaveTemplateOpen(false); loadTemplates(); showToast('Template saved'); }
};

const deleteTemplate = async (id: string) => {
  await fetch(`/api/emails/templates/${id}`, { method: 'DELETE' });
  setTemplates((t) => t.filter((x) => x.id !== id));
  showToast('Template deleted');
};
```

- [ ] **Step 2: Compose-modal UI (insert below the Subject field)**

```tsx
<div className="flex items-center gap-2">
  <label className="block text-[11px] font-semibold text-slate-500">Template</label>
  <select
    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-400"
    value=""
    onChange={(e) => {
      const t = templates.find((x) => x.id === e.target.value);
      if (t) applyTemplate(t);
      e.target.value = '';
    }}
  >
    <option value="" disabled>Apply a saved template…</option>
    {templates.map((t) => (
      <option key={t.id} value={t.id}>{t.name}</option>
    ))}
  </select>
  <button
    type="button"
    onClick={() => setSaveTemplateOpen((v) => !v)}
    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:border-blue-300 cursor-pointer"
  >
    Save as template
  </button>
</div>
{saveTemplateOpen && (
  <div className="flex items-center gap-2">
    <input
      type="text"
      placeholder="Template name (e.g. Intro — DevOps)"
      value={templateName}
      onChange={(e) => setTemplateName(e.target.value)}
      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-800 outline-none focus:border-blue-400"
    />
    <button onClick={saveTemplate} disabled={!templateName.trim()}
      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-slate-900 disabled:opacity-40 cursor-pointer">
      Save
    </button>
  </div>
)}
{templates.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {templates.map((t) => (
      <span key={t.id} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
        {t.name}
        <button onClick={() => deleteTemplate(t.id)} className="text-slate-400 hover:text-red-600 cursor-pointer" title="Delete template">×</button>
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): saved email templates"`

---

### Task 12: WhatsApp deep link (feature 12)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `c.whatsapp` + `c.phone` on the contact

- [ ] **Step 1: Add helper + button**

```ts
const waLink = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '').replace(/^0+/, '');
  return `https://wa.me/${digits}`;
};
```

In the Phone row, when `c.whatsapp && c.phone`, after the WhatsApp badge:

```tsx
{c.whatsapp && c.phone && (
  <a className="rc-walink" href={waLink(c.phone)} target="_blank" rel="noreferrer" title="Chat on WhatsApp">
    Message
  </a>
)}
```

- [ ] **Step 2: CSS**

```css
.rc-walink { font-size: 9.5px; font-weight: 700; color: #15803D; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 20px; padding: 1px 7px; text-decoration: none; }
.rc-walink:hover { filter: brightness(.95); }
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): WhatsApp deep link on WhatsApp contacts"`

---

### Task 13: Batch send (feature 13)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: existing compose + `sendEmail` logic
- Produces: state `batchQueue: Contact[]`, `batchIndex: number`

- [ ] **Step 1: Selection mode + batch state**

```ts
const [batchMode, setBatchMode] = useState(false);
const [selected, setSelected] = useState<Set<string>>(new Set());
const [batchQueue, setBatchQueue] = useState<Contact[]>([]);
const [batchIndex, setBatchIndex] = useState(0);
```

Toggle/select handlers:

```ts
const toggleBatchMode = () => { setBatchMode((v) => !v); setSelected(new Set()); };
const toggleSelect = (id: string) => {
  setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
};
const selectAllVisible = () => setSelected(new Set(visible.map((c) => c.id)));
const startBatch = () => {
  const q = contacts.filter((c) => selected.has(c.id) && c.email);
  if (!q.length) return;
  setBatchQueue(q);
  setBatchIndex(0);
  setComposeContact(q[0]);
  setComposeTo(q[0].email || '');
  setComposeSubject(''); setComposeBody('');
  setComposeMsg(null); setAttachMode('none'); setAttachFile(null);
};
```

Advance after a successful send — replace the `setTimeout(() => setComposeContact(null), 1200)` in `sendEmail` with:

```ts
      if (batchQueue.length) {
        const next = batchIndex + 1;
        if (next < batchQueue.length) {
          setTimeout(() => {
            setBatchIndex(next);
            const c = batchQueue[next];
            setComposeContact(c);
            setComposeTo(c.email || '');
            setComposeSubject(''); setComposeBody('');
            setComposeMsg({ ok: true, text: `Sent ✓ — ${next + 1}/${batchQueue.length}` });
          }, 900);
          return;
        }
        setBatchQueue([]);
        setBatchMode(false);
        setSelected(new Set());
        setComposeContact(null);
        showToast(`Batch complete — ${batchQueue.length} sent`);
        return;
      }
      setTimeout(() => setComposeContact(null), 1200);
```

Make the compose modal header show batch progress:

```tsx
{batchQueue.length > 0 && (
  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
    {batchIndex + 1} / {batchQueue.length}
  </span>
)}
```

- [ ] **Step 2: Toolbar buttons (next to Copy all emails)**

```tsx
<button className={`rc-btn2 ${batchMode ? 'active' : ''}`} onClick={toggleBatchMode}>
  <CheckSquare size={14} /> {batchMode ? 'Done selecting' : 'Batch'}
</button>
{batchMode && (
  <button className="rc-btn2" onClick={selectAllVisible}>
    <CheckSquare size={14} /> Select all ({visible.length})
  </button>
)}
{batchMode && (
  <button className="rc-btn2 primary" onClick={startBatch} disabled={!contacts.some((c) => selected.has(c.id) && c.email)}>
    <Send size={14} /> Send {selected.size}
  </button>
)}
```

Add `CheckSquare` to lucide imports.

- [ ] **Step 3: Card checkbox when in batch mode**

At the top of the card (inside `.rc-idcard`, before `.rc-namerow`):

```tsx
{batchMode && (
  <label className="rc-batchcheck" onClick={(e) => e.stopPropagation()}>
    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
    <span>Select</span>
  </label>
)}
```

- [ ] **Step 4: CSS**

```css
.rc-btn2.active { background: var(--blue-soft); border-color: var(--blue-border); color: var(--blue); }
.rc-batchcheck { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; color: var(--faint); cursor: pointer; }
.rc-batchcheck input { accent-color: var(--blue); cursor: pointer; }
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): batch cold-email send queue"`

---

### Task 14: AI profile enrichment (feature 14)

**Files:**
- Modify: `server.ts` (new endpoint, follows the `/api/emails/draft` pattern)
- Modify: `src/components/RecruitersScreen.tsx`
- Modify: `server/storage/fileStorage.ts` (export `updateContactIdentity`)

**Interfaces:**
- Consumes: `ask()` from `server/llm/llmAdapter.ts`, `getContactById`, `getJobById`
- Produces: `POST /api/contacts/:id/enrich` → `{ success, contact }`; storage `updateContactIdentity(id, { name?, recruiterName?, jobRole? }): boolean`

- [ ] **Step 1: Storage — add `updateContactIdentity`**

In `fileStorage.ts`:

```ts
export function updateContactIdentity(id: string, patch: { name?: string | null; recruiterName?: string | null; jobRole?: string | null }): boolean {
  const userId = getCurrentUserId();
  if (!userId || !id) return false;
  const cols: string[] = [];
  const params: any[] = [];
  if (patch.name !== undefined) { cols.push('name = ?'); params.push(patch.name); }
  if (patch.recruiterName !== undefined) { cols.push('recruiter_name = ?'); params.push(patch.recruiterName); }
  if (patch.jobRole !== undefined) { cols.push('job_role = ?'); params.push(patch.jobRole); }
  if (!cols.length) return false;
  params.push(id, userId);
  return getDb().prepare(`UPDATE hr_contacts SET ${cols.join(', ')} WHERE id = ? AND user_id = ?`).run(...params).changes > 0;
}
```

- [ ] **Step 2: Server endpoint (after `/api/emails/draft`)**

```ts
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
```

Import `ask` and `updateContactIdentity` in `server.ts`.

- [ ] **Step 3: UI — Enrich button + handler**

```ts
const enrichContact = async (c: Contact) => {
  setBusyId(c.id);
  try {
    const res = await fetch(`/api/contacts/${c.id}/enrich`, { method: 'POST' });
    const d = await res.json();
    if (!res.ok) { showToast(d.error || 'Enrichment failed'); return; }
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...d.contact } : x)));
    showToast('Profile enriched');
  } catch {
    showToast('Enrichment failed');
  } finally {
    setBusyId(null);
  }
};
```

Add `const [busyId, setBusyId] = useState<string | null>(null);`

In the actions row (before Copy):

```tsx
<button className="rc-btn" title="AI-enrich missing details from LinkedIn + job context"
  onClick={() => enrichContact(c)} disabled={busyId === c.id}>
  {busyId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Enrich
</button>
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add server.ts server/storage/fileStorage.ts src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): AI profile enrichment from LinkedIn + job context"`

---

### Task 15: Email validity hint (feature 15)

**Files:**
- Modify: `server.ts` (new endpoint using `node:dns`)
- Modify: `src/components/RecruitersScreen.tsx`
- Test: `tests/recruiters/emailUtils.ts` + `.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `isEmailFormatValid(email: string): boolean` (pure, tested); `POST /api/contacts/verify-email` body `{ email }` → `{ format: boolean, mx: boolean | null, detail: 'valid' | 'invalid-format' | 'no-mx' | 'unknown' }`

- [ ] **Step 1: Write failing test**

`tests/recruiters/emailUtils.ts`:

```ts
export function isEmailFormatValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
```

Tests:

```ts
import { describe, it, expect } from 'vitest';
import { isEmailFormatValid } from './emailUtils';

describe('isEmailFormatValid', () => {
  it('accepts normal addresses', () => {
    expect(isEmailFormatValid('nicole@ioon.io')).toBe(true);
    expect(isEmailFormatValid('a.b+c@example.co.uk')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isEmailFormatValid('not-an-email')).toBe(false);
    expect(isEmailFormatValid('a@b')).toBe(false);
    expect(isEmailFormatValid('@x.com')).toBe(false);
    expect(isEmailFormatValid('a@.com')).toBe(false);
  });
});
```

Move implementation to `src/lib/recruiters/emailUtils.ts`, re-export from tests (Task 3 pattern). Run `npm test` — verify fail then pass.

- [ ] **Step 2: Server endpoint (uses `node:dns` promises)**

```ts
import { promises as dns } from 'node:dns';

  app.post('/api/contacts/verify-email', async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const valid = isEmailFormatValid(email);
      let mx: boolean | null = null;
      if (valid) {
        try {
          const records = await dns.resolveMx(email.split('@')[1]);
          mx = records.length > 0;
        } catch {
          mx = false;
        }
      }
      res.json({ format: valid, mx, detail: !valid ? 'invalid-format' : mx === null ? 'unknown' : mx ? 'valid' : 'no-mx' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
```

Import `isEmailFormatValid` from the shared lib in `server.ts` (it's plain TS — import from `./src/lib/recruiters/emailUtils.js` style consistent with how `llmPresets.js` is imported via `.js` suffix — check existing imports for the convention).

- [ ] **Step 3: UI — verify chip on demand**

```ts
const [verifyMap, setVerifyMap] = useState<Record<string, string>>({});
const verifyEmail = async (c: Contact) => {
  if (!c.email) return;
  try {
    const res = await fetch('/api/contacts/verify-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: c.email }),
    });
    const d = await res.json();
    setVerifyMap((m) => ({ ...m, [c.id]: d.detail }));
  } catch { setVerifyMap((m) => ({ ...m, [c.id]: 'unknown' })); }
};
```

In the Email row, after the copy button:

```tsx
<button className="rc-verify" title="Check email validity (format + domain MX)" onClick={() => verifyEmail(c)}>
  <BadgeCheck size={11} />
</button>
{verifyMap[c.id] && (
  <span className={`rc-verifystate ${verifyMap[c.id] === 'valid' ? 'ok' : verifyMap[c.id] === 'invalid-format' ? 'bad' : 'warn'}`}>
    {verifyMap[c.id] === 'valid' ? 'Valid' : verifyMap[c.id] === 'invalid-format' ? 'Invalid' : verifyMap[c.id] === 'no-mx' ? 'No MX' : 'Unknown'}
  </span>
)}
```

Add `BadgeCheck` to lucide imports.

- [ ] **Step 4: CSS**

```css
.rc-verify { border: 0; background: none; color: var(--faint); cursor: pointer; padding: 2px; display: inline-flex; }
.rc-verify:hover { color: var(--green); }
.rc-verifystate { font-size: 9px; font-weight: 700; border-radius: 20px; padding: 1px 6px; }
.rc-verifystate.ok { color: #15803D; background: #F0FDF4; border: 1px solid #BBF7D0; }
.rc-verifystate.bad { color: var(--color-danger); background: var(--color-danger-soft); border: 1px solid #FECACA; }
.rc-verifystate.warn { color: var(--amber); background: var(--amber-soft); border: 1px solid var(--amber-border); }
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm test && npx vite build`
Commit: `git add server.ts src/lib/recruiters/emailUtils.ts src/components/RecruitersScreen.tsx tests/recruiters/ && git commit -m "feat(recruiters): email validity hint (format + MX check)"`

---

### Task 16: Bulk select + bulk dismiss (feature 17)

**Files:**
- Modify: `src/components/RecruitersScreen.tsx`

**Interfaces:**
- Consumes: `POST /api/contacts/bulk-hide` (Task 2), `batchMode`/`selected` state (Task 13)

- [ ] **Step 1: Bulk dismiss handler + button**

```ts
const bulkDismiss = async () => {
  const ids = [...selected];
  if (!ids.length) return;
  const res = await fetch('/api/contacts/bulk-hide', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  });
  const d = await res.json();
  if (d.success) {
    setContacts((prev) => prev.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    showToast(`${d.count} contact${d.count === 1 ? '' : 's'} dismissed`);
  } else {
    showToast('Could not dismiss');
  }
};
```

In the action bar (batch mode only):

```tsx
{batchMode && (
  <button className="rc-btn2 danger" onClick={bulkDismiss} disabled={!selected.size}>
    <Trash2 size={14} /> Dismiss ({selected.size})
  </button>
)}
```

- [ ] **Step 2: CSS**

```css
.rc-btn2.danger { border-color: #FECACA; color: var(--color-danger); background: var(--color-danger-soft); }
.rc-btn2.danger:hover { filter: brightness(.97); }
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx vite build`
Commit: `git add src/components/RecruitersScreen.tsx && git commit -m "feat(recruiters): bulk select, bulk dismiss"`

---

### Task 17: Docs, final verification, release notes

**Files:**
- Modify: `docs/recruiters.md` (create — feature documentation)
- Modify: `CHANGELOG.md` (add entry under an Unreleased heading)
- Modify: `README.md` (update the Recruiters feature row + How-to step 6 with the new capabilities)

**Interfaces:**
- Consumes: everything above

- [ ] **Step 1: Write `docs/recruiters.md`**

Document every feature: what it does, where it lives (file/endpoint), the API contract (method, path, body, response), and how it was tested. Sections: Overview, Data & organization (stats/type filter/sort/pagination/source-job link/CSV), Follow-up & pipeline (notes, follow-up reminders, pipeline status), Sending (templates, WhatsApp link, batch send, email history), Enrichment (AI enrich, email validity), Polish (bulk actions), API reference table, Test commands.

- [ ] **Step 2: Update CHANGELOG.md**

Add at the top (after `# Changelog`):

```markdown
## Unreleased

### 👥 Recruiters screen expansion
- Stats header (total / with email / with phone / sent / companies), type filter chips (Recruiter · HR · Careers · Company), sort (newest / name / company / most jobs / recently emailed), load-more pagination.
- Sticky notes per contact; follow-up reminders (+3d / +7d, overdue chips, "Mark done"); pipeline status (Replied · Interview · Offer · Rejected).
- Email history per contact (sent/failed logs with subject, body, attachment, timestamp); saved email templates; WhatsApp deep links; batch cold-email queue (select → send sequentially) with bulk dismiss.
- AI profile enrichment (LLM fills missing name/title from LinkedIn + job context); email validity hint (format + domain MX check); source-job link on identity cards; CSV export of all contacts.
```

- [ ] **Step 3: Update README.md**

In the Features table, update the Recruiters row to: `**Recruiters & Cold Email** | Recruiter contacts extracted from job descriptions, AI-drafted emails sent via your own SMTP, follow-up reminders, pipeline tracking (replied/interview/offer), email history, templates, batch send, AI enrichment, WhatsApp links, and CSV export — with sent/failed status on every card |`

In "How to Use → Step 6", add the follow-up/pipeline/history sentences.

- [ ] **Step 4: Full gate**

Run: `npx tsc --noEmit && npm test && npm audit --audit-level=high && npx vite build`
Expected: all pass, 0 vulnerabilities

- [ ] **Step 5: Rebuild the Docker container and verify end-to-end in the browser**

Run: `docker-compose build && docker-compose up -d`
Then in the browser at http://localhost:3000 (Recruiters screen): verify stats header, type chips, sort, notes add/save, follow-up +3d, pipeline select, history modal (after a test send), templates save/apply, batch select + send queue, enrich button, verify chip, CSV download, bulk dismiss.

- [ ] **Step 6: Commit**

```bash
git add docs/recruiters.md CHANGELOG.md README.md
git commit -m "docs: recruiters screen feature documentation, changelog, README update"
```

---

## Self-Review Checklist

- [ ] Every one of the 17 requested features maps to exactly one task (features 10 & 16 share Task 10 — email history storage + viewer — noted and intentional)
- [ ] No placeholders — all code blocks complete
- [ ] Type consistency: `ContactEmail`, `EmailTemplate`, `updateContactIdentity`, `getContactStats` signatures used identically in tasks 1-17
- [ ] Test commands and expected outputs written for every TDD step
- [ ] No new runtime deps; only devDep: vitest
- [ ] Push policy respected — no push instructions anywhere in the plan
