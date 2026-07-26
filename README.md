<div align="center">
  <img src="https://github.com/Atanub707/ATS-FREE-CVs/raw/main/media/hero.svg?raw=true" width="100%" alt="ATS CV Tailor"/>
</div>

<p align="center">
  <strong>Multi-source job scraper · AI-powered ATS matching · CV tailoring — all running locally.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License MIT"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"/>
</p>

---

## Demo

<p align="center">
  <img src="https://raw.githubusercontent.com/Atanub707/ATS-FREE-CVs/main/media/screenshot.png" width="80%" alt="ATS CV Tailor Dashboard"/>
</p>

## Features

<table>
  <tr>
    <td width="50%">
      <h3>🔍 Multi-Source Job Search</h3>
      Search and scrape job listings from 8+ sources — LinkedIn, Arbeitnow, SimplyHired, Dice, Reed, JapanDev, Greenhouse, and Lever — all through a unified interface.
    </td>
    <td width="50%">
      <h3>📊 AI ATS Scoring</h3>
      Score jobs against your master CV using AI. Get match percentages, skill gap analysis, missing keywords, and actionable recommendations.
    </td>
  </tr>
  <tr>
    <td>
      <h3>✂️ CV Tailoring</h3>
      Generate ATS-optimized CVs tailored to specific job descriptions. Export as <code>.docx</code>, <code>.pdf</code>, or <code>.txt</code>.
    </td>
    <td>
      <h3>🏢 Company Portal Integration</h3>
      Fetch jobs directly from company career pages via Greenhouse and Lever APIs — no scraping needed, just structured data.
    </td>
  </tr>
  <tr>
    <td>
      <h3>🎯 Smart Filtering</h3>
      Filter by date posted, experience level (entry/mid/senior/lead), source, and keyword search across all scraped jobs.
    </td>
    <td>
      <h3>🔒 Local & Private</h3>
      Runs entirely on your machine. Your CV data never leaves your computer. Choose your own LLM provider and keep full control.
    </td>
  </tr>
</table>

## Job Sources

| Source | Region | Method | API Key? |
|--------|--------|--------|----------|
| **LinkedIn** | Global | Guest API | No |
| **Arbeitnow** | Germany/Europe | Free REST API | No |
| **SimplyHired** | Global | HTML parsing | No |
| **Dice** | US/Global | JSON-LD extraction | No |
| **Reed** | UK | Next.js SSR | No |
| **JapanDev** | Japan | JSON-LD extraction | No |
| **Greenhouse** | Global (company portals) | REST API | No |
| **Lever** | Global (company portals) | REST API | No |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (tested with 22+)
- An LLM API key (for ATS scoring and CV tailoring)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/ats-cv-tailor.git
cd ats-cv-tailor

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Set up your LLM

1. Click **Settings** (gear icon) in the top-right corner
2. Select your **LLM Provider** (OpenAI, Gemini, Anthropic, OpenRouter, etc.)
3. Enter your **API key**
4. Click **Apply Config**

**Recommended providers (free/affordable):**

| Provider | Free Tier? | Setup |
|----------|-----------|-------|
| **Google Gemini** | ✅ Free quota | [Get API key](https://aistudio.google.com/apikey) |
| **NVIDIA (Free Tier)** | ✅ Free | Pre-configured, select `NVIDIA` in settings |
| **OpenCode Go** | Pay-as-you-go | [Get API key](https://opencode.ai) |
| **OpenAI** | ❌ Paid | [Get API key](https://platform.openai.com/api-keys) |

## Usage

### 1. Search Jobs
1. Select your sources (LinkedIn, Dice, Arbeitnow, etc.)
2. Enter a job title/keyword and optional location
3. Set date filter and experience level
4. Click **Search Jobs**

### 2. Score Jobs
1. First, set up your **Master Candidate CV** (click the top-left button)
2. Click **Score** on any job to run AI ATS matching
3. View match percentage, matching/missing skills, and recommendations

### 3. Tailor CVs
1. Click **Tailor** on a scored job
2. The AI generates an ATS-optimized CV
3. Download as **DOCX**, **PDF**, or **TXT**

### 4. Company Portal Search
1. Select **Greenhouse** or **Lever** as source
2. Type the role you're looking for (e.g., "engineer")
3. Hit **Search Jobs** — finds matching jobs from all companies on that platform

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                   │
│  ScraperBar · JobMatrix · JobDetail · Settings   │
└──────────────────────┬──────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────┐
│                Express Backend                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Scrapers │  │  LLM AI   │  │ CV Builders  │  │
│  │ (8 srcs) │  │  Matcher  │  │ (docx/pdf)   │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                 Storage (JSON)                    │
│           jobs.json · master_cv.json              │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide React |
| **Backend** | Express 4, TypeScript, tsx |
| **LLM Integration** | Google Gemini AI SDK, OpenAI-compatible API |
| **Scraping** | Native `fetch`, cheerio |
| **Document Export** | docx (Word), pdfkit (PDF) |
| **Build** | Vite, esbuild |

## Configuration

All configuration lives in `config.ini`:

```ini
[llm]
provider=gemini
apiKey=your_key_here
model=gemini-3.6-flash
temperature=0.2

[thresholds]
minMatchForTailor=40
earlyBlockThreshold=30
```

You can also configure via the **Settings** UI in the app.

## Development

```bash
# Start dev server with hot reload
npm run dev

# Type-check
npm run lint

# Build for production
npm run build
```

## License

MIT

---

<p align="center">
  Built with ❤️ for developers who hate manual job applications.
</p>
