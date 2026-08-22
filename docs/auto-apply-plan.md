# Tailor AI — Auto-Apply Master Plan (v2.0.0)

**Goal:** Turn Tailor AI from *tailor-only* (`search → score → tailor → manual apply`) into *tailor + one-click apply*, **100% local** — no cloud, no per-application fee, data never leaves the machine. The existing tailoring engine is done; this plan closes the last mile: `tailored → applied` without `click, click, click`.

**Version strategy:**
* Current stable: **v1.8.2** (pushed, tagged, released). Contains everything to date: Tailor AI rebrand, one-click Update & Restart (30-min checks), Master CV fixes, Recruiters Create Email, LinkedIn Posts history, Back-refresh, privacy-local.
* Next **major: v2.0.0 = Auto-Apply**. All v1.8.x fixes are included. Users on 1.8.x will see banner `v2.0.0 available → Update & Restart` and get the whole stack in one click.

---

## 1. Research Team — find every blocker before we code

We do not code until the Blocker Matrix is filled. Three parallel tracks, 1 week:

| Researcher | Focus | Deliverable |
|---|---|---|
| **R1 — ATS Coverage** | Test 10 real postings per ATS across all 19. Document: form fields, auth required?, file upload type, anti-bot present? | `Tier table` + dry-run success rate per ATS |
| **R2 — Anti-Bot & Network** | Playwright stealth vs raw `fetch` on Workday/Cloudflare/PerimeterX. Test residential (local Docker) vs datacenter IP reputation, rate limits at 20/day, CAPTCHA frequency | `Stealth config + throttle rules` |
| **R3 — UX / Legal / Receipt** | Design `Draft → Show receipt → Approve & Submit` flow, consent copy, ToS review (LinkedIn Easy Apply = ban risk, Greenhouse/Lever = safe), receipt schema | `Receipt spec + legal go/no-go per ATS` |

**Rule:** Every blocker found → entry in §2 with `Status: Solved / Workaround / Needs Research`. No phase starts with an unsolved Tier 1 blocker.

---

## 2. Blocker Matrix (initial — R1/R2 will verify)

| Tier | ATS / Platform | Blocks locally? | Root cause | Status | Solution / Workaround |
|---|---|---|---|---|---|
| **Tier 1 — MVP (target 70-80% of startup jobs, ~0% block)** | **Greenhouse, Lever, Ashby** | **No** | Plain HTML, no login, no Cloudflare, file input is standard | **Solved** | Playwright straight fill: `fill name/email/phone/location → attach PDF → submit`. No proxy needed. |
| **Tier 1.5** | **Workable (simple), BreezyHR** | Rare CAPTCHA | Simple form, occasional hCaptcha | Workaround | Stealth + 2s typing delay; CAPTCHA → pause and show to user to solve once. |
| **Tier 2 — Moderate** | **BambooHR, Jobvite, JazzHR, Workable (complex)** | Sometimes | Account sometimes required, hCaptcha/reCAPTCHA after ~30/day | Workaround | Persistent `userDataDir` (cookie jar keeps login), throttle 20/day, CAPTCHA hand-off. |
| **Tier 3 — Hard (do NOT start here)** | **Workday, Taleo (Oracle), iCIMS, SuccessFactors** | **Yes — heavy** | DataDome/Cloudflare + multi-step JS + account per company + 2FA + PerimeterX | Needs Research | Per-company account creation + stealth + residential proxy + per-ATS adapter (3-4 wks per ATS). Leave for Phase 2. |
| **Tier 3 — Hard + Legal** | **LinkedIn Easy Apply** | **Yes — ToS** | LinkedIn ToS forbids automation, puzzle CAPTCHA, rate limit, account ban risk | **Do not automate** | Only support "Open in LinkedIn" + manual. Never auto-submit via LinkedIn. |

**Key insight for local:** At 10-20 applies/day on a residential IP, Tier 1 never triggers rate limits. Tsenta needs proxies because they do 600-4500/month from datacenters — you don't.

---

## 3. Solutions Catalogue (what we will actually build)

