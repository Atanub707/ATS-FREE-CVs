# Bug Reporting — How It Works (End to End)

Anyone using the app can report a bug. There are **two modes** — the app
picks the right one automatically:

| Who | Mode | What happens |
|---|---|---|
| **Owner** (GitHub token saved in Settings) | `api` | Issue is **created instantly** via the GitHub API — the link appears immediately |
| **Any other user** (no token) | `prefill` | GitHub opens with the report **pre-filled** — sign in with a free GitHub account, click *Submit new issue* |

No GitHub token is ever required to report a bug.

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
        ├── token saved?  ──▶ 4a. POST api.github.com/.../issues (Bearer PAT)
        │                          │
        │                          ▼
        │                    Issue created → link shown to the user
        │
        └── no token?  ──▶ 4b. Build pre-filled URL:
                                github.com/{owner}/{repo}/issues/new
                                ?title=…&body=…
                                │
                                ▼
                          Browser opens it → user signs in (free) →
                          reviews → clicks "Submit new issue"
```

## One-time setup (owner only, 2 minutes)

Only the **repository owner** needs this. Other users don't configure
anything.

1. Create a GitHub PAT with **Issues: Read and write** on your repository
   (full steps: [docs/TOKENS.md → Section 3](TOKENS.md)).
2. Open **Settings** in the app.
3. In **Report a Bug → GitHub Issue**:
   - **Owner** — your GitHub username or org (default `Atanub707`)
   - **Repository** — the repo where issues should land (default `ATS-FREE-CVs`)
   - **GitHub token** — paste the PAT
4. Click **Apply Config**.

Users without a token skip straight to filing a report — the Owner /
Repository defaults are enough for GitHub to build the pre-filled page.

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

On success you see the issue number and an **Open issue** link (owner mode),
or GitHub opens with your report pre-filled plus a **Copy report** button
(user mode). On failure you see a plain-language reason (see error matrix
below).

## What gets sent — and what never does

**Sent to GitHub:** your title, description, steps, and the environment
block above. That's it. In prefill mode you review exactly this text
before it is submitted — nothing is sent until you click *Submit new issue*.

**Never sent:** your LLM key, Apify token, the GitHub token itself, CV
content, job data, or passwords. (Don't paste secrets into the bug text.)

## No GitHub account at all?

Click **Copy report** after submitting — the full report (including the
environment block) is on your clipboard. Paste it anywhere: an email, a
Discord server, or the repository's Discussions tab.

## Error messages and what they mean

| You see | Meaning | Fix |
|---|---|---|
| "GitHub rejected the token (401)" | Token invalid or expired (owner mode) | Create a new PAT (TOKENS.md §3) |
| "GitHub denied the request (403)" | Missing **Issues: write** permission, or rate limit (owner mode) | Recreate the token with Issues: Read and write |
| "Repository X was not found (404)" | Wrong owner/repo, or token can't see it | Check Owner / Repository fields; token must target that repo |
| "GitHub could not create the issue: …" | Other API rejection (e.g. 422) (owner mode) | Read the message and adjust the report |
| "Failed to reach GitHub" | Network/server issue | Try again in a minute |
| Prefill page says "Page not found" | Owner/Repo mismatch or private repo | Check the Owner / Repository fields in Settings |

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
