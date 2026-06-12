# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

@AGENTS.md

## Project

**Laboratorijų Kainos** — a free public website for Lithuania that aggregates blood test prices from all major private lab networks (Synlab, Anteja, Affidea, Meliva, Rezus) into one place. Users search by test name or browse by category and see a side-by-side price comparison table with the cheapest option highlighted.

## Stack

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, deployed on Vercel
- **Database:** Supabase (PostgreSQL)
- **Scraping:** Firecrawl self-hosted at `http://localhost:3002` (page rendering) + Claude API `claude-sonnet-4-20250514` (data extraction), runs daily via GitHub Actions
- **Fuzzy matching:** Fuse.js (test name → canonical test mapping)
- **Admin panel:** scrape health monitoring + unmatched test name review

## Commands

```bash
npm run dev          # dev server on localhost:3000
npm run build        # production build
npm run lint         # ESLint
npx tsx <file>       # run a TypeScript script directly
npx playwright test  # run E2E tests
npx playwright test --ui  # Playwright UI mode (visual)
```

## Folder structure

```
/app/                      # Next.js App Router pages & API routes
  /api/                    # API routes
    /tests/                # GET /api/tests?search= or ?category=
    /categories/           # GET /api/categories
    /labs/                 # GET /api/labs
    /admin/                # admin-only routes (protected by ADMIN_SECRET)
  /search/                 # /search?q= results page
  /category/[slug]/        # browse by category
  /test/[id]/              # single test price comparison
  /admin/                  # admin dashboard
/scrapers/
  /config/labs.ts          # lab definitions: slug, name, price URL, booking URL
  /lib/
    firecrawl.ts           # Firecrawl client wrapper
    extract.ts             # Claude API extraction logic (shared)
    match.ts               # Fuse.js fuzzy matching to canonical tests
    db.ts                  # DB write helpers
  /labs/                   # per-lab overrides (only if needed)
  run-all.ts               # orchestrator: runs all labs sequentially
/lib/
  db.ts                    # ALL DB access goes here — typed Supabase client + helpers
  db/schema.sql            # PostgreSQL schema
/tests/                    # Playwright E2E tests
/docs/spec.md              # full technical specification (copy of lt-blood-test-aggregator-spec.md)
```

## Key rules

- All DB access goes through `/lib/db.ts` only — never write raw SQL or Supabase calls elsewhere
- All scraper code lives in `/scrapers/`
- TypeScript everywhere — no `.js` files
- Never hardcode API keys — always use `process.env`
- Firecrawl runs locally at `http://localhost:3002` (Docker)
- Primary language is Lithuanian — all UI text in Lithuanian

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FIRECRAWL_API_URL=http://localhost:3002
FIRECRAWL_API_KEY=mylocalsecret123
ANTHROPIC_API_KEY
ADMIN_SECRET
```

## Database schema (summary)

Tables: `labs`, `categories`, `tests`, `prices`, `scrape_runs`, `pending_review`
Full schema in `/lib/db/schema.sql`.

## Lab price list URLs

- Synlab: `https://www.synlab.lt/tyrimai-ir-kainos`
- Anteja: confirm URL on site
- Affidea: confirm URL on site
- Meliva: confirm URL on site
- Rezus: confirm URL on site

## Architecture overview

**Data flow:** daily GitHub Actions cron → `scrapers/run-all.ts` → Firecrawl (fetch) → Claude API (extract JSON) → Fuse.js (match to canonical tests) → Supabase → Next.js API routes → comparison UI.

Scrapers are config-driven: adding a new lab means one entry in `scrapers/config/labs.ts`, no new scraper file needed in most cases. Per-lab prompt hints live in `scrapers/lib/extract.ts` as a `labPromptHints` record.

## Mapping agent architecture (READ BEFORE TOUCHING ANYTHING IN /scrapers/lib/)

The test name mapping system uses a queue-decoupled pattern. Do NOT build
mapping logic inline inside the scraper. The two concerns are separated:

