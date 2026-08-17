# Local Setup — A to Z

Everything you need to run Tailor CV on your own machine, from an empty
folder to a fully working app.

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 20 | `node -v` |
| [npm](https://www.npmjs.com) | ≥ 10 | `npm -v` |
| [Docker](https://www.docker.com) + Compose | latest | `docker compose version` |
| [Git](https://git-scm.com) | any | `git --version` |

## Step 1 — Get the code

```bash
git clone https://github.com/Atanub707/Tailor-AI.git
cd Tailor-AI
```

## Step 2 — Install dependencies

```bash
npm install
```

## Step 3 — Configure tokens (one-time)

See **[docs/TOKENS.md](TOKENS.md)** for full instructions. Summary:

1. **LLM API key** (required) — Settings → LLM Provider, or edit `config.ini`:

   ```ini
   [llm]
   provider=opencode-go
   apiKey=sk-…                    # ← paste your key
   baseUrl=https://opencode.ai/zen/go/v1
   model=deepseek-v4-flash
   ```

2. **Apify token** (recommended for LinkedIn) — Settings → Apify, or:

   ```ini
   [apify]
   token=apify_api_…              # ← paste your token
   enabled=true
   ```

> `config.ini` is gitignored by design. If you edit it by hand, save it
> before starting the server — the app re-reads it on every request.

## Step 4 — Run it

### Option A — Docker (recommended)

```bash
docker-compose build
docker-compose up -d
```

The app is at **http://localhost:3000**. Logs: `docker-compose logs -f`.

### Option B — Local dev (faster iterations)

```bash
npm run dev
```

Same address: **http://localhost:3000** (Vite + Express together).

## Step 5 — Sign in and do your first search

1. Open http://localhost:3000 — you'll land on the login screen.
2. Create an account (email/password works fully offline; Google is
   available too).
3. On the home screen, search e.g. `DevOps Engineer`, pick a location,
   hit **Search Jobs**.
4. Jobs stream in with AI match scores.

## What you can do next

| Feature | Where |
|---|---|
| Score & tailor any job to your CV | Job card → **Re-Score** / **Re-Tailor** → **Download CV** |
| Master CV (your canonical resume) | Top-right menu → **Master Candidate CV** |
| Paste any JD without scraping | Top-right menu → **Manual JD ⌘J** (Analyze → Tailor CV → Download) |
| Job portals directory | Top bar → **Job Portals** |
| Tokens & scraper behavior | Top-right menu → **Settings ⌘,** |

## Useful commands

```bash
npm run dev        # dev server (tsx + vite)
npm run build      # production build (client + server bundle)
npm start          # run the built server (dist/server.cjs)
npm run lint       # TypeScript check only
docker-compose logs -f ats-cv-tailor   # follow logs in Docker
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Server running` but page won't load | Port 3000 busy → stop the other process, or change the port in `docker-compose.yml` / Vite config |
| "No LLM API key configured" | Add the LLM key (Step 3) and restart the server |
| Searches return no jobs | Check the network tab; try a different source (LinkedIn often needs the Apify token) |
| Downloads open an empty PDF | The server-side PDF generator needs `pdfkit` — `npm install` again and restart |
| Docker volume keeps old data | `docker-compose down` then `up -d` (data lives in `./data/ats_jobs.sqlite`) |
| Ports: DB file location | SQLite data: `./data/ats_jobs.sqlite` (mounted from the project) |

## Where is my data?

| What | Where |
|---|---|
| Jobs + scores + users | `./data/ats_jobs.sqlite` |
| Jobs backup (JSON) | `./data/jobs_backup.json` |
| Master CV | `./data/master_cv.json` |
| Tokens / config | `./config.ini` |

Backing up = copying these four files.
