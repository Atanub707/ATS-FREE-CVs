<p align="center">
  <img src="https://github.com/Atanub707/ATS-FREE-CVs/raw/main/media/screenshot.png" width="100%" alt="ATS CV Tailor Dashboard"/>
</p>

<h1 align="center">ATS CV Tailor</h1>

<p align="center">
  <strong>Multi-source job scraper · AI-powered ATS matching · CV tailoring — all running locally.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind-4.x-06D6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"/>
</p>

---

## 📋 Overview

ATS CV Tailor scrapes job listings from 10 global sources, scores them against your CV using AI, and generates tailored ATS-optimized CVs. Everything runs locally on your machine — your data never leaves your computer. Each person gets their own **local account** with fully isolated CV, jobs, and match history.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Multi-Source Job Search** | 10 active sources: LinkedIn, Arbeitnow, SimplyHired, Dice, Reed, MyCareersFuture, Cutshort, Gupy, JobsCh, Daijob, MyJobMag |
| **AI ATS Scoring** | Score jobs against your CV. Get match %, skill gaps, missing keywords, recommendations |
| **CV Tailoring** | Generate ATS-optimized CVs tailored to specific job descriptions |
| **Applicant Counts** | See how many people applied to each LinkedIn job — right in the listing |
| **Local Accounts** | Email+password or guest sign-in; each account has its own CV, jobs, and history |
| **Manual JD Analysis** | Paste any job description, get scored and get a tailored CV — no scraping needed |
| **Smart Filtering** | Filter by date posted, job type, experience level, source, competition, keyword |
| **Batch Processing** | One-click "Score Pending" and "Tailor Matched" for the whole list |
| **Export** | Download tailored CVs as PDF |
| **Local & Private** | Runs entirely on your machine. Your CV and API key stay local |

---

## 📦 Prerequisites

Before installing, make sure you have one of these:

