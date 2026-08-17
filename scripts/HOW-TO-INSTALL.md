# Tailor CV — Installer Guide (macOS & Windows)

Everything you need to install, update, and remove **Tailor CV** on your machine.
No code-signing, no security warnings, no developer skills required.

---

## 📖 The concept (read this first — it explains everything)

**Tailor CV is a web app that runs inside Docker.** You don't install an `.exe` or
`.app` file — instead, the installer sets up **Docker Desktop** (the official, free,
industry-standard tool from Docker Inc), and Tailor CV runs inside it.

**Why no warnings?**
- Windows/macOS show scary "unknown publisher" warnings for unsigned apps.
- Because you run **Docker Desktop** (which IS officially signed and trusted),
  your machine never sees an unsigned binary — so **no warnings, ever**.

**What "installing" means here:** the installer does 4 things, in order:

| Step | What happens |
|---|---|
| 1 | Checks for Docker → installs **Docker Desktop** if missing (official installer) |
| 2 | Starts the Docker engine and **waits until it's ready** |
| 3 | Downloads Tailor CV (from GitHub) into `~/tailor-cv` |
| 4 | Starts the app and opens your browser at `http://localhost:3000` |

Everything is **safe to re-run** — if a step already finished, it's skipped.

**Requirements:** macOS 12+ or Windows 10 (1809+) / Windows 11 · ~3 GB free disk ·
internet connection. Everything runs locally — your data never leaves your machine.

---

## 🍎 macOS — install (2 minutes)

**Option A — one line in Terminal (recommended):**

```bash
curl -fsSL https://github.com/Atanub707/Tailor-AI/raw/main/scripts/install.sh | bash
```

**Option B — manual:** download `install.sh` from GitHub, then in Terminal:

```bash
chmod +x install.sh
./install.sh
```

**What you'll see:** green `✔` lines as each step finishes, then your browser opens
Tailor CV. First run may take a few minutes (Docker Desktop installs + engine starts).

> If Homebrew isn't installed, the script installs it first (one prompt, no password).

---

## 🪟 Windows — install (2 minutes, no technical knowledge needed)

**Fastest way — copy & paste into PowerShell (no downloads, no SmartScreen):**

1. Press **Win + X** → click **"Terminal"** or **"Windows PowerShell"**
2. **Copy this one line**, right-click in the window to paste, press **Enter**:

```powershell
irm https://raw.githubusercontent.com/Atanub707/Tailor-AI/main/scripts/install.ps1 | iex
```

3. Let it run — it installs Docker Desktop (one **Yes** prompt), starts it, waits for
   the engine, downloads Tailor CV, and opens the app in your browser.

> If you get a wall of errors like `The 'var' keyword is not supported...` or
> `function redirect(...)` — that means the download returned an **HTML error page**
> instead of the installer (usually because the repository is private or the network
> blocked the direct download). Fix: make sure the repo is **Public**, or use this
> **resilient version** which verifies the download and retries via the GitHub API:

```powershell
$u='https://raw.githubusercontent.com/Atanub707/Tailor-AI/main/scripts/install.ps1'; $p="$env:TEMP	ailorcv.ps1"; try { irm $u -OutFile $p -ErrorAction Stop } catch {}; $c = Get-Content $p -Raw -ErrorAction SilentlyContinue; if ($c -match 'ErrorActionPreference|Tailor CV') { iex $c } else { Write-Host 'Direct download blocked - fetching via API...'; $j = irm -Headers @{'User-Agent'='TailorCV'} 'https://api.github.com/repos/Atanub707/Tailor-AI/contents/scripts/install.ps1'; iex ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($j.content))) }
```

> This is the same trusted pattern used by Scoop, Chocolatey and many open-source tools —
> no files saved, no "unknown publisher" warnings, nothing to allow.

**Step 1 — get the installer file:**

- Open the repository: **https://github.com/Atanub707/Tailor-AI**
- Click the green **Code** button → **Download ZIP**
- Open the downloaded ZIP and **extract it** anywhere (right-click → *Extract All…*) — e.g. into a folder on your Desktop

**Step 2 — run it:**

