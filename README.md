<p align="center">
  <img src="https://github.com/Atanub707/ATS-FREE-CVs/raw/main/media/screenshot.png" width="100%" alt="Tailor Dashboard"/>
</p>

<h1 align="center">Tailor CV</h1>

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

Tailor scrapes job listings from **17 sources** — 5 Apify-powered (LinkedIn, Indeed, Naukri, Glassdoor, Upwork) plus 12 free built-ins — scores them against your CV using AI, and generates tailored ATS-optimized CVs. A **job portals browser** adds links to 190+ boards worldwide. Everything runs locally on your machine — your data never leaves your computer. Each person gets their own **local account** with fully isolated CV, jobs, and match history.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Multi-Source Job Search** | 17 sources: Apify-powered LinkedIn, Indeed, Naukri, Glassdoor, Upwork + 12 free built-ins (Arbeitnow, SimplyHired, Dice, Reed, RemoteOK, WeWorkRemotely, MyCareersFuture, Cutshort, Gupy, JobsCh, Daijob, MyJobMag) |
| **AI ATS Scoring** | Score jobs against your CV. Get match %, skill gaps, missing keywords, recommendations |
| **CV Tailoring** | Generate ATS-optimized CVs tailored to specific job descriptions |
| **Master CV & AI Compression** | Full-screen editor with live page-wise PDF preview, PDF/DOCX/TXT import, and **AI Compress** — analyzes your CV against live market keywords and compresses it to 1–2 pages (analyze → rewrite → verify) |
| **Recruiters & Cold Email** | Recruiter contacts extracted from job descriptions, AI-drafted emails, sent via your own SMTP — with sent/failed status on every card |
| **Job Portals Browser** | 190+ job boards worldwide, organized into 13 categories with country flags |
| **Manual JD Analysis** | Paste any job description, get scored and get a tailored CV — no scraping needed; every analysis is saved and restorable |
| **Applicant Counts** | See how many people applied to each LinkedIn job — right in the listing |
| **Local Accounts** | Email+password or guest sign-in; each account has its own CV, jobs, and history |
| **Smart Filtering** | Filter by date posted, job type, experience level, source, competition, keyword |
| **Batch Processing** | One-click "Score Pending" and "Tailor Matched" for the whole list (3 concurrent, no UI freeze) |
| **Guided Onboarding** | Auto-runs on first sign-in — highlights search, sources, recruiters, and settings |
| **Export** | Download tailored CVs as PDF |
| **Local & Private** | Runs entirely on your machine. Your CV and API keys stay local |

---

## 📦 Prerequisites

Before installing, make sure you have one of these:

