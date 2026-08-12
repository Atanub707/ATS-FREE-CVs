# Recruiters Screen — Feature Reference

The Recruiters screen turns your job descriptions into an organized, actionable
outreach pipeline: contacts are extracted from every scraped job, deduplicated
by email/phone/LinkedIn, and tracked through cold email, follow-ups, and hiring
pipeline stages.

All routes below are session-scoped (per-account) — each user sees only their
own contacts. Storage is SQLite (`better-sqlite3`), schema managed in
`server/storage/fileStorage.ts` (new columns on `hr_contacts` plus the
`contact_emails` and `email_templates` tables).

---

## Data & organization

### Stats header

Pills above the toolbar summarize the whole contact list.

| Pill | Meaning |
|---|---|
| Total | every visible contact |
| With email | contacts that have an email address |
| With phone | contacts that have a phone number |
| Sent | contacts with at least one recorded email send (`last_email_sent` set) |
| Companies | distinct companies in the list |

- **Where:** `GET /api/contacts/stats` → `{ stats: { total, withEmail, withPhone, sent, companies } }` (server.ts:1157, `getContactStats` in server/storage/fileStorage.ts:1084); stat pills rendered in `src/components/RecruitersScreen.tsx` (loaded in `load()` alongside the list).
- **Tested:** `tests/recruiters/storage.test.ts` — "computes stats".

### Type filter chips

Chips **All / Recruiter / HR / Careers / Company** filter the list client-side;
each chip shows its per-type count. Contact `type` values: `recruit` | `hr` |
`careers` | `company` (labels via `TYPE_LABELS`).

- **Where:** `filterByType`, `typeCounts`, `TYPE_LABELS` in `src/lib/recruiters/filterUtils.ts`.
- **Tested:** `tests/recruiters/filterUtils.test.ts` — "filterByType" / "typeCounts".

### Sort

Dropdown sorts the current (filtered) list client-side. Keys:

| Key | Meaning |
|---|---|
| `last_seen` (default) | newest first |
| `name` | alphabetical by contact name |
| `company` | alphabetical by company |
| `job_count` | most jobs first |
| `last_email_sent` | recently emailed first (missing → last) |

- **Where:** `sortContacts(list, by)` in `src/lib/recruiters/filterUtils.ts` (pure, returns a new array).
- **Tested:** `tests/recruiters/filterUtils.test.ts` — "sortContacts".

### Pagination

The list renders **24 contacts at a time**; a **"Show N more"** button appends
the next page. All data still arrives in one `GET /api/contacts` call —
pagination is a rendering concern.

- **Where:** `RecruitersScreen.tsx` (visible-count state; toolbar button).

### Source-job link

Each card meta shows a **"Job"** link when the contact has a `sourceJobUrl` —
opens the job posting the contact was extracted from (new tab).

### CSV export

Downloads every contact as a BOM-prefixed CSV (`recruiters.csv`,
`Content-Disposition: attachment`). Columns: Email, Name, Company, Job Role,
Phone, WhatsApp, LinkedIn, Type, Context, Last Seen. Values are quoted/escaped
per RFC 4180; the BOM makes Excel render UTF-8 correctly.

- **Where:** `GET /api/contacts/export` (server.ts:1236) → raw CSV text.
- **Tested:** `tests/recruiters/storage.test.ts` — "exports CSV rows with display name" (row building lives in `listContactsCsv`, server/storage/fileStorage.ts:1098).

---

## Follow-up & pipeline

### Sticky notes

Each card has a sticky note: a persistent amber pill showing saved text, with
an add/edit popover. Empty notes clear the pill.

- **API:** `POST /api/contacts/:id/notes` body `{ note: string }` → `{ success }` (empty string clears). Data: `hr_contacts.notes`.
- **Where:** `addContactNote` (server/storage/fileStorage.ts:999); UI in `RecruitersScreen.tsx`.
- **Tested:** `tests/recruiters/storage.test.ts` — "adds a note".

### Follow-up reminders

