# Release Template — Tailor CV

> **Use this template for EVERY version release.** The CI pipeline
> (`.github/workflows/build.yml` → `release-notes` job) publishes the notes
> automatically when a `v*` tag is pushed — the notes are extracted from the
> matching `## vX.Y.Z` section in `CHANGELOG.md`.
>
> **To release a new version:**
> 1. Add a `## vX.Y.Z (YYYY-MM-DD)` section at the top of `CHANGELOG.md` following this template
> 2. Commit, then `git tag vX.Y.Z` and `git push origin vX.Y.Z`
> 3. Done — the release page appears with your notes (no packages attached)

---

# vX.Y.Z — <Short Release Title>

<Month DD, YYYY>

## ✨ Features
- _What new capabilities users get. One line each, user-facing language._

## 🐛 Fixes
- _Bugs that were fixed. Mention what was broken and what changed._

## ⚠️ Known Issues
- _Anything users should know before updating (e.g., "Existing sessions need a re-login")._
- _If none: write "None known."_

## 🔄 Breaking Changes
- _Anything that changes behavior, config, or data. If none: "None."_

## 📦 How to Update
- **macOS / Linux:** re-run the installer — `curl -fsSL https://github.com/Atanub707/Tailor-AI/raw/main/scripts/install.sh | bash` (skips completed steps)
- **Windows:** re-run the PowerShell one-liner — `irm https://raw.githubusercontent.com/Atanub707/Tailor-AI/main/scripts/install.ps1 | iex`
- **Your data is untouched** — jobs, CV, and history stay on your machine.

## 🙏 Thanks
- _Contributors, testers, or anyone who helped with this release. If none: omit this section._

---

## Example (filled-in)

# v1.4.0 — Professional UI Redesign

August 12, 2026

## ✨ Features
- Whitish multi-tint redesign across every screen — Dashboard, Login, Master CV, Recruiters, Settings.
- AI Interview: job-description-grounded mock interviews with rubric scoring and history.
- LinkedIn Posts screen: find job announcements recruiters share as posts (last 24 hours).
- One-click installers for Windows and macOS (no code-signing needed).

## 🐛 Fixes
- Fixed blank KPI cards on the dashboard.
- Fixed duplicate recruiters across job sources (dedupe by LinkedIn URL + email).
- Fixed interview score inflation — answers are now rubric-scored on 4 dimensions.

## ⚠️ Known Issues
- Search engines may rate-limit LinkedIn Posts discovery from datacenter IPs; residential IPs work reliably.

## 🔄 Breaking Changes
- None.

## 📦 How to Update
- Re-run your platform installer (see above) — data is untouched.

## 🙏 Thanks
- All users who tested the interview feature and reported the scoring feedback.
