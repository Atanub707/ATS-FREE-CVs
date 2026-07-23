# ATS Job Search & CV Tailor

ATS-optimized job matching and CV tailoring tool. Scrapes LinkedIn jobs, matches them against your profile, and generates tailored CVs in DOCX/PDF format.

## Features

- **LinkedIn Job Scraping** — Search and scrape live LinkedIn job listings
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
