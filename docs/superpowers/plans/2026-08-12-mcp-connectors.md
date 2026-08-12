# Email Connectors — Cold-Email Pipeline (Revised Plan)

**Date:** 2026-08-12 · **Status:** Draft plan (no code yet)

**Revision note (user decision):** applying-automation is **out of scope** — no auto-apply, no browser-automation appliers. The **MCP layer is deferred**: honest review concluded that for button-click email sending, a direct email integration is simpler and more reliable than an MCP server layer (MCP only pays off for AI-agent-driven actions or third-party extensibility — speculative today). The plan below is the pragmatic email ladder.

**Goal:** users can send cold emails to the recruiters Tailor CV already extracts, from their own mailbox, with the AI-drafted content the app already generates.

---

## 1. The email ladder (3 levels)

| Level | What it is | Effort | When to build |
|---|---|---|---|
| **L1 — mailto:** | Recruiter card opens the user's own mail app with a pre-filled draft (subject + LLM-drafted body). No backend, no auth, no stored credentials. Sent-status cannot be tracked (it leaves the app) | ~1 hour | **Now — recommended starting point** |
| **L2 — SMTP** | App sends via the user's own SMTP (Gmail app-password, Outlook, any provider) using nodemailer. Real in-app sending + sent-status stored on the recruiter card | ~half a day | When the user actually emails recruiters regularly |
| **L3 — Gmail API** | Full OAuth, outbox with history/threads, server-side records | ~2-3 days | Only if tracking/deliverability insights become a need |

L2 and L3 are mutually exclusive choices (pick SMTP or Gmail, not both). L1 is free and can coexist with either.

## 2. The pipeline (all levels)

1. Recruiters screen: each contact card gains **"Compose email"**.
2. Server drafts the email with the existing LLM adapter (personalized from the recruiter's job + company) — reuse the pattern already used for tailoring.
3. User edits the subject/body in a modal, sees the recipient (from the extracted contact).
4. L1: open `mailto:` with prefilled subject/body (no data leaves the app except the draft itself).
5. L2: send via nodemailer using the user's SMTP settings; record `last_email_sent`/`email_status` on the contact row. L3: same but via Gmail API + message id.

## 3. Data model changes (L2+)
- `contacts` gains: `last_email_sent`, `email_status` (sent/failed), `email_message_id`.
- New `settings`-style config for SMTP (host, port, secure, user, app-password) — stored like `config.ini` (local, never committed), plaintext only in the local file with the same trust model as API keys.
- L1 needs no schema change.

## 4. Settings UX
- New small **"Email"** card in Settings: choose level (mailto / SMTP), SMTP fields when L2, "Test connection" button (mirrors the existing LLM test-connection pattern).

## 5. Security
- SMTP credentials live only in the user-local config (same rules as API keys — never committed, never logged).
- Sending is always user-initiated; a gentle rate note (per-platform daily limits apply to the user's own mailbox).

## 6. Out of scope (confirmed)
- Auto-apply / browser automation for any job platform.
- MCP servers (deferred — revisit only if an in-app AI agent becomes a product goal).
- Email open/click tracking infrastructure, multi-tenant billing.

**Next step when you approve:** implement **L1 (mailto compose)** first — it's the smallest possible shippable version of "send cold email from Tailor CV" — then decide on L2 from real usage. Write the spec + plan and build it?
