# Plan — In-App Bug Reports → GitHub Issues

**Status:** Approved · **Target:** Tailor CV v1.3.0

## 1. Goal

Let any user file a bug from the app (Settings → Report a Bug). Submitting
the form creates a real issue on the project's GitHub repository, and the
user immediately gets the issue link back.

```
User finds bug ──▶ Settings → Report a Bug ──▶ POST /api/settings/bug-report
                                                   │
                                                   ▼
                                     GitHub Issues API (REST)
                                                   │
                                                   ▼
                              issue created + issue URL shown to user
```

## 2. How it works at the local level

1. The user pastes a **GitHub Personal Access Token** (PAT) into Settings →
   Bug Reports (stored in the gitignored `config.ini`, never committed).
2. Settings also stores the target repository: `owner` + `repo`
   (defaults: `Atanub707` / `ATS-FREE-CVs`, editable).
3. The Bug Report form collects **Title**, **What happened**, and optional
   **Steps to reproduce**.
4. On submit the server calls
   `POST https://api.github.com/repos/{owner}/{repo}/issues` with the PAT
   as a Bearer token.
5. The issue body automatically gets an environment block (app version,
   Node version, platform, timestamp) so maintainers can reproduce it.
6. The UI shows the created issue URL (opens in a new tab) or a clear
   error explaining what to fix (missing token, bad repo, rate limit).

## 3. Changes

| Area | Change |
|---|---|
| `src/types.ts` | `AppConfig` gains a `github` section: `owner`, `repo`, `token` |
| `server/config.ts` | Load/save the `[github]` section of `config.ini` |
| `server.ts` | New route `POST /api/settings/bug-report` (validation, GitHub API call, friendly errors) |
| `src/components/SettingsModal.tsx` | New "Bug Reports" section: GitHub token + owner/repo fields, and the report form (title / what happened / steps), status + issue link |
| `docs/TOKENS.md` | Professional guide: LLM key, Apify token, GitHub PAT |
| `docs/LOCAL_SETUP.md` | A-to-Z local setup + how bug reports behave locally |
| `docs/BUG_REPORTING.md` | End-to-end functional documentation of the feature |
| `README.md`, `CHANGELOG.md` | Links + release entry |

## 4. Security rules (non-negotiable)

- The GitHub PAT is stored in `config.ini` only — it is gitignored and
  mounted into Docker, never committed, never logged.
- The server never echoes the token; the UI shows the masked value.
- The issue body never contains secrets (no keys, no tokens, no CV data
  unless the user types it themselves).
- API errors are mapped to user-friendly messages; raw GitHub responses
  are never surfaced wholesale.

## 5. Error handling matrix

| Case | Response |
|---|---|
| Missing title/description | 400 "Please provide a title and a description." |
| No PAT configured | 400 → prompt to add it in Settings |
| Token invalid (401) | 502 → "GitHub rejected the token" |
| Rate limit / permission (403) | 502 → explain |
| Repo not found (404) | 502 → "repo not found or token lacks access" |
| Validation (422) | 502 → GitHub message |
| Network failure | 500 → retry hint |

## 6. Acceptance criteria

- Settings shows the Bug Reports section with token, owner, repo, form.
- Submitting without a token shows the "add a token" guidance (no crash).
- With a valid PAT, an issue appears on the configured repo and the link
  is shown to the user.
- Nothing is written to the repository except the intended issue.
- `config.ini` still round-trips all sections after saving Settings.

## 7. Out of scope (v1)

- OAuth "Sign in with GitHub" (a PAT is simpler and keeps one token slot).
- File/screenshot uploads (the body text can contain a paste of the error).
- Auto-labeling / assignees (can be added later on the GitHub side).
