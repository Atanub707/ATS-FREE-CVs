<p align="center">
  <img src="https://github.com/Atanub707/ATS-FREE-CVs/raw/main/media/screenshot.png" width="100%" alt="Tailor CV Dashboard"/>
</p>

<h1 align="center">Tailor CV</h1>

<p align="center">
  <strong>AI-powered job search & CV tailoring — 17+ sources, ATS scoring, and tailored CVs. Runs 100% on your machine.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind-4.x-06D6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"/>
</p>

---

## What is Tailor CV?

A self-hosted job-hunting tool that:

- **Scrapes job listings** from 17+ sources (LinkedIn, Indeed, Glassdoor, Upwork, Naukri + free built-ins: Arbeitnow, Dice, Reed, SimplyHired, RemoteOK, WeWorkRemotely, MyCareersFuture, Cutshort, Gupy, JobsCh, Daijob, MyJobMag, and more)
- **Scores jobs against your CV** with AI — match %, matching/missing skills, missing keywords, and recommendations
- **Tailors your CV** to any specific job description and exports an ATS-optimized PDF
- **Finds recruiter job posts** on LinkedIn in real time (free engine, no token needed)
- **Extracts recruiters** and drafts cold emails via your own SMTP
- Keeps **everything local** — jobs, CV, history, and API keys never leave your machine

**Screens have dedicated URLs:** `/` dashboard · `/settings` · `/recruiters` · `/master-cv` · `/manual-jd` · `/job-portals` · `/ai-interview` · `/linkedin-posts` — reload and you stay where you were.

---

## Requirements

| Requirement | Notes |
|---|---|
| **Docker Desktop** | Recommended install path — signed, free, warning-free |
| **Node.js 18+** | Only for the developer/manual install |
| **LLM API key** | Required for ATS scoring & CV tailoring (bring your own) |
| **Apify token** (optional) | Only for LinkedIn/Indeed/Naukri/Glassdoor/Upwork sources |

---

## 🚀 Install (one command)

> 📖 Full guide: [scripts/HOW-TO-INSTALL.md](scripts/HOW-TO-INSTALL.md) — install, update, uninstall, troubleshooting.

**Windows — paste into PowerShell:**

```powershell
irm https://raw.githubusercontent.com/Atanub707/ATS-FREE-CVs/main/scripts/install.ps1 | iex
```

**macOS / Linux — paste into Terminal:**

```bash
curl -fsSL https://github.com/Atanub707/ATS-FREE-CVs/raw/main/scripts/install.sh | bash
```

The installer is **idempotent**: checks/installs Docker Desktop, starts the engine, downloads Tailor CV, and opens `http://localhost:3000`. Re-run it anytime — finished steps are skipped. No code-signing, no SmartScreen warnings.

### Update

```powershell
# Windows
irm https://raw.githubusercontent.com/Atanub707/ATS-FREE-CVs/main/scripts/update.ps1 | iex
```
```bash
# macOS / Linux
curl -fsSL https://github.com/Atanub707/ATS-FREE-CVs/raw/main/scripts/update.sh | bash
```

### Uninstall

`scripts/uninstall.sh` (macOS/Linux) · `scripts/uninstall.bat` (Windows). Removes the app + data; Docker stays.

### Alternatives

```bash
# Docker manual
curl -sL https://github.com/Atanub707/ATS-FREE-CVs/archive/main.zip -o ats.zip
unzip ats.zip && cd ATS-FREE-CVs-main
docker compose up -d

# Developer mode (Node 18+, no Docker)
git clone https://github.com/Atanub707/ATS-FREE-CVs.git
cd ATS-FREE-CVs && npm install && npm run dev
```

---

## 🔑 Configure keys

ATS scoring and CV tailoring need an **LLM API key** (Bring Your Own Key). Apify-powered sources need an Apify token.

1. Start the app and sign in (account or **Guest**)
2. **Account menu → Settings → Integrations**
3. Pick your **LLM provider** + API key (and **Apify token** if using Apify sources)
4. **Apply Config**

**Supported LLM providers:** OpenCode Go (default) · Google Gemini · OpenAI · Anthropic (Claude) · OpenRouter · NVIDIA.

Full token guide: [docs/TOKENS.md](docs/TOKENS.md)

---

## 🎯 Usage

1. **Set up your Master CV** — Account menu → **Master Candidate CV**. Fill in summary, experience, skills, education, certifications. Use the live PDF preview, import an existing resume (PDF/DOCX/TXT), or **AI Compress** to fit 1–2 pages.
2. **Search jobs** — enter a role (e.g. "DevOps Engineer"), pick sources and filters, click **Search Jobs**.
3. **Score** — AI analyzes your CV against each job: match %, skill gaps, missing keywords, recommendations.
4. **Tailor** — generate an ATS-optimized CV for a specific job and download as PDF. Batch **Score Pending** / **Tailor Matched** for the whole list.
5. **Manual JD** (`⌘J`) — paste any job description and get a scored, tailored CV without scraping.
6. **LinkedIn Posts** — real-time job posts recruiters share (free engine; Apify coming later).
7. **Recruiters** — contacts extracted from descriptions; AI-drafted cold emails via your SMTP; follow-ups, templates, batch send, WhatsApp links, CSV export.
8. **AI Interview** — practice mock interviews grounded in a job description.

---

## ⚙️ Configuration (`config.ini`)

```ini
[llm]
provider=gemini
apiKey=
model=gemini-3.6-flash
temperature=0.2

[thresholds]
minMatchForTailor=40
earlyBlockThreshold=30

[storage]
mode=sqlite
sqliteDbPath=./data/ats_jobs.sqlite

[scraper]
stealthMode=true
maxRetries=3
```

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TypeScript · Tailwind CSS v4 · react-router · Phosphor + Lucide icons |
| Backend | Express 4 · TypeScript · tsx |
| LLM | OpenAI-compatible providers (OpenCode Go, OpenAI, Gemini, Anthropic, OpenRouter, NVIDIA) |
| Scraping | Native `fetch` · cheerio · Apify REST API |
| Storage | SQLite (`better-sqlite3`, WAL) |
| Auth | Local accounts · scrypt · httpOnly cookies |
| Email | nodemailer (your own SMTP) |
| Documents | pdfkit (PDF) · mammoth + pdf-parse (import) |
| Build / CI | Vite · esbuild · GitHub Actions (gitleaks → audit → Trivy → auto-release) |

---

## 📄 License

[MIT](LICENSE) — free and open source.

---

## ⚖️ Legal & Terms of Use

- **Personal, local use.** Runs on your machine; data stays local. Not a cloud service.
- **Scraping & ToS.** Automated retrieval of publicly visible listings may violate a site's Terms of Service. **You are responsible for your own use** — comply with each site's `robots.txt`, Terms, and applicable law (GDPR, India DPDP Act 2023).
- **Safeguards.** The tool respects `robots.txt`, throttles requests, and strips personal contact data from stored listings.
- **No affiliation.** Not affiliated with or endorsed by LinkedIn, Indeed, or any job board.
- **No warranty.** Provided "as is". Site owners with concerns: open an issue and we'll act promptly.
