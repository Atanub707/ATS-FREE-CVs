# AGENTS.md — Agent Rules

## 🔒 Push policy (MOST IMPORTANT — do not violate)

**NEVER `git push` unless the user explicitly asks you to** ("push it", "release", "deploy").

- All work is committed **locally** after passing the quality gate.
- Pushing to GitHub happens ONLY on explicit user request — the user validates the changes first.
- When the user asks to push: run the full gate, then push, then report what was pushed.

## 🚦 Mandatory pre-push gate (do not skip)

**Never push code without passing ALL of these checks first.** Run them in this order. If any fails, fix it before pushing.

```bash
# 1. Type check — must exit 0 with zero errors
npx tsc --noEmit

# 2. Security audit — must report 0 high/critical vulnerabilities
npm audit --audit-level=high

# 3. Frontend build — must complete successfully
npx vite build
```

A git **pre-push hook** enforces the same gate automatically. If the hook is installed (`.githooks/pre-push` + `git config core.hooksPath .githooks`), a failed check blocks the push entirely — the commit stays local until the issue is fixed.

## Push checklist (manual confirmation)

Before `git push origin main`:

- [ ] `npx tsc --noEmit` → exit 0, no errors
- [ ] `npm audit --audit-level=high` → 0 high/critical (moderate allowed only if in `.npm-audit-allowlist`; if none exists, fix all)
- [ ] `npx vite build` → success
- [ ] Docker rebuild sanity (if server code changed): `docker-compose build && docker-compose up -d` + confirm container starts and logs show "server running"
- [ ] No secrets in the diff (never commit config.ini, .env, API keys — see SECURITY.md)
- [ ] CHANGELOG.md updated when shipping a release

## Secrets rules (non-negotiable)

- Never commit `config.ini`, `.env`, API keys, tokens, or passwords.
- `config.ini` is gitignored and user-local — it is mounted into Docker, never committed.
- If a secret was ever committed, treat it as compromised: rotate it, remove from history, and warn on startup (see server.ts COMPROMISED_KEYS).
- gitleaks runs in CI — the pre-push hook also rejects pushes containing secrets.

## CI/CD

- GitHub Actions (`build.yml`) runs on every push to main: gitleaks → npm audit → Trivy → build → release (v* tag) + Docker push.
- The pipeline is a hard gate: security failures stop the build.
- Release notes are auto-extracted from CHANGELOG.md (see workflow).