**How it applies (only way that won't be blocked):**
* `Playwright + Chromium + stealth plugin` inside your existing `ats-cv-tailor` Docker container. Real browser, human-like typing (80-150ms), mouse moves, persistent `userDataDir` for logins. No `fetch` POST.

**Where it applies:**
* **MVP: Only Tier 1 URLs** — user searches in Tailor AI, clicks **Auto-Apply (Beta)** on a Greenhouse/Lever/Ashby job, or pastes any Greenhouse/Lever URL. Tier 2/3 URLs show "Not yet supported — open in browser" with receipt preview.

**Other blockers solved:**
* **Auth:** Tier 1 = no auth (done). Tier 2/3 later = reuse saved session.
* **CAPTCHA:** Never pay for solver. Pause → show CAPTCHA to user in app → continue. Free, ToS-safe.
* **Rate limit:** Hard throttle 20/day, random 30-90s between submits.
* **Legal:** Default `Draft → Receipt → User clicks Confirm & Submit`. User consents per apply; we are not a silent bot.
* **File watching:** Already solved — `DISABLE_HMR` + `restart: unless-stopped` means fresh code on every auto-update restart.

---

## 4. Phased Execution

### Phase 0 — Research (Week 1) — THIS PLAN
* Fill Blocker Matrix with real dry-runs, lock stealth config, lock receipt schema.
* Exit criteria: All Tier 1 blockers = Solved.

### Phase 1 — MVP: Tier 1 Auto-Apply, Dry-Run First (Weeks 2-3)
* Add `playwright` + `git` to Docker image (git already added in v1.8.0).
* New endpoint `POST /api/jobs/:id/auto-apply` — tier check → tailor if needed → Playwright fill → **save receipt, DO NOT SUBMIT** (dry-run).
* UI: Button `Auto-Apply (Beta)` + receipt drawer (`6/6 fields, answers, PDF, time`) + `Confirm & Submit` (second click actually submits).
* Tracker: `Applied` status + receipt linked.
* Deliverable: 10 real Greenhouse/Lever applies submitted end-to-end by us.

### Phase 2 — Expand (Weeks 4-5, only if R1/R2 found a path)
* Ashby + BambooHR/Jobvite adapters, login vault, CAPTCHA hand-off, light watch (poll 50 tracked companies every 30 min when app open).
* Decide: Workday — build or explicitly defer with "Coming later" label.

### Phase 3 — v2.0.0 Launch (Week 6)
* Bump to **v2.0.0**, update `README` (add Auto-Apply to feature list + demo), `CHANGELOG`, tag, release.
* Users on 1.8.x see banner `v2.0.0 available → Update & Restart` → one click, on new major.
* Launch: Show HN "v2 — Auto-Apply, 100% local" + r/selfhosted + Product Hunt (playbook in `docs/launch.md`).

---

## 5. Architecture (local, no cloud)

```
[Master CV + Tailored PDF] → [Auto-Apply Queue (SQLite)] → [Playwright Agent (Chromium, stealth, userDataDir)] → [ATS form]
         ↑ BYOK LLM (tailor + "Why us?" answers)                     ↓
         └────────────── Receipt (fields + answers + PDF + timestamp) → Tracker
```

* Runs inside existing `ats-cv-tailor` container, on user's IP (residential trust).
* `docker-compose.yml` already mounts live source + `ats_node_modules` volume + `restart: unless-stopped` — auto-update path proven via e2e marker test.
* 50k-page 24/7 watch is **not needed locally** — on-demand + 30-min light watch for 50 companies = 80% of value at 0% cloud cost.

---

## 6. Success Criteria (MVP)

* 10/10 Greenhouse dry-runs produce correct receipt without CAPTCHA.
* 10/10 Lever dry-runs same.
* 5 real submits (with manual Confirm) land in ATS and send confirmation email to inbox.
* Local cost: $0 per apply + ~$0.03 LLM per tailor; Docker memory < 1GB extra for Chromium.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Workday blocks even stealth | Defer Workday — ship Tier 1 as "Beta — 3 ATS supported", label Workday as "Coming later" |
| LinkedIn bans account | Never auto-submit via LinkedIn — only "Open in LinkedIn" |
| User's laptop sleeps → watch misses jobs | Queue + apply on next open; document "keep app open for live watch" |
| Playwright bloats image | Already ~300MB; lazy-install Chromium on first use if needed |
| Legal ToS complaints | Human-in-loop Confirm step + local IP + low volume + MIT + receipt transparency |

---

## 8. Next Steps (action now)

1. Assign R1/R2/R3 and run Week 1 research — fill Blocker Matrix with real URLs.
2. If Tier 1 = Solved → start Phase 1 MVP (Greenhouse dry-run).
3. Any new blocker found → add row to §2, find solution or mark `Workaround/Defer`, never block MVP.

*This plan is the gate — no code for Phase 1 until Week 1 research is signed off.*