| Requirement | For Method | Notes |
|---|---|---|
| **Docker** | Docker install | [Download Docker Desktop](https://www.docker.com/products/docker-desktop/) (free) |
| **Node.js 18+** | Script / Manual install | [Download Node.js](https://nodejs.org/) (LTS recommended) |
| **LLM API Key** | All methods | Required for ATS scoring and CV tailoring. See [LLM Providers](#-supported-llm-providers) below |
| **Apify Token** (optional) | Apify-powered sources | Only needed for LinkedIn/Indeed/Naukri/Glassdoor/Upwork. Set in Settings → Integrations |

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

## 🔑 Setting Up Your Keys

ATS scoring and CV tailoring require an LLM API key. The app uses a **Bring Your Own Key (BYOK)** model — no keys are bundled. Apify-powered sources need an Apify token.

### Option A: Use the Settings UI

1. Start the app and sign in
2. Click the **account button** (avatar, top-right) → **Settings**
3. Go to **Integrations** and select your **LLM Provider** / enter your **API Key** (and **Apify Token** for the Apify sources)
4. Click **Apply Config**

> Full token guide (LLM + Apify): **[docs/TOKENS.md](docs/TOKENS.md)**
> A-to-Z local setup: **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**

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
| **OpenCode Go** | ✅ Free (default) | Built-in default provider — pre-selected in Settings |
| **Google Gemini** | ✅ Free (via Google) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **NVIDIA (Free Tier)** | ✅ Free, no key needed | Select `NVIDIA` in Settings |
| **OpenAI** | ❌ Paid | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | ❌ Paid | [console.anthropic.com](https://console.anthropic.com) |
| **OpenRouter** | ❌ Paid | [openrouter.ai/keys](https://openrouter.ai/keys) — access 200+ models |

> 💡 **Recommendation:** OpenCode Go works with zero setup; Google Gemini also offers a generous free tier. Sign up, get your key, and you're ready to go.

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

**Tips:**
- The editor shows a **live page-wise PDF preview** as you type
- **Upload** an existing resume (PDF, DOCX, or TXT) to import it instead of typing
- Use **AI Compress** to shrink your CV to 1–2 pages using live market keywords (reversible via the Versions drawer)

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
| **LinkedIn** | Global listings | Apify actor | Apify token |
| **Indeed** | Global listings | Apify actor | Apify token |
| **Naukri** 🇮🇳 | India | Apify actor | Apify token |
| **Glassdoor** | Global listings | Apify actor | Apify token |
| **Upwork** | Global freelance | Apify actor | Apify token |
| **Arbeitnow** | Germany/Europe | Free API | No |
| **SimplyHired** | USA coverage | HTML parsing | No |
| **Dice** | US tech jobs | JSON-LD extraction | No |
| **Reed** | UK jobs | Next.js SSR | No |
| **RemoteOK** | Global remote | Free API | No |
| **WeWorkRemotely** | Global remote | HTML parsing | No |
| **MyCareersFuture** 🇸🇬 | Singapore | Official gov API | No |
| **Cutshort** 🇮🇳 | India | HTML scraping | No |
| **Gupy** 🇧🇷 | Brazil | HTML scraping | No |
| **JobsCh** 🇨🇭 | Switzerland | HTML scraping | No |
| **Daijob** 🇯🇵 | Japan | HTML scraping | No |
| **MyJobMag** 🇳🇬 | Nigeria | HTML scraping | No |
| **Custom** | Any URL | Scrape any posting | No |

> ℹ️ **Dice, Reed, SimplyHired** use original posting dates. If you select "Last 24 Hours" and get 0 results, switch to "Anytime" — the jobs are still active, just older.
>
> 👥 **Applicant counts** are shown for LinkedIn jobs ("200 applicants") — see competition at a glance without opening the posting.
>
> 🗂️ **Job Portals:** the **Job Portals** button in the navbar opens 190+ boards worldwide (13 categories), so you can search beyond the built-in sources.

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

> 📚 **History:** every analysis is saved per account — restore any past analysis or its tailored CV anytime.

---

### Step 6: Recruiters & Cold Email

1. Click **Recruiters** in the navbar — contacts (name, email, phone, LinkedIn) are extracted from your job descriptions
2. Click a contact to **draft an email** — the AI writes a tailored intro based on the job and your CV
3. Review it, then **Send** — the email goes out through **your own SMTP server** (configured in Settings → Integrations → Email)
4. Every card shows its status: **sent / failed**, with the timestamp

> 📬 **Privacy:** nothing is sent through third-party services — the app uses the SMTP account you bring (e.g., Gmail app password, Outlook, your own mail server). Set it up in **Settings → Integrations → Email** (auto-detects SSL/STARTTLS by port, with a one-click test).

---

### Step 7: Sign Out & Switch Accounts

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

You can edit this file directly or use the **Settings** UI in the app (Apify token and SMTP credentials are configured in Settings → Integrations).

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Phosphor + Lucide icons, driver.js (onboarding) |
| **Backend** | Express 4, TypeScript, tsx |
| **LLM Integration** | OpenAI-compatible providers (OpenCode Go, OpenRouter, OpenAI, Gemini, Anthropic, NVIDIA) |
| **Scraping** | Native `fetch`, cheerio, Apify REST API (LinkedIn, Indeed, Naukri, Glassdoor, Upwork) |
| **Storage** | SQLite (`better-sqlite3`, WAL) — users, sessions, jobs, master CVs |
| **Auth** | Local accounts — scrypt password hashing, httpOnly cookie sessions |
| **Email** | nodemailer — AI-drafted cold emails via your own SMTP |
| **Documents** | pdfkit (PDF), mammoth + pdf-parse (DOCX/PDF CV import) |
| **Build** | Vite, esbuild |
| **CI/CD** | GitHub Actions — gitleaks, npm audit, Trivy, auto-release to GitHub Releases + GHCR |

---

## 📄 License

MIT

---

<p align="center">
  Built with ❤️ for developers who hate manual job applications.
</p>

---

## ⚖️ Legal & Terms of Use

**Read this before using or contributing.**

- **Purpose:** This tool is built for **personal, local use** — it runs on your own machine and your scraped data stays on your machine. It is **not** a cloud service and does **not** ship or redistribute scraped data.
- **Scraping & Terms of Service:** The tool retrieves publicly visible job listings from websites that are often third-party services (e.g. LinkedIn). Such retrieval is **automated access** and may violate the target site's Terms of Service. **You are responsible for your own use** — ensure the sites you scrape permit it (check each site's robots.txt and Terms) and that you comply with all applicable laws (including privacy laws such as the EU GDPR and India's DPDP Act 2023).
- **Good-faith safeguards built in:** the tool respects `robots.txt` (sources that disallow crawling are skipped), throttles requests with delays, and **strips personal contact data** (emails, phone numbers, recruiter contacts) from stored listings.
- **No affiliation:** This project is not affiliated with, endorsed by, or connected to LinkedIn, Indeed, Arbeitnow, or any other job board.
- **No warranty:** Provided "as is" without warranty of any kind. The author is not liable for how you use this software or for any consequences of scraping.
- **Removal requests:** If you are a site owner and believe this tool is being used against your site in a way you do not permit, please open an issue — we will act promptly.