**Scraper job** (`scrapers/run-all.ts`):
- Fetches pages with Firecrawl, extracts names+prices with Claude
- For each raw name: checks mapping cache (test_name_mappings table)
  - HIT → upsert price immediately, continue
  - MISS → insert row into mapping_jobs table with status='pending', continue
- Scraper always exits fast regardless of unmapped names

**Mapping worker** (`workers/process-mapping-jobs.ts`):
- Separate entry point, triggered by GitHub Actions after scraper finishes
- Polls mapping_jobs WHERE status='pending'
- For each job runs the 3-tier pipeline:
  1. Voyage AI embedding → pgvector cosine search → if similarity ≥ 0.94 auto-save
  2. Anthropic SDK tool-use agent loop (NOT LangChain, NOT any framework)
     Agent has tools: search_canonical_tests, map_to_existing, create_new_canonical, flag_for_human
  3. flag_for_human → inserts into mapping_review_queue for admin UI

**Bootstrap** (`scripts/bootstrap-canonical.ts`):
- One-time script to build canonical DB from scratch
- Scrapes all labs simultaneously, batch-embeds all names, clusters by
  cosine similarity, AI agent reviews each cluster to produce canonical entries
- Run once before first production scrape

**Key packages:**
- Embeddings: Voyage AI (`@voyageai/client` or raw fetch to api.voyageai.com)
  Model: voyage-3. Store vectors in pgvector column on tests table.
- Vector search: pgvector extension in Supabase (already enabled via migration)
- Observability: Langfuse (`langfuse` npm package) — wrap every agent run in a trace
- NO LangChain, NO LlamaIndex, NO CrewAI

**New env vars needed:**
VOYAGE_API_KEY=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...

**Folder structure:**
/scrapers/lib/mapping-agent.ts   ← Anthropic SDK tool-use loop
/scrapers/lib/embed.ts           ← Voyage AI embedding calls
/scrapers/lib/mapper.ts          ← cache → vector → agent orchestration
/workers/process-mapping-jobs.ts ← worker entry point
/scripts/bootstrap-canonical.ts  ← one-time bootstrap

## Post-onboarding checklist (run after every new vendor is added)

After scraping a new lab and processing the mapping queue:

1. Run scripts/audit-coverage-gaps.ts
   → finds tests that exist at multiple labs but mapped to
     different canonicals
   → auto-merges obvious duplicates (≥ 0.98 similarity)
   → outputs review CSV for ambiguous cases (0.85–0.98)
   → also catches 0.70–0.85 pairs where names are related
     (same first word or shared medical abbreviation)

2. Run scripts/check-single-lab-tests.ts
   → finds "Lab A has test X, Lab B has test Y, similar but
     neither lab has a price for the other's canonical"
   → catches the Alfa-amilazė pattern missed by audit-coverage-gaps
   → exits 1 if any actionable pairs ≥ 0.85 found

3. Run scripts/merge-duplicate-canonicals.ts
   → finds canonicals with similarity ≥ 0.98
   → auto-merges identical-name duplicates

4. Check is_stale = 0:
   SELECT COUNT(*) FROM prices WHERE is_stale = true
   → should be 0

5. Check null embeddings:
   SELECT COUNT(*) FROM tests WHERE embedding IS NULL
   → should be 0

6. Open /admin/gaps in the app
   → review any remaining single-lab tests flagged as
     potential cross-lab duplicates

Do not skip these steps — they catch the data quality issues
that would otherwise be found manually by browsing the app.

## Development mode

Automated scraping is disabled. To run scraper locally:
  npx tsx scrapers/run-all.ts
To run mapping worker locally:
  npx tsx workers/process-mapping-jobs.ts
To trigger full scrape + deploy manually:
  Go to GitHub → Actions → Daily Price Scrape → Run workflow

To push a code change without triggering a Vercel deploy:
  git commit -m "[skip deploy] your message here"