- Open the extracted folder → open the **`scripts`** folder
- **Double-click `install.bat`**
- If Windows shows *"Windows protected your PC"*: click **More info** → **Run anyway** (this is normal for any new free software — the file is checked by Windows and safe)
- Click **Yes** on the one UAC prompt
- Watch the colored progress lines — when done, **your browser opens Tailor CV automatically**

> The installer does everything itself: installs Docker Desktop (like installing any app),
> starts it, downloads Tailor CV, and opens the app. You never touch a terminal.

**First time on a brand-new PC only:** Windows may ask to install **WSL2** (a small Windows
component Docker needs). The installer does it automatically, then asks you to
**restart your PC once** and **double-click `install.bat` again** — it continues from where
it stopped and finishes in about a minute.

**If double-clicking doesn't do anything:** the file may have downloaded with a `.txt`
ending — rename it to `install.bat` (File Explorer → *View* → tick *File name extensions*),
then double-click again.

---

## ▶️ Using Tailor CV

- **Open it anytime:** [http://localhost:3000](http://localhost:3000)
- **First sign-in:** Create an account (email+password) or **Continue as guest**
- **Set your AI key (required for scoring):** top-right menu → **Settings → Integrations →
  LLM & AI** → paste your key (OpenCode Go / Gemini / OpenAI / Anthropic / OpenRouter /
  NVIDIA). Your key stays on your machine.
- **Scrape jobs:** Search bar → type a role → **Search Jobs**
- **Practice interviews:** top bar → **AI Interview** → pick a role → **Begin interview**

---

## 🔄 Updating Tailor CV

New versions arrive regularly — update in **one command** (your data — jobs, CV,
tokens, history — is never touched):

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Atanub707/Tailor-AI/main/scripts/update.ps1 | iex
```

**macOS / Linux (Terminal):**
```bash
curl -fsSL https://github.com/Atanub707/Tailor-AI/raw/main/scripts/update.sh | bash
```

**If you already installed and run the installer again**, it tells you the app is
running — that's normal. Use the update command above instead.

> **Tip:** if you saved tokens before and they disappeared after a reload, your
> install hit an old Docker quirk where `config.ini` became an empty folder.
> This update fixes it automatically — save your settings once more and they'll stick.

---

## 🗑️ Uninstalling

Stops the app and removes all Tailor CV files (your data folder is removed too —
export anything you need first). Docker Desktop itself stays installed.

**macOS / Linux:**
```bash
curl -fsSL https://github.com/Atanub707/Tailor-AI/raw/main/scripts/uninstall.sh | bash
```

**Windows:** download `uninstall.bat`, double-click it.

---

## 🛠️ Troubleshooting

| Symptom | Fix |
|---|---|
| *"The Docker engine did not start"* | Open **Docker Desktop** once, wait for the whale icon to stop animating, then re-run the installer |
| *Port 3000 already in use* | Something else is on port 3000. Stop that program, or run Tailor CV on another port (edit `docker-compose.yml`: `"3000:3000"` → `"3001:3000"`, then `docker compose up -d`) |
| *Windows asks to restart for WSL2* | Normal on fresh PCs. Restart, then double-click `install.bat` again — it continues from step 2 |
| *"Homebrew not found" on Mac* | The script installs it automatically; if it fails, install manually: `brew install --cask docker` |
| *App won't open after update* | Run the installer again — it's safe and skips finished steps |
| *I want the app to stop* | `docker compose -f ~/tailor-cv/docker-compose.yml down` (Mac) — Windows: ask the installer's tip line |

---

## ❓ FAQ

**Is my data private?** Yes — everything (jobs, CV, keys) lives on your machine.
Tailor CV never sends your data anywhere except to the AI provider you chose with
**your own key**.

**Do I need a credit card?** No. Docker Desktop is free for personal use, Tailor CV
is free and open-source (MIT).

**Why not just a normal app installer?** Native installers need paid code-signing
certificates (~$100–400/year) to avoid scary warnings. The Docker approach gives you
a **warning-free install for $0** — the trade-off is Docker Desktop itself (~1 GB).

**Which LLM key should I get?** Any of the six supported providers. OpenCode Go is
pre-selected and quick to set up; Gemini has a generous free tier.

**Can I move it to another computer?** Yes — run the installer there, then restore
your `data` folder (it contains everything).
