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

## Candidate job profile

Account-level job preferences, kept **off the CV**. The profile lives under
**Settings → Account → "Job Preferences"** and belongs to the signed-in user,
not to any document — every field is optional and an empty profile is inert.
It feeds the AI cold-email draft with availability and fit context that a CV
wouldn't carry.

### Fields

| Group | Fields |
|---|---|
| Work mode | `workModes` — remote / onsite / hybrid / flexible (multi-select) |
| Locations | `preferredLocations` — full country-state-city autocomplete (`searchLocations`) |
| Availability | `noticePeriod`, `availableFrom` (date) |
| Employment | `employmentTypes`, `yearsExperience`, `currentRole`, `currentCompany` |
| Compensation | `currentSalary`, `expectedSalaryMin`, `expectedSalaryMax`, `salaryCurrency` |
| Search intent | `jobSearchStatus`, `willingToRelocate` (`yes` / `no` / `certain-cities`), `willingToTravelPct` |
| Work eligibility | `workAuthorization`, `needsSponsorship` |
| Matching | `languages` (chip boxes), `preferredCompanySize` |
| Free text | `recruiterNote` |

### API

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/profile` | – | `{ profile: CandidateProfile }` — all-empty defaults when nothing saved; `401` when signed out |
| PUT | `/api/profile` | `{ profile: CandidateProfile }` | `{ success, profile }` — upsert keyed by `user_id`; `400` when `profile` missing/non-object; `401` when signed out |

- **Where:** routes in server.ts:531/541; `getCandidateProfile` (never throws,
  returns all-empty defaults) and `saveCandidateProfile` (upsert) in
  server/storage/fileStorage.ts:710/722, table `candidate_profile`
  (`user_id` PK, JSON `data` payload). UI: **Settings → Account → Job
  Preferences** card (class prefix `stp-*`).
- **Privacy:** compensation fields are stored for the AI matcher only — they
  are **never** included in the email prompt. The draft prompt's
  `Candidate job preferences` section (server.ts:1345, built by
  `buildProfileText` in server/emailProfile.ts, called at server.ts:1299)
  carries only: notice period, available-from, work-mode preference, preferred
  locations, employment-type preference, job search status, years of
  experience, and the recruiter note. Rules (server.ts:1352-1353) let the
  email weave in availability and work-mode fit — one short clause max, never
  invented; salary expectations are explicitly banned from the email body.
- **Tested:** `tests/recruiters/storage.test.ts` — "returns an empty default
  profile when none saved" / "saves and reloads a candidate profile" / "keeps
  profiles isolated per user"; `tests/recruiters/emailProfile.test.ts` —
  "builds the 8 preference lines from a filled profile" / "returns an empty
  string for an empty profile" / "never leaks compensation into the draft
  text".

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

A **pipeline quick-filter** in the toolbar filters the grid by hiring stage
(`replied` | `interview` | `offer` | `rejected`). Statuses are stored per
contact — **any other string is stored as `null`** (clears the stage). The
stored value round-trips as `pipelineStatus` on the contact. The per-card
status selector was removed from the UI (data is preserved and still
filterable).

- **API:** `POST /api/contacts/:id/pipeline` body `{ status: string | null }` → `{ success }`.
- **Where:** `setContactPipeline` (server/storage/fileStorage.ts:1017, whitelist enforced server-side); toolbar filter in `RecruitersScreen.tsx`.
- **Tested:** `tests/recruiters/storage.test.ts` — "validates pipeline status" (invalid values → null).

---

## Sending

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
| POST | `/api/contacts/verify-email` | `{ email }` | `{ format, mx, detail }` |
| GET | `/api/emails/templates` | – | `{ templates: EmailTemplate[] }` |
| POST | `/api/emails/templates` | `{ name, subject, body }` | `{ template }` (400 if blank) |
| DELETE | `/api/emails/templates/:id` | – | `{ success }` |
| POST | `/api/emails/draft` | `{ contactId }` | `{ success, draft: { to, subject, body } }` |
| POST | `/api/emails/send` | `{ contactId, to, subject, body, attachMaster?, attachment? }` | `{ success }`; records history on success **and** failure |
| GET | `/api/profile` | – | `{ profile: CandidateProfile }` (all-empty defaults; `401` signed out) |
| PUT | `/api/profile` | `{ profile: CandidateProfile }` | `{ success, profile }` (upsert; `400` bad body, `401` signed out) |

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

---

## AI Assistant (chat with MCP tools)

A chat panel (navbar → **AI Assistant**) where users talk to their own job database in
natural language — powered by the same BYOK LLM key.

**How it works:** the chat endpoint runs a real MCP server (in-process,
`@modelcontextprotocol/sdk` + `InMemoryTransport`) exposing tools the model can call:

| Tool | What it does |
|---|---|
| `search_jobs` | Filters the user's scraped jobs by role / location / source / work mode, capped at 25 |
| `get_job` | Full details of one job |
| `score_job` | Stored AI match score + matched/missing skills |
| `get_cv_summary` | CV summary + preferences (skills, years, locations, notice period) |
| `scrape_jobs` | Runs the app's real scrapers for a role and **stores new jobs** in the job list (dashboard) |
| `analyze_skill_gaps` | Aggregates the most common missing keywords across all scored jobs |
| `apply_gaps_to_cv` | Adds confirmed keywords to the Master CV (new "Market Skills" category) |
| `generate_cv` | Builds a working copy of the CV → PDF via the **existing 4 templates only** → returns a download token |

The model loops through tool calls (max 5 rounds) and ends with a short human reply plus a
structured job block. The server enriches the job cards from the real DB (title, company,
location, source, URL, score), so cards are always complete.

### Interview mode

Toggle **Interview** in the chat header → tell the assistant a target role → it runs a
7-question mock interview (one question at a time, informed by your CV) → each answer is
scored 0–10 with one-line feedback → final scorecard (per-question notes + overall + verdict).

- `POST /api/interview/start` `{ targetRole }` → `{ sessionId, question, questionIndex, total }`
- `POST /api/interview/answer` `{ sessionId, answer }` → `{ done: false, score, feedback, question, ... }` or `{ done: true, scorecard: { overall, verdict, perQuestion[] } }`
- **Where:** `server/interview.ts` (sessions + prompts), routes in `server.ts`, UI in `ChatPanel.tsx`.
- **Tested:** `tests/recruiters/interview.test.ts`.

### Voice I/O (turn-based conversation)

The assistant speaks and listens like a human — **tap Voice** in the chat header to start a
hands-free conversation:

1. **You speak** — live transcription shows your words as you say them (interim results); the orb pulses (listening).
2. **You pause** — it auto-sends after ~0.5s of silence. No buttons.
3. **It answers out loud, streaming** — the reply is spoken **sentence by sentence** as it plays (Voicebox TTS when running, browser speechSynthesis otherwise); the orb wobbles per sentence.
4. **You can interrupt** — speaking while it talks stops it instantly (barge-in) and it listens to you.
5. **It listens again** automatically after replying — a continuous back-and-forth loop. Works in Interview mode too (the interviewer speaks each question, you speak the answer).

**The rule:** if your message was **spoken** (Voice mode or the mic button), the assistant
**always answers in voice** — no toggle needed. The speaker button only controls spoken
replies for purely typed messages. Voicebox (local voice studio on
`127.0.0.1:17493`) upgrades TTS quality when installed; everything degrades gracefully.

- `GET /api/voice/health` → `{ available, profiles }` (probes Voicebox)
- `POST /api/voice/transcribe` (audio body) → `{ text }` (forwards to Voicebox `/transcribe`)
- `POST /api/voice/speak` `{ text }` → audio/mpeg (forwards to Voicebox `/speak`; client calls it per sentence)
- **Where:** `server/voice.ts`, routes in `server.ts`, voice engine + UI in `ChatPanel.tsx`, sentence chunking in `src/lib/speechChunk.ts`.
- **Tested:** `tests/recruiters/speechChunk.test.ts` (sentence splitting), `tests/recruiters/interview.test.ts`.

### The orb

The assistant is a living 3D CSS orb (radial-gradient sphere + glossy highlight). It
**floats** when idle, **pulses with a ring** while you're speaking/typing (listening), and
**wobbles** on an irregular rhythm while the assistant is replying or speaking aloud
(`prefers-reduced-motion` disables all animation).

**Apply All:** opens all returned job postings in new tabs. No auto-submit / browser
automation — per the user decision, applying stays manual.

- **API:** `POST /api/chat` body `{ messages: [{ role, content }] }` → `{ reply, jobs: [{ id, title, company, location, source, url, score, reason }] }` (401 signed out).
- **Where:** `server/mcp/registry.ts` (tools), `server/mcp/server.ts` (SDK pair), `server/llm/tools.ts` (`chatWithTools` — OpenAI-compatible / Gemini / Anthropic wrappers + capped loop), `src/components/ChatPanel.tsx` (UI).
- **Tested:** `tests/recruiters/mcp.test.ts` (registry), `tests/recruiters/llmTools.test.ts` (loop: executes tools, stops at maxRounds, surfaces tool errors), `tests/recruiters/chat.test.ts` (`parseJobsBlock` — valid/missing/malformed).
