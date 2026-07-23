# Open ATS CV Tailor

> **⚠️ Legal Disclaimer**
> This is an open-source, educational utility designed for personal productivity and job application tailoring.
> - **Local Operation Only:** This tool runs entirely on your local machine. It does not collect, store, or transmit your personal data or scraped data to any third-party servers.
> - **Public Data Only:** The tool only accesses publicly available data that is visible without authentication. It does not attempt to bypass security controls, firewalls, or user login screens.
> - **Independent Project:** This project is independent and is not affiliated with, authorized, maintained, or endorsed by LinkedIn, Adzuna, or any other data source. Users assume all responsibility and risk regarding the compliance of their usage with third-party Terms of Service.

ATS-optimized job matching and CV tailoring tool. Scrapes job listings from public sources, matches them against your profile, and generates tailored CVs in DOCX/PDF format.

## Features

- **Job Search** — Search and scrape live job listings from public sources
- **ATS Matching** — Score jobs against your CV using AI
- **CV Tailoring** — Generate ATS-optimized CVs tailored to specific job descriptions
- **Multi-format Export** — Download tailored CVs as DOCX, PDF, or plain text

## Quick Start

```bash
npm install
# Set your LLM provider API key (see below)
npm run dev
```

Open http://localhost:3000

## LLM Providers

Bring your own API key. Supported providers:

| Provider | Models |
|----------|--------|
| OpenCode Go | DeepSeek V4, Kimi, Qwen, Grok 4.5, etc. |
| OpenRouter | 200+ models |
| OpenAI | GPT-4o, GPT-4o-mini |
| Google Gemini | Gemini 3.6 Flash, 2.5 Pro |
| Anthropic | Claude Sonnet 4, Haiku |
| NVIDIA (Free Tier) | DeepSeek V4, Llama 3.3, Mistral |

Configure in Settings → LLM Provider.

## Tech Stack

- **Frontend:** React 19, Tailwind CSS v4, Lucide icons
- **Backend:** Express 4, TypeScript
- **Storage:** JSON file-based
- **Scraping:** Native fetch + cheerio
- **Documents:** docx, pdfkit

## License

MIT
