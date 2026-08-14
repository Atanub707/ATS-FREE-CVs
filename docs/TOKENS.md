# Tokens & API Keys

Tailor CV has **two** token slots. All tokens are stored **locally** in
`config.ini` — a gitignored file that is never committed or sent anywhere
except to the service itself.

| Slot | Where to enter it | Required? | Used for |
|---|---|---|---|
| LLM API key | Settings → LLM Provider (Bring Your Own Key) | ✅ Yes | AI job scoring, CV analysis & tailoring |
| Apify token | Settings → Apify — Reliable LinkedIn Source | ⚠️ Recommended | Unblocked LinkedIn scraping (falls back to free scraper) |

> **Security:** treat every token like a password. `config.ini` is
> gitignored and mounted into Docker — it never leaves your machine
> except to the service the token belongs to.

---

## 1. LLM API key

This is the brain of the app: job matching, JD analysis and CV tailoring
all run through it.

### Which providers are supported

| Provider | Where to get the key |
|---|---|
| **OpenCode Go** (default) | https://opencode.ai — create an account → API keys. Base URL is pre-filled: `https://opencode.ai/zen/go/v1` |
| **OpenRouter** | https://openrouter.ai/keys — click "Create Key" |
| **OpenAI** | https://platform.openai.com/api-keys — "Create new secret key" |
| **Google Gemini** | https://aistudio.google.com/apikey — "Create API key" |
| **Anthropic** | https://console.anthropic.com/settings/keys — "Create key" |
| **NVIDIA (free tier)** | https://build.nvidia.com — sign in → "Get API Key" (starts with `nvapi-`) |

### Steps

1. Open the app → **Settings** (top-right menu, ⌘,).
2. Under **LLM Provider (Bring Your Own Key)**, choose your **Provider**.
3. Paste the key into **API Key**.
4. The **Base URL** is filled automatically per provider — only change it
   if you use a custom/self-hosted OpenAI-compatible endpoint.
5. Pick a **Model** (or type a custom one).
6. Click **Apply Config**.

The key is written to the `[llm]` section of `config.ini`. Leave the field
blank to fall back to the `GEMINI_API_KEY` environment variable.

### What each provider's key looks like

```
OpenCode Go    sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OpenRouter     sk-or-v1-XXXXXXXXXXXXXXXXXXXXXXXXXXXX
OpenAI         sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXX
Gemini         AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Anthropic      sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXX
NVIDIA         nvapi-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 2. Apify token

Apify makes LinkedIn scraping reliable (no "No results found" blocks) and
returns the true work mode for every job. The free tier includes **$5 of
monthly credit** — the scraper is paid per event from that credit.

### Steps

1. Go to [console.apify.com](https://console.apify.com/sign-up?fpr=xu9hcp) and sign up (or sign in).
2. Open **Settings → Integrations** (bottom-left of the console).
3. Click **API token** and copy it (it starts with `apify_api_`).
4. Open the app → **Settings** → **Apify — Reliable LinkedIn Source**.
5. Paste the token, switch **Use Apify for LinkedIn** to ON.
6. Click **Apply Config**.

If the token is missing or expires, the app **automatically falls back**
to the built-in free scraper — searches keep working.

> 💡 New to Apify? Signing up via the link above supports development —
> the price is exactly the same for you.

---

## Where tokens live

```
config.ini                    ← gitignored, never committed
├── [llm]     apiKey=…        ← LLM key
└── [apify]   token=…         ← Apify token
```

You can edit `config.ini` directly instead of the Settings UI — the app
re-reads it on every request. Keep the file on the same path the server
runs from (project root, or `/app/config.ini` inside Docker).

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No LLM API key configured" | Settings → LLM Provider → paste key → Apply Config |
| Scores stuck / "LLM error" | Verify key + Base URL; try another model |
| LinkedIn returns "No results found" | Add the Apify token (Section 2) |
