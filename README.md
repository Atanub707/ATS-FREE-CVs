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

ATS CV Tailor scrapes job listings from 7+ public sources, scores them against your CV using AI, and generates tailored ATS-optimized CVs. Everything runs locally on your machine — your data never leaves your computer.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Multi-Source Job Search** | Search 7 sources: LinkedIn, Arbeitnow, SimplyHired, Dice, Reed, Greenhouse, Lever |
| **AI ATS Scoring** | Score jobs against your CV. Get match %, skill gaps, missing keywords, recommendations |
| **CV Tailoring** | Generate ATS-optimized CVs tailored to specific job descriptions |
| **Company Portal API** | Fetch jobs directly from company career pages via Greenhouse & Lever APIs |
| **Manual JD Analysis** | Paste any job description, get scored and get a tailored CV — no scraping needed |
| **Smart Filtering** | Filter by date posted, experience level (entry/mid/senior/lead), source, keyword |
| **Export Formats** | Download tailored CVs as DOCX, PDF, or TXT |
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

Open [http://localhost:3000](http://localhost:3000).

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

### Method 3: One-Click Script (Windows)

1. **[⬇ Download setup.bat](https://raw.githubusercontent.com/Atanub707/ATS-FREE-CVs/main/setup.bat)**
2. Double-click the downloaded file
3. Follow the on-screen prompts

The script will auto-install Node.js if missing, download the app, install dependencies, and start it.

---

### Method 4: Manual Install (For Developers)

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

1. Start the app and open [http://localhost:3000](http://localhost:3000)
2. Click **Settings** (gear icon, top-right)
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

Click **Master Candidate CV** (top-left) and fill in:
- Professional summary
- Work experience (titles, companies, dates, responsibilities)
- Skills (categorized)
- Education
- Certifications & projects

This is the baseline CV that all jobs will be scored and tailored against.

---

### Step 2: Search for Jobs

1. Enter a **job title or keywords** (e.g., "DevOps Engineer")
2. Optionally enter a **location** (e.g., "Remote", "London")
3. Select your **sources** from the available options
4. Set **Posted** filter (Dice, Reed, SimplyHired show older postings — use "Anytime")
5. Set **Level** filter (Junior / Mid / Senior / Lead)
6. Click **Search Jobs**

### Job Sources

| Source | Best For | Method | API Key? |
|---|---|---|---|
| **LinkedIn** | Global listings | Guest API | No |
| **Arbeitnow** | Germany/Europe | Free API | No |
| **SimplyHired** | Global coverage | HTML parsing | No |
| **Dice** | US tech jobs | JSON-LD extraction | No |
| **Reed** | UK jobs | Next.js SSR | No |
| **Greenhouse** | Company career portals | REST API | No |
| **Lever** | Company career portals | REST API | No |

> ℹ️ **Dice, Reed, SimplyHired** use original posting dates. If you select "Last 24 Hours" and get 0 results, switch to "Anytime" — the jobs are still active, just older.

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
3. Download the tailored CV:
   - **DOCX** (Word — best for ATS systems)
   - **PDF**
   - **TXT** (plain text)

**Batch options:** Use **"Score Pending"** and **"Tailor Matched"** buttons to process multiple jobs at once.

---

### Step 5: Manual JD Analysis (No Scraping Needed)

Paste any job description manually and get a scored, tailored CV without searching:

1. Click **Manual JD** in the top navbar
2. Enter **Job Title**, **Company** (optional), and paste the **Job Description**
3. Click **Analyze Match** — see your score, matching/missing skills, and recommendations
4. Update your Master CV based on the recommendations
5. Click **Generate Tailored CV**
6. Download as DOCX or PDF

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
| **LLM Integration** | Google Gemini AI SDK, OpenAI-compatible API |
| **Scraping** | Native `fetch`, cheerio |
| **Documents** | docx (Word), pdfkit (PDF) |
| **Build** | Vite, esbuild |
| **Storage** | JSON files |

---

## 📄 License

MIT

---

<p align="center">
  Built with ❤️ for developers who hate manual job applications.
</p>
