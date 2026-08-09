# Bug Reporting — How It Works (End to End)

The app can file bug reports directly on your GitHub repository — no
copy-pasting into the GitHub website.

## The flow

```
1. User finds a bug
        │
        ▼
2. Settings → Report a Bug → GitHub Issue
        │  (title + what happened + optional steps)
        ▼
3. POST /api/settings/bug-report          ← local Express server
        │
        ▼
4. Server reads [github] from config.ini  ← token, owner, repo
        │
        ▼
5. POST https://api.github.com/repos/{owner}/{repo}/issues
        │  (Authorization: Bearer <PAT>)
        ▼
6. Issue created → issue URL returned
        ▼
7. Settings shows "Issue #42 created" + "Open issue" link
```

## Before the first report — one-time setup (2 minutes)

1. Create a GitHub PAT with **Issues: Read and write** on your repository
   (full steps: [docs/TOKENS.md → Section 3](TOKENS.md)).
2. Open **Settings** in the app.
3. In **Report a Bug → GitHub Issue**:
   - **Owner** — your GitHub username or org (default `Atanub707`)
   - **Repository** — the repo where issues should land (default `ATS-FREE-CVs`)
   - **GitHub token** — paste the PAT
4. Click **Apply Config**.

Nothing is submitted until you click **Submit Bug Report** — saving the
token only stores it.

## Filing a report

1. **Settings → Report a Bug → GitHub Issue**.
2. **Title** — short summary, e.g. *"Download button opens a blank PDF"*.
3. **What happened?** — expected vs actual behavior.
4. **Steps to reproduce** (optional) — numbered steps.
5. Click **Submit Bug Report**.

The server appends an environment block to the issue automatically:

```
**App version:** 1.2.0
**Node:** v22.23.2
**Platform:** linux x64
**Reported:** 2026-08-09T14:00:00.000Z
```

On success you see the issue number and an **Open issue** link.
On failure you see a plain-language reason (see error matrix below).

## What gets sent — and what never does

**Sent to GitHub:** your title, description, steps, and the environment
block above. That's it.

**Never sent:** your LLM key, Apify token, the GitHub token itself, CV
content, job data, or passwords. (Don't paste secrets into the bug text.)

## Error messages and what they mean

| You see | Meaning | Fix |
|---|---|---|
| "No GitHub token configured…" | Token slot is empty | Add the PAT in Settings → Report a Bug → Apply Config |
| "GitHub rejected the token (401)" | Token invalid or expired | Create a new PAT (TOKENS.md §3) |
| "GitHub denied the request (403)" | Missing **Issues: write** permission, or rate limit | Recreate the token with Issues: Read and write |
| "Repository X was not found (404)" | Wrong owner/repo, or token can't see it | Check Owner / Repository fields; token must target that repo |
| "GitHub could not create the issue: …" | Other API rejection (e.g. 422) | Read the message and adjust the report |
| "Failed to reach GitHub" | Network/server issue | Try again in a minute |

## Local behavior notes

- The route is `POST /api/settings/bug-report` on your local server; it
  uses Node's built-in `fetch` — no extra dependency.
- `config.ini` is re-read for every report, so editing Owner/Repo in the
  Settings UI takes effect immediately after Apply Config.
- Reports are **not** stored locally — the issue lives only on GitHub
  (this keeps the DB clean).
- If you run multiple machines, each one needs its own token saved.

## Plan & architecture

See [docs/PLAN_BUG_REPORT.md](PLAN_BUG_REPORT.md) for the approved plan,
security rules, and acceptance criteria.
