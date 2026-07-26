<p align="center">
  <img src="https://github.com/Atanub707/ATS-FREE-CVs/raw/main/media/screenshot.png" width="100%" alt="ATS CV Tailor"/>
</p>

<p align="center">
  <strong>Multi-source job scraper · AI-powered ATS matching · CV tailoring — all running locally.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind-4.x-06D6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License MIT"/>
</p>

## Features

- **Multi-Source Job Search** — 8 sources: LinkedIn, Arbeitnow, SimplyHired, Dice, Reed, JapanDev, Greenhouse, Lever
- **AI ATS Scoring** — Score jobs against your CV using AI, get skill gap analysis
- **CV Tailoring** — Generate ATS-optimized CVs in DOCX, PDF, or TXT
- **Company Portal Integration** — Fetch jobs directly from company career pages via Greenhouse and Lever APIs
- **Smart Filtering** — Filter by date, experience level, source, and keyword
- **Local & Private** — Runs entirely on your machine, your data never leaves

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Set your LLM API key in **Settings → LLM Provider** (supports OpenAI, Gemini, Anthropic, OpenRouter, NVIDIA).

## Job Sources

| Source | Region | API Key? |
|--------|--------|----------|
| LinkedIn | Global | No |
| Arbeitnow | Germany/Europe | No |
| SimplyHired | Global | No |
| Dice | US/Global | No |
| Reed | UK | No |
| JapanDev | Japan | No |
| Greenhouse | Global (company portals) | No |
| Lever | Global (company portals) | No |

## Tech Stack

**Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide  
**Backend:** Express 4, TypeScript  
**LLM:** Google Gemini, OpenAI, Anthropic, OpenRouter, NVIDIA  
**Storage:** JSON file-based  
**Documents:** docx, pdfkit

## License

MIT