Per-contact follow-up date with quick-set **+3d / +7d** buttons, an **overdue**
chip (past date, not yet followed up) and a **days-left** chip (future date).
**Mark done** flips `followedUp` (chip disappears), **Clear** removes the date.

- **API:**
  - `POST /api/contacts/:id/followup` body `{ date: string | null }` → `{ success }` — ISO date string, or `null` to clear.
  - `POST /api/contacts/:id/followedup` body `{ value: boolean }` → `{ success }`.
- **Where:** `setContactFollowUp` / `setContactFollowedUp` (server/storage/fileStorage.ts:1005/1011); date helpers `followupDue` / `daysLeft` in `src/lib/recruiters/followupUtils.ts`; UI in `RecruitersScreen.tsx`.
- **Tested:** `tests/recruiters/followupUtils.test.ts` ("due when past date and not followed up", "days left computes") and `tests/recruiters/storage.test.ts` ("sets follow-up and followed-up flags").

### Pipeline status

A select on each card sets the hiring stage. Valid values: `replied` |
`interview` | `offer` | `rejected` — **any other string is stored as `null`**
(clears the stage). The stored value round-trips as `pipelineStatus` on the
contact.

- **API:** `POST /api/contacts/:id/pipeline` body `{ status: string | null }` → `{ success }`.
- **Where:** `setContactPipeline` (server/storage/fileStorage.ts:1017, whitelist enforced server-side); UI select in `RecruitersScreen.tsx`.
- **Tested:** `tests/recruiters/storage.test.ts` — "validates pipeline status" (invalid values → null).

---

## Sending

### Email templates

Saved reusable subject/body pairs, shared across all contacts (per user).

- **API:**
  - `GET /api/emails/templates` → `{ templates: EmailTemplate[] }` — `{ id, name, subject, body, createdAt }`.
  - `POST /api/emails/templates` body `{ name, subject, body }` → `{ template }` (400 if any field is blank).
  - `DELETE /api/emails/templates/:id` → `{ success }`.
- **Where:** server.ts:1208–1234; `saveEmailTemplate` / `listEmailTemplates` / `deleteEmailTemplate` (server/storage/fileStorage.ts:1059–1082, table `email_templates`).
- **UI:** apply-select + "Save as template" + template chips in the compose modal (`RecruitersScreen.tsx`).
- **Tested:** `tests/recruiters/storage.test.ts` — "saves, lists and deletes templates".

### WhatsApp deep link

Contacts with a phone number flagged as WhatsApp show a **"Message"** button —
a `wa.me/<number>` deep link opened in a new tab.

- **Where:** `RecruitersScreen.tsx` (uses `contact.whatsapp` + `contact.phone`).

### Batch send

Checkbox batch mode over the visible list: select individual cards or
**Select all visible**, then **Send N** — the compose modal opens for the first
selected contact and a **n/N progress chip** advances as each email is sent
sequentially. Closing the modal **cancels the queue** (remaining sends are
aborted, no silent batch hijack).

- **Where:** `RecruitersScreen.tsx` (batch mode + queue state); sends go through the normal `POST /api/emails/send`.
- **Related:** bulk dismiss below.

### Email history

Every send is recorded automatically — **on success and on failure** — inside
the `POST /api/emails/send` handler. A per-card **Clock** button opens a history
modal listing past emails; sent/failed chips are clickable shortcuts to the
same modal.

- **API:** `GET /api/contacts/:id/emails` → `{ emails: ContactEmail[] }` — `{ id, recipient, subject, body, attachmentName, status: 'sent' | 'failed', sentAt }`, newest first.
- **Where:** `recordContactEmailDetail` (server/storage/fileStorage.ts:1038, table `contact_emails`), called from the send handler (server.ts:1397); route at server.ts:1200; modal in `RecruitersScreen.tsx`.
- **Tested:** `tests/recruiters/storage.test.ts` — "records and lists sent emails".

---

## Enrichment

### AI profile enrichment

