# LinkedIn Job Posts — Research Notes & Search Strategy

> How recruiters actually post jobs on LinkedIn (vs. formal job listings), and the
> optimized search strategy we use to find them. Source: user research brief (2026-08-16)
> + observed LinkedIn posting patterns.

## 1. Posts ≠ Listings (the core difference)

| | **Job listing** (what Apify/valig scrapes) | **Job post** (what this scraper targets) |
|---|---|---|
| Where | `linkedin.com/jobs/view/…` | `linkedin.com/posts/…` · `linkedin.com/feed/update/urn:li:activity:…` |
| Format | Structured form (title, company, location, description) | **Social-media post** — text, hashtags, links, emojis (like Facebook/Instagram) |
| How found | Jobs API / structured endpoints | **Search engines via hashtags + keywords** |
| Announcers | HR systems, ATS | Recruiters & companies posting manually, often BEFORE the formal listing |

Recruiters post openings as ordinary posts with:
- **Hashtags**: `#Hiring` `#NowHiring` `#JobOpening` `#Openings` `#HiringNow` `#Remote` + role tags (`#DevSecOps`, `#DevSecOpsJobs`, `#DevSecOpsEngineer`, `#CloudDevSecOps`, `#DevOpsSecurity`, `#CICD`, `#Kubernetes`, `#KubernetesSecurity`, `#SAST`, `#DAST`, `#SCA`, `#VulnerabilityManagement`, `#CloudSecurity`, `#ApplicationSecurity`, `#SecurityAutomation`)
- **Hiring phrases**: "we're hiring", "looking for", "job opening", "openings", "open position", "opportunity", "urgent hiring", "immediate opening", "join our team", "apply here", "DM me", "open to work" (candidates)
- **Links**: external apply URL, company page, or LinkedIn job link
- **Multi-role posts**: one post may cover several roles ("Hiring DevOps + DevSecOps + Cloud Engineers")

## 2. Search-query rules (from the research brief)

1. **Never search 20 hashtags at once** — use **1–3 hashtags OR 2–3 keywords per query**.
2. Rotate **hashtag queries** and **keyword queries** (engines surface different posts).
3. **Role variants**: expand the user's role into common posting variants
   (e.g. `DevSecOps` → `DevSecOps`, `DevSecOps Engineer`, `DevSecOps Jobs`,
   `Cloud DevSecOps`, `DevOps Security Engineer`, `Security Engineer`, `DevSecOps + Remote`).
4. **Hiring-intent words** mixed in: `hiring`, `we're hiring`, `looking for`, `openings`, `opportunity`, `apply`.
5. **Past 24 hours** filter on every engine (Google `tbs=qdr:d` · DDG `df=range` · Bing `ez5`).
6. **High-value modifiers** (remote-first market): `Remote`, `India`, `MNC`, `Product Company`, `Startup`.
7. Extract **hashtags from the post text** and show them on the result card — they are the
   strongest signal that the post is a job announcement.

## 3. Example query matrix (for "DevSecOps")

| Type | Queries (each run separately) |
|---|---|
| Hashtags | `#DevSecOps #Hiring` · `#DevSecOpsJobs` · `#DevSecOpsEngineer` · `#CloudDevSecOps` · `#CICD #Kubernetes` |
| Role + hiring | `"DevSecOps Engineer" hiring` · `"DevSecOps" openings` · `"DevSecOps Engineer" looking for` · `"Cloud DevSecOps Engineer" apply` |
| Combos | `DevSecOps Kubernetes` · `DevSecOps CI/CD` · `DevSecOps Terraform AWS` · `DevSecOps SAST` |
| Remote-first | `"DevSecOps Engineer" Remote` · `"Cloud Security Engineer" Remote India` |

## 4. Target roles (the "TARGET" list)

DevSecOps Engineer · Senior DevSecOps Engineer · Cloud DevSecOps Engineer ·
DevOps Security Engineer · Cloud Security Engineer · Application Security Engineer ·
Platform Security Engineer

## 5. Implementation

`server/scraper/linkedInPostsScraper.ts`:
- `roleVariants(role)` — expands the searched role into posting-style variants.
- `buildSearchQueries(role)` — generates the optimized query set (hashtag + keyword +
  remote-first), 1–3 tags/keywords per query, capped so we never spam engines.
- Engines (Google → DuckDuckGo → Bing) rotate through the queries until the result
  cap is reached; each query keeps the past-24h filter.
- `extractHashtags(text)` — pulls hashtags from the post text; shown as chips on cards.
