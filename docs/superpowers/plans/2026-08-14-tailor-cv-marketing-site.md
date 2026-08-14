# Tailor CV Marketing Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A professional, minimal, conversion-focused marketing website for the Tailor CV product, built inside the repo at `ATS-Tailor-Marketing/` as a static site (no build step — deployable anywhere).

**Architecture:** Single-page static site: `ATS-Tailor-Marketing/index.html` + `assets/styles.css` + `assets/app.js` (vanilla, tiny). No frameworks, no bundler — consistent with the repo's mockup pattern and the "minimal, fast, easy" brief. Brand-consistent with the product (brand blue `#2563EB`, whitish canvas `#F9FAFB`, multi-tint accents, Plus Jakarta Sans — matching the ui-ux-pro-max design-system recommendation AND the app itself).

**Audit — what the product actually does (ground truth for copy):**
- **Search:** 17 job sources (LinkedIn, Indeed, Naukri, Glassdoor, Upwork via Apify + 12 free built-ins: Arbeitnow, SimplyHired, Dice, Reed, RemoteOK, WeWorkRemotely, MyCareersFuture, Cutshort, Gupy, JobsCh, Daijob, MyJobMag) + a 190+ job-portal browser, applicant counts, smart filters
- **Score:** AI ATS scoring — match %, skill gaps, missing keywords, recommendations
- **Tailor:** one-click ATS-optimized CV per job; Master CV editor with live A4 preview, PDF/DOCX/TXT import, AI Compress against live market keywords
- **Manual JD:** paste any description → scored + tailored CV (⌘J), history restore
- **Recruiters & outreach:** recruiter contacts extracted from jobs, AI cold emails written from the full CV journey, send via your own SMTP, follow-ups, notes, email history
- **Profile:** account-level job preferences (work mode, locations, notice period, salary expectations, sponsorship) used by the AI
- **Privacy:** 100% local-first — SQLite, BYOK LLM keys (Gemini, OpenAI, Anthropic, OpenRouter, NVIDIA, OpenCode Go), nothing leaves the machine; Docker one-command install
- **Scale facts:** 19,000+ scraped jobs in the dev DB; processing is concurrent + non-blocking

**Market pain points the copy must speak to:**
1. ~75% of resumes are rejected by ATS before a human sees them (keyword mismatch)
2. Rewriting a CV for every application is hours of manual work
3. "Applied to 200 jobs, heard nothing" — untargeted, generic applications
4. Recruiters ask the same questions first: availability, work mode, salary fit
5. Cold outreach is tedious: finding the recruiter, writing a personal email
6. Cloud "CV tools" hold your data hostage; premium subscriptions are costly

**Positioning:** *Your private AI job-search copilot. Finds jobs, scores them against your CV, tailors every application — 100% on your machine.*

**Psychology principles applied (persuasion):**
- Pain-agitation-solution in hero + problem section (loss aversion: "your CV is being filtered out")
- Specificity = credibility (17 sources, 190+ portals, 4+ years, 80% reductions — real numbers, not "AI magic")
- Social proof pattern: hero + testimonial-style section + CTA (ui-ux-pro-max landing recommendation)
- Trust anchors: local-first, BYOK, "your data never leaves" — the #1 anxiety for job-seeker data
- One primary CTA repeated (Get Started), minimal secondary actions
- FAQ accordion to dissolve objections (ui-ux-pro-max FAQ pattern for SaaS)

**Design system (from ui-ux-pro-max `--design-system`):**
- Pattern: FAQ/Documentation landing hybrid + Hero/Testimonials/CTA
- Style: Minimalism & Swiss — spacious, high contrast, grid-based, functional
- Colors (kept = product brand, skill-compatible): primary `#2563EB`, bg `#F9FAFB`, surface `#FFFFFF`, ink `#0F172A`, muted `#475569`, accents: violet `#7C3AED`, emerald `#059669`, amber `#D97706`
- Type: Plus Jakarta Sans (matches skill recommendation + app)
- Effects: subtle hovers 200–250ms, no infinite animations, sharp minimal shadows
- Anti-patterns to avoid: no emoji icons (inline SVG/Lucide-style paths only), no hidden filters, no gimmicky motion, no stock-photo clichés