**Enrich** button on each card: the LLM infers a missing real **name** and
**job title** from the LinkedIn URL, company, role/context, and source job
posting. Rules: names that look like companies/departments ("Talent
Acquisition") return `null`; emails/phones are never invented; and **scraped
data is never overwritten with null** — `undefined` is passed through
`updateContactIdentity` so only confident, non-empty values land in the DB.

- **API:** `POST /api/contacts/:id/enrich` → `{ success: true, contact }` (404 if the contact doesn't exist). Requires the LLM key.
- **Where:** server.ts:1346 (prompt at 1351); `updateContactIdentity(id, { name?, jobRole? })` (server/storage/fileStorage.ts:1025); button in `RecruitersScreen.tsx`.

### Email validity hint

**Verify** chip on each card checks format + domain MX records (no email is
ever sent).

- **API:** `POST /api/contacts/verify-email` body `{ email }` → `{ format: boolean, mx: boolean | null, detail: 'valid' | 'invalid-format' | 'no-mx' | 'unknown' }`. `unknown` when MX lookup errors; MX check is `node:dns` `resolveMx`.
- **Where:** server.ts:1375 (`isEmailFormatValid` from `src/lib/recruiters/emailUtils.ts`); chip in `RecruitersScreen.tsx`.
- **Tested:** `tests/recruiters/emailUtils.test.ts` — "isEmailFormatValid" (accepts normal addresses, rejects junk).

---

## Polish (bulk actions)

### Bulk dismiss

In batch mode, **Dismiss (N)** hides all selected contacts in one call
(equivalent to per-card hide; hidden contacts disappear from the list).

- **API:** `POST /api/contacts/bulk-hide` body `{ ids: string[] }` → `{ success, count }` (count = number actually hidden).
- **Where:** server.ts:1255 (`setContactHidden`, server/storage/fileStorage.ts:988); button in `RecruitersScreen.tsx`.
- **Related:** single-contact hide/unhide: `POST /api/contacts/:id/hide` / `POST /api/contacts/:id/unhide` → `{ success }`.

---

## API reference

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/contacts` | – | `{ contacts, companies }` (`?q=`, `?company=`) |
| GET | `/api/contacts/stats` | – | `{ stats: { total, withEmail, withPhone, sent, companies } }` |
| POST | `/api/contacts/:id/hide` | – | `{ success }` |
| POST | `/api/contacts/:id/unhide` | – | `{ success }` |
| POST | `/api/contacts/bulk-hide` | `{ ids: string[] }` | `{ success, count }` |
| POST | `/api/contacts/:id/notes` | `{ note: string }` | `{ success }` |
| POST | `/api/contacts/:id/followup` | `{ date: string \| null }` | `{ success }` |
| POST | `/api/contacts/:id/followedup` | `{ value: boolean }` | `{ success }` |
| POST | `/api/contacts/:id/pipeline` | `{ status: string \| null }` | `{ success }` (invalid status → stores null) |
| GET | `/api/contacts/:id/emails` | – | `{ emails: ContactEmail[] }` |
| GET | `/api/contacts/export` | – | BOM CSV, `Content-Disposition: attachment; filename="recruiters.csv"` |
| POST | `/api/contacts/:id/enrich` | – | `{ success, contact }` (LLM infers name/title) |
| POST | `/api/contacts/verify-email` | `{ email }` | `{ format, mx, detail }` |
| GET | `/api/emails/templates` | – | `{ templates: EmailTemplate[] }` |
| POST | `/api/emails/templates` | `{ name, subject, body }` | `{ template }` (400 if blank) |
| DELETE | `/api/emails/templates/:id` | – | `{ success }` |
| POST | `/api/emails/draft` | `{ contactId }` | `{ success, draft: { to, subject, body } }` |
| POST | `/api/emails/send` | `{ contactId, to, subject, body, attachMaster?, attachment? }` | `{ success }`; records history on success **and** failure |

---

## Test commands

```bash
# Recruiter unit tests (pure utils + storage layer)
npx vitest run tests/recruiters

# Full suite
npm test

# Type check + frontend build (release gates)
npx tsc --noEmit
npx vite build
```