| Requirement | For Method | Notes |
|---|---|---|
| **Docker** | Docker install | [Download Docker Desktop](https://www.docker.com/products/docker-desktop/) (free) |
| **Node.js 18+** | Script / Manual install | [Download Node.js](https://nodejs.org/) (LTS recommended) |
| **LLM API Key** | All methods | Required for ATS scoring and CV tailoring. See [LLM Providers](#-supported-llm-providers) below |

---

## 🚀 Installation

Choose the method that works best for you.

### Method 1: Docker (Easiest — No Node.js Needed)

```bash
curl -sL https://github.com/Atanub707/ATS-FREE-CVs/archive/main.zip -o ats.zip
unzip ats.zip && cd ATS-FREE-CVs-main
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the **sign-in screen**:

- **Create Account** — email + password account (each account = fully isolated workspace)
- **Sign In** — return to your existing account
- **Guest** — instant password-less workspace ("Guest 1", "Guest 2"…); existing guests are one click away

> **Note:** Docker Desktop is required. [Download here](https://www.docker.com/products/docker-desktop/).

---

### Method 2: One-Click Script (Mac / Linux)

Open Terminal and paste:

```bash
curl -sL https://github.com/Atanub707/ATS-FREE-CVs/raw/main/setup.sh | bash
```

The script will:
1. Check for Node.js — if missing, installs it automatically
2. Download the app
3. Install dependencies
4. Ask for your API key (optional — can be set later in Settings)
5. Start the app and open your browser

If you prefer to download and run manually:

```bash
# Download
curl -sL https://github.com/Atanub707/ATS-FREE-CVs/archive/main.zip -o ats.zip
unzip ats.zip && cd ATS-FREE-CVs-main

# Install & run
npm install
npm run dev
```

---

### Method 3: Manual Install (For Developers)

```bash
git clone https://github.com/Atanub707/ATS-FREE-CVs.git
cd ATS-FREE-CVs
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔑 Setting Up Your API Key

ATS scoring and CV tailoring require an LLM API key. The app uses a **Bring Your Own Key (BYOK)** model — no keys are bundled.

### Option A: Use the Settings UI

1. Start the app and sign in
2. Click the **account button** (avatar, top-right) → **Settings**
3. Select your **LLM Provider**
4. Enter your **API Key**
5. Click **Apply Config**

### Option B: Edit config.ini

Open `config.ini` in the project root:

```ini
[llm]
provider=gemini
apiKey=your_api_key_here
model=gemini-3.6-flash
temperature=0.2
```

---

## 🤖 Supported LLM Providers

| Provider | Free Tier? | How to Get a Key |
|---|---|---|
| **Google Gemini** | ✅ Free (via Google) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **NVIDIA (Free Tier)** | ✅ Free, no key needed | Select `NVIDIA` in Settings |
| **OpenAI** | ❌ Paid | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | ❌ Paid | [console.anthropic.com](https://console.anthropic.com) |
| **OpenRouter** | ❌ Paid | [openrouter.ai/keys](https://openrouter.ai/keys) — access 200+ models |

> 💡 **Recommendation:** Google Gemini offers a free tier with generous quota. Sign up, get your key, and you're ready to go.

---

## 🎯 How to Use

### Step 1: Set Up Your Master CV

Click the **account button** (avatar, top-right) → **Master Candidate CV** and fill in:
- Professional summary
- Work experience (titles, companies, dates, responsibilities)
- Skills (categorized)
- Education
- Certifications & projects

This is the baseline CV that all jobs will be scored and tailored against. Each account has its own Master CV.

---

### Step 2: Search for Jobs

1. Enter a **job title or keywords** (e.g., "DevOps Engineer")
2. Optionally enter a **location** (e.g., "Remote", "London")
3. Select your **sources** from the available options
4. Set **Posted** filter (Dice, Reed, SimplyHired show older postings — use "Anytime")
5. Set **Job Type** (Remote / Hybrid / On-site) and **Level** (Junior / Mid / Senior / Lead)
6. Optionally tick **Under 10 applicants** to skip high-competition roles
7. Click **Search Jobs**

### Job Sources

| Source | Best For | Method | API Key? |
|---|---|---|---|
| **LinkedIn** | Global listings | Guest API | No |
| **Arbeitnow** | Germany/Europe | Free API | No |
| **SimplyHired** | Global coverage | HTML parsing | No |
| **Dice** | US tech jobs | JSON-LD extraction | No |
| **Reed** | UK jobs | Next.js SSR | No |
| **MyCareersFuture** 🇸🇬 | Singapore | Official gov API | No |
| **Cutshort** 🇮🇳 | India | HTML scraping | No |
| **Gupy** 🇧🇷 | Brazil | HTML scraping | No |
| **JobsCh** 🇨🇭 | Switzerland | HTML scraping | No |
| **Daijob** 🇯🇵 | Japan | HTML scraping | No |
| **MyJobMag** 🇳🇬 | Nigeria | HTML scraping | No |
| RemoteOK / WeWorkRemotely | Global remote | — | Coming soon |

> ℹ️ **Dice, Reed, SimplyHired** use original posting dates. If you select "Last 24 Hours" and get 0 results, switch to "Anytime" — the jobs are still active, just older.
>
> 👥 **Applicant counts** are shown for LinkedIn jobs ("200 applicants") — see competition at a glance without opening the posting.

---

### Step 3: Score Jobs

1. Click **Score** on any job
2. The AI analyzes your CV against the job description
3. Results include:
   - **Match score** (0-100%)
   - **Matching skills** — what you already have
   - **Missing skills** — what to add or highlight
   - **Missing keywords** — specific terms to include
   - **Recommendations** — actionable steps to improve

---

### Step 4: Tailor Your CV

1. Click **Tailor** on a scored job
2. The AI rewrites your CV to target that specific job
3. Download the tailored CV as **PDF**

**Batch options:** Use **"Score Pending"** and **"Tailor Matched"** buttons to process multiple jobs at once.

---

### Step 5: Manual JD Analysis (No Scraping Needed)

Paste any job description manually and get a scored, tailored CV without searching:

1. Click the **account button** → **Manual JD** (or press **⌘J**)
2. Enter **Job Title**, **Company** (optional), and paste the **Job Description**
3. Click **Analyze Match** — see your score, matching/missing skills, and recommendations
4. Update your Master CV based on the recommendations
5. Click **Generate Tailored CV**
6. Download as PDF

---

### Step 6: Sign Out & Switch Accounts

1. Click the **account button** (avatar, top-right)
2. **Sign out** returns you to the login screen
3. Sign back in with your email, or one-click any existing guest account

> 🗂️ **Isolation:** accounts never share data. Each sign-in sees only its own jobs, CVs, scores, and applied history — perfect for multiple users on one machine.

---

## ⚙️ Configuration Reference

All settings are stored in `config.ini`:

```ini
[llm]
provider=gemini
apiKey=
baseUrl=
model=gemini-3.6-flash
temperature=0.2

[thresholds]
minMatchForTailor=40
earlyBlockThreshold=30

[storage]
mode=sqlite
sqliteDbPath=./data/ats_jobs.sqlite
jsonDbPath=./data/jobs_backup.json

[scraper]
stealthMode=true
maxRetries=3
```

You can edit this file directly or use the **Settings** UI in the app.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide icons |
| **Backend** | Express 4, TypeScript, tsx |
| **LLM Integration** | OpenAI-compatible providers (OpenCode Go, OpenRouter, OpenAI, Gemini, Anthropic, NVIDIA) |
| **Scraping** | Native `fetch`, cheerio |
| **Storage** | SQLite (`better-sqlite3`, WAL) — users, sessions, jobs, master CVs |
| **Auth** | Local accounts — scrypt password hashing, httpOnly cookie sessions |
| **Documents** | pdfkit (PDF) |
| **Build** | Vite, esbuild |
| **CI/CD** | GitHub Actions — gitleaks, npm audit, Trivy, auto-release to GitHub Releases + GHCR |

---

## 📄 License

MIT

---

<p align="center">
  Built with ❤️ for developers who hate manual job applications.
</p>