**Tech Stack:** HTML5, CSS (custom properties, no framework), vanilla JS (~50 lines: nav toggle, FAQ accordion, scroll reveal with `prefers-reduced-motion` guard). Optional inline SVG icons.

## Global Constraints

- Site lives in `ATS-Tailor-Marketing/` — no build step, opens directly in a browser (file:// or any static host)
- Copy must be 100% grounded in the audit above — no invented features, no invented numbers
- No emojis as icons; all interactive elements `cursor-pointer`; focus-visible states; `prefers-reduced-motion` respected; alt text on images
- Responsive at 375 / 768 / 1024 / 1440px with no horizontal scroll
- Text contrast ≥ 4.5:1 (WCAG AA); body text never below `#475569`
- Keep it SHORT: hero + 5 sections + footer. No feature-dump pages
- Final gate: Lighthouse audit (a11y ≥ 90, SEO ≥ 90, best-practices ≥ 90, mobile responsive), axe-clean, no console errors
- Commit per task; never push unless asked

---

### Task 1: Scaffold + design tokens + shell

**Files:**
- Create: `ATS-Tailor-Marketing/index.html`
- Create: `ATS-Tailor-Marketing/assets/styles.css`
- Create: `ATS-Tailor-Marketing/assets/app.js`

**Interfaces:**
- Consumes: nothing
- Produces: the document shell — `<head>` (meta, OG tags, title "Tailor CV — AI job search & ATS CV tailoring"), font links (Plus Jakarta Sans 400/500/600/700/800), CSS custom properties (tokens below), sticky floating nav (logo + links + "Get Started" button), mobile hamburger, and a skip-to-content link. All section containers as empty landmarks with ids (`#features`, `#how`, `#privacy`, `#faq`) for later tasks to fill.

- [ ] **Step 1: Create `assets/styles.css` tokens + base**

```css
:root{
  --bg:#F9FAFB; --surface:#FFFFFF; --line:#E2E8F0; --line2:#CBD5E1;
  --ink:#0F172A; --muted:#475569; --faint:#64748B;
  --brand:#2563EB; --brand-strong:#1D4ED8; --brand-soft:#EFF6FF; --brand-line:#BFDBFE;
  --cta:#059669; --cta-soft:#ECFDF5; --cta-line:#A7F3D0;
  --violet:#7C3AED; --violet-soft:#F5F3FF; --violet-line:#E9D5FF;
  --amber:#D97706; --amber-soft:#FFFBEB; --amber-line:#FDE68A;
  --shadow-sm:0 1px 3px rgba(15,23,42,.06); --shadow-md:0 10px 30px -12px rgba(15,23,42,.15);
  --radius:14px;
}
*{box-sizing:border-box; margin:0; padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--ink); -webkit-font-smoothing:antialiased; line-height:1.6;}
.container{max-width:1120px; margin:0 auto; padding:0 24px;}
.skip{position:absolute; left:-999px; top:0; background:var(--brand); color:#fff; padding:10px 16px; border-radius:0 0 10px 0; z-index:100;}
.skip:focus{left:0;}
a{color:var(--brand);}
button{cursor:pointer; font-family:inherit;}
img{max-width:100%; display:block;}
section{padding:88px 0;}
```

- [ ] **Step 2: Create `index.html` shell**

Structure (semantic landmarks, empty section bodies to be filled by Tasks 2–5):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tailor CV — AI Job Search & ATS CV Tailoring, 100% Local</title>
  <meta name="description" content="Tailor CV finds jobs from 17 sources, scores them against your CV with AI, and tailors every application — all on your machine. Bring your own API key. Nothing leaves your computer." />
  <meta property="og:title" content="Tailor CV" />
  <meta property="og:description" content="Your private AI job-search copilot — find, score, tailor, apply." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/styles.css" />
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <nav class="nav" aria-label="Main">
    <div class="container nav-in">
      <a class="brand" href="#top"><span class="brand-mark">T</span> Tailor CV</a>
      <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
      <div class="nav-links" id="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#privacy">Privacy</a>
        <a href="#faq">FAQ</a>
        <a class="btn btn-primary btn-sm" href="#cta">Get started</a>
      </div>
    </div>
  </nav>
  <main id="main">
    <section id="top" aria-label="Hero"></section>
    <section id="problem" aria-label="Problem"></section>
    <section id="features" aria-label="Features"></section>
    <section id="how" aria-label="How it works"></section>
    <section id="privacy" aria-label="Privacy"></section>
    <section id="faq" aria-label="FAQ"></section>
    <section id="cta" aria-label="Get started"></section>
  </main>
  <footer class="footer"></footer>
  <script src="assets/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `assets/app.js`**

```js
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); });
    });
  }
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('revealed'); });
  }
})();
```

CSS for nav + base components (btn, btn-primary, nav states, mobile menu, reveal):

```css
.nav{position:sticky; top:0; z-index:50; background:rgba(249,250,251,.9); backdrop-filter:blur(10px); border-bottom:1px solid var(--line);}
.nav-in{display:flex; align-items:center; justify-content:space-between; height:64px;}
.brand{display:flex; align-items:center; gap:10px; font-weight:800; font-size:16px; color:var(--ink); text-decoration:none; letter-spacing:-.01em;}
.brand-mark{width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,var(--brand),var(--brand-strong)); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px;}
.nav-links{display:flex; align-items:center; gap:26px;}
.nav-links a:not(.btn){font-size:13.5px; font-weight:600; color:var(--muted); text-decoration:none; transition:color .2s ease;}
.nav-links a:not(.btn):hover{color:var(--ink);}
.nav-links a:focus-visible,.btn:focus-visible{outline:2px solid var(--brand); outline-offset:3px; border-radius:6px;}
.btn{display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:10px; font-weight:700; text-decoration:none; transition:all .2s ease;}
.btn-primary{background:linear-gradient(135deg,var(--brand),var(--brand-strong)); color:#fff; border:1px solid transparent; box-shadow:0 2px 6px rgba(37,99,235,.3);}
.btn-primary:hover{filter:brightness(1.07);}
.btn-ghost{border:1.5px solid var(--line2); color:var(--ink); background:var(--surface);}
.btn-ghost:hover{border-color:var(--brand-line); color:var(--brand);}
.btn-lg{padding:14px 26px; font-size:15px;}
.btn-sm{padding:8px 16px; font-size:13px;}
.nav-toggle{display:none; background:none; border:0; padding:8px; gap:5px; flex-direction:column;}
.nav-toggle span{width:20px; height:2px; background:var(--ink); border-radius:2px;}
.reveal{opacity:0; transform:translateY(14px); transition:opacity .5s ease, transform .5s ease;}
.reveal.revealed{opacity:1; transform:none;}
@media (max-width:768px){
  .nav-toggle{display:flex;}
  .nav-links{display:none; position:absolute; top:64px; left:0; right:0; background:var(--surface); border-bottom:1px solid var(--line); flex-direction:column; gap:0; padding:10px 24px 18px; align-items:flex-start;}
  .nav-links.open{display:flex;}
  .nav-links a{padding:11px 0; width:100%;}
}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto;}
  .reveal{opacity:1; transform:none; transition:none;}
}
```

- [ ] **Step 4: Verify shell**

Open `ATS-Tailor-Marketing/index.html` in the browser — nav renders, hamburger toggles at 375px, links navigate to empty sections, no console errors. Commit: `git add ATS-Tailor-Marketing && git commit -m "site: marketing site scaffold — tokens, nav, shell"`

---

### Task 2: Hero + problem/solution

**Files:**
- Modify: `ATS-Tailor-Marketing/index.html` (fill `#top` and `#problem`)
- Modify: `ATS-Tailor-Marketing/assets/styles.css`

**Interfaces:**
- Consumes: shell from Task 1
- Produces: hero (headline, subhead, dual CTA, product screenshot with tinted browser frame) + problem section (3 pain cards → solution line)

- [ ] **Step 1: Hero markup (copy is psychological: pain → promise → proof)**

```html
<section id="top" class="hero">
  <div class="container">
    <div class="hero-badge reveal"><span class="dot"></span> 100% local · Bring your own AI key</div>
    <h1 class="reveal">Your CV is being filtered out.<br /><span class="grad">Stop sending the same one.</span></h1>
    <p class="hero-sub reveal">Tailor CV finds jobs from 17 sources, scores them against your real CV with AI, and rewrites every application to match — so your profile gets past the bots and in front of humans.</p>
    <div class="hero-cta reveal">
      <a class="btn btn-primary btn-lg" href="#cta">Get started — it's free</a>
      <a class="btn btn-ghost btn-lg" href="#how">See how it works</a>
    </div>
    <p class="hero-note reveal">Self-hosted · Docker in one command · Your data never leaves your machine</p>
    <div class="hero-shot reveal">
      <div class="shot-frame">
        <div class="shot-bar"><span></span><span></span><span></span><b>Tailor CV — Dashboard</b></div>
        <div class="shot-body">
          <!-- product mock: stat pills + job rows rendered as styled divs -->
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Problem section (3 pains, each with the solution the app gives)**

```html
<section id="problem" class="problem">
  <div class="container">
    <p class="eyebrow reveal">The problem</p>
    <h2 class="reveal">Most applications never reach a human.</h2>
    <p class="sec-sub reveal">Recruiters use applicant-tracking systems that scan for keywords before anyone reads a word. If your CV doesn't match the posting, it's filtered out — no matter how good you are.</p>
    <div class="pain-grid">
      <div class="pain reveal"><div class="pain-ico" aria-hidden="true">[svg]</div><h3>Generic CVs get rejected</h3><p>A one-size-fits-all CV loses to tailored ones on 8 out of 10 keyword checks.</p><p class="pain-solve">Tailor CV scores your CV against the exact job — and fills the gaps.</p></div>
      <div class="pain reveal"><div class="pain-ico" aria-hidden="true">[svg]</div><h3>Rewriting takes hours</h3><p>Manually adapting your CV for every role is the reason most people give up applying.</p><p class="pain-solve">One click rewrites your CV for that job — from your real experience, not templates.</p></div>
      <div class="pain reveal"><div class="pain-ico" aria-hidden="true">[svg]</div><h3>Your data lives in the cloud</h3><p>Online CV tools store your personal details, salary, and contacts on their servers.</p><p class="pain-solve">Tailor CV runs on your machine. Your CV and keys never leave it.</p></div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: CSS for hero + problem** (badge, gradient text, screenshot frame with tinted stat pills inside, pain cards with icon tiles, eyebrow + section headings). Keep 200–250ms hovers only.
- [ ] **Step 4: Verify + commit** (`site: hero + problem sections`)

---

### Task 3: Features + How it works

**Files:**
- Modify: `index.html` (`#features`, `#how`), `assets/styles.css`

**Interfaces:**
- Consumes: shell
- Produces: 6 feature cards (icon, title, 1-line value) + 3-step how-it-works strip

- [ ] **Step 1: Feature cards (only the 6 most valuable — audit-grounded)**

1. **Find every job** — 17 sources + 190+ portals, filtered by location, type, competition ("Under 10 applicants") — icon: magnifier
2. **Know your real match** — AI ATS score with skill gaps, missing keywords, and fixes — icon: gauge
3. **Tailor in one click** — ATS-optimized CV per role from your real experience — icon: wand
4. **Manual JD analysis** — paste any job link/description, get scored instantly (⌘J) — icon: clipboard
5. **Reach the recruiter** — contacts from job posts, AI-written cold emails sent from your own mailbox — icon: mail
6. **Yours, end to end** — local accounts, BYOK, SQLite — nothing in the cloud — icon: shield

- [ ] **Step 2: How it works (3 steps)**

1. **Add your CV** — import PDF/DOCX or build it in the editor with a live A4 preview
2. **Search & score** — jobs from 17 sources; AI tells you your match and what's missing
3. **Tailor & apply** — one click per job; download the PDF and send it — or let the AI write the recruiter email too

- [ ] **Step 3: CSS** (feature grid 3×2 → 1-col mobile; step strip with numbered dots and connectors)
- [ ] **Step 4: Verify + commit** (`site: features + how-it-works`)

---

### Task 4: Privacy/trust + FAQ + CTA + footer

**Files:**
- Modify: `index.html` (`#privacy`, `#faq`, `#cta`, footer), `assets/styles.css`

**Interfaces:**
- Consumes: shell
- Produces: privacy section (3 trust points + provider chips), FAQ accordion (6 questions), final CTA band, footer

- [ ] **Step 1: Privacy section**

```html
<section id="privacy" class="privacy">
  <div class="container">
    <p class="eyebrow reveal">Privacy first</p>
    <h2 class="reveal">Your job search is nobody else's business.</h2>
    <div class="trust-grid">
      <div class="trust reveal"><h3>Runs on your machine</h3><p>Self-hosted with Docker or Node. Your CV, jobs, and history live in a local database.</p></div>
      <div class="trust reveal"><h3>Bring your own AI key</h3><p>Works with Gemini, OpenAI, Anthropic, OpenRouter, NVIDIA, or OpenCode Go — your key, your billing, your choice.</p></div>
      <div class="trust reveal"><h3>No accounts in the cloud</h3><p>Local accounts with isolated data per person. Nothing is uploaded, tracked, or sold.</p></div>
    </div>
    <div class="providers reveal"><span>Works with</span> [provider chips: Gemini · OpenAI · Anthropic · OpenRouter · NVIDIA · OpenCode Go]</div>
  </div>
</section>
```

- [ ] **Step 2: FAQ (6 objections → answers)**

1. Do I need a technical background? — No. Docker one-command install or a setup script.
2. Which AI providers work? — All OpenAI-compatible + Gemini/Anthropic SDKs; BYOK.
3. Is it really free? — The app is free and open-source (MIT); you only pay your AI provider's usage.
4. Can multiple people use it? — Yes — local accounts with fully isolated data.
5. Does it work for any industry? — Yes — 1,000+ job titles/skills taxonomy, 190+ portals.
6. What happens to my data if I stop? — Nothing. It stays in your local SQLite file. Delete it, and it's gone.

- [ ] **Step 3: CTA band + footer**

CTA: "Stop sending the same CV." + primary button (href "#" placeholder → link to GitHub repo `https://github.com/Atanub707/ATS-FREE-CVs`) + "Free & open source · MIT"
Footer: brand, tagline, links (Features/How/Privacy/FAQ), "Built by Atanu Biswas", © 2026 Tailor CV.

- [ ] **Step 4: Verify + commit** (`site: privacy, FAQ, CTA, footer`)

---

### Task 5: Final audit + quality gate

**Files:**
- Verify: entire site

**Interfaces:**
- Consumes: all tasks

- [ ] **Step 1: Visual & UX check** — browser at 375/768/1024/1440px: no horizontal scroll, no overlap, hamburger works, FAQ opens/closes, focus rings visible, `prefers-reduced-motion` disables reveals.
- [ ] **Step 2: Lighthouse audit** (chrome-devtools lighthouse_audit, desktop + mobile): a11y ≥ 90, SEO ≥ 90, best-practices ≥ 90. Fix any failure.
- [ ] **Step 3: Content accuracy sweep** — every number/claim in the copy maps to the audit section of this plan (17 sources, 190+ portals, 6 providers, MIT, ⌘J, Under-10-applicants filter). Fix any drift.
- [ ] **Step 4: Commit** (`site: final audit — lighthouse + responsive + content accuracy`) and report results.

---

## Self-Review Checklist

- [ ] Copy grounded in the audit — zero invented features/numbers
- [ ] Minimal: hero + 5 sections + footer, no feature dumps
- [ ] Psychology applied: pain-agitation, specificity, trust anchors, single primary CTA, FAQ objections
- [ ] ui-ux-pro-max pre-delivery checklist: no emoji icons, cursor-pointer everywhere, 150–300ms transitions, focus-visible, reduced-motion, contrast ≥ 4.5:1, responsive 4 breakpoints
- [ ] Lighthouse: a11y/SEO/best-practices ≥ 90
- [ ] No push — commits stay local
