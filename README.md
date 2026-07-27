

## Quick Setup (No Terminal Skills Needed)

**Mac / Linux:** Open Terminal, paste this and press Enter:

```bash
curl -sL https://github.com/Atanub707/ATS-FREE-CVs/raw/main/setup.sh | bash
```

**Windows:** Download `setup.bat` from the repo, double-click it.

The script installs everything and asks for your API key. After it finishes, run:

```bash
cd ATS-FREE-CVs && npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

<h1 align="center">ATS CV Tailor</h1>

<p align="center">
  <strong>Multi-source job scraper · AI-powered ATS matching · CV tailoring — all running locally.</strong>
</p>

<p align="center">
  <img src="https://github.com/Atanub707/ATS-FREE-CVs/raw/main/media/screenshot.png" width="100%" alt="ATS CV Tailor"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind-4.x-06D6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT"/>
</p>

---

## Overview

ATS CV Tailor scrapes job listings from 7+ public sources, scores them against your CV using AI, and generates tailored ATS-optimized CVs. Everything runs locally on your machine.

## Quick Start

### Prerequisites

- **Node.js** 18+ (tested with 22+)
- An **API key** from a supported LLM provider (for ATS scoring and CV tailoring)

### Install

```bash
git clone https://github.com/Atanub707/ATS-FREE-CVs.git
cd ATS-FREE-CVs
npm install
```

### Set Up Your LLM API Key

> 🔑 **Bring Your Own Key** — no bundled API keys. You sign up with a provider and get your own.

This app uses a **"bring your own key"** model — you need an API key from one of the supported providers. The key is stored locally in `config.ini` and never leaves your machine.

**Option A — Use the Settings UI:**

1. Start the app: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Click **Settings** (gear icon, top-right)
4. Select your provider and enter your API key
5. Click **Apply Config**

**Option B — Use `config.ini` directly:**

Open `config.ini` in the project root and set:

```ini
[llm]
provider=gemini
apiKey=your_api_key_here
model=gemini-3.6-flash
temperature=0.2
```

### Start the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supported LLM Providers

> 🔑 **Bring Your Own Key** — sign up with any provider below and use your own API key. The app stores it locally and never shares it.

| Provider | Free Tier? | How to Get a Key |
|---|---|---|
| **Google Gemini** | ✅ Free (via Google) | Sign up at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free quota included |
| **NVIDIA (Free Tier)** | ✅ Free, no key needed | Select `NVIDIA` in Settings — uses NVIDIA's free public endpoint |
| **OpenAI** | ❌ Paid | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | ❌ Paid | [console.anthropic.com](https://console.anthropic.com) |
| **OpenRouter** | ❌ Paid | [openrouter.ai/keys](https://openrouter.ai/keys) (access to 200+ models) |

> **All API keys are your own.** You sign up with the provider directly and get your own key. The app never shares or transmits your key anywhere — it's stored locally in `config.ini`. NVIDIA is the only exception — no key needed, just select it as your provider.

---

## How to Use

### Step 1: Set Up Your CV

Click **Master Candidate CV** (top-left) and fill in:
- Your professional summary
- Work experience (titles, companies, dates, responsibilities)
- Skills (categorized)
- Education
- Certifications & projects

This is the baseline CV that jobs will be scored and tailored against.

### Step 2: Search for Jobs

1. Enter a **job title or keywords** (e.g. "DevOps Engineer")
2. Optionally enter a **location** (e.g. "Remote", "London")
3. Select your **sources** from the available options:

| Source | Best For | Notes |
|---|---|---|
| **LinkedIn** | Global listings | Largest source |
| **Arbeitnow** | Germany/Europe | Free API |
| **SimplyHired** | Global | Good coverage |
| **Dice** | US tech jobs | Use "Anytime" for date filter |
| **Reed** | UK jobs | Use "Anytime" for date filter |
| **Greenhouse** | Direct from company career portals | Stripe, Airbnb, Shopify, etc. |
| **Lever** | Direct from company career portals | Notion, Vercel, Figma, etc. |

4. Set **Posted** filter (Dice and Reed show older postings — use "Anytime")
5. Set **Level** filter (Junior / Mid / Senior / Lead)
6. Click **Search Jobs**

### Step 3: Score Jobs

1. Click **Score** on any job
2. The AI analyzes your CV against the job description
3. You get:
   - **Match score** (0-100%)
   - **Matching skills** — what you have
   - **Missing skills** — what to highlight
   - **Missing keywords** — what to add
   - **Recommendations** — actionable steps

### Step 4: Tailor Your CV

1. Click **Tailor** on a scored job
2. The AI rewrites your CV to target that specific job
3. Download the tailored CV as:
   - **DOCX** (Word — best for ATS systems)
   - **PDF**
   - **TXT** (plain text)

Batch options are available: **"Score Pending"** and **"Tailor Matched"** buttons process multiple jobs at once.

### Step 5: Company Portal (Direct API)

Select **Greenhouse** or **Lever** as your source and type a job title — it searches across all companies on that platform. No company name needed, just the role.

---

## Job Sources Detail

| Source | Method | Region | API Key Needed |
|---|---|---|---|
| LinkedIn | Guest API | Global | No |
| Arbeitnow | Free REST API | Germany/Europe | No |
| SimplyHired | HTML parsing | Global | No |
| Dice | HTML + JSON-LD | US/Global | No |
| Reed | Next.js SSR | UK | No |
| Greenhouse | REST API | Global | No |
| Lever | REST API | Global | No |

---

## Configuration

All settings are stored in `config.ini` in the project root:

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
```

You can edit this file directly or use the **Settings** UI in the app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide icons |
| **Backend** | Express 4, TypeScript, tsx |
| **LLM** | Google Gemini AI SDK, OpenAI-compatible API |
| **Scraping** | Native `fetch`, cheerio |
| **Documents** | docx (Word), pdfkit (PDF) |
| **Build** | Vite, esbuild |
| **Storage** | JSON files |

---

## License

MIT
