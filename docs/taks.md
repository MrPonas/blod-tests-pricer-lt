# Mapping System Implementation Plan

> Claude Code: Read this file top to bottom before doing anything.
> Read CLAUDE.md and docs/mapping-architecture.md first.
> Work through tasks in order. Check off each item when done.
> Do not skip ahead. Do not move to the next task until the current one compiles cleanly.

---

## Pre-flight checks (do these before any code changes)

- [ ] Read `CLAUDE.md` fully
- [ ] Read `docs/mapping-architecture.md` fully
- [ ] List all files currently in `scrapers/lib/` — note anything related to matching or fuzzy search
- [ ] Check `package.json` — note if `fuse.js` is present
- [ ] Check `lib/db/schema.sql` — note which tables already exist
- [ ] Report findings as a summary, then proceed

---

## Task 1 — Cleanup legacy code

- [ ] Delete `scrapers/lib/match.ts` if it exists
- [ ] Remove `fuse.js` from `package.json` and run `npm uninstall fuse.js` if it was present
- [ ] Search entire codebase for `fuse` imports — remove any you find

---

## Task 2 — Install new packages

- [ ] Run `npm install langfuse`
- [ ] Voyage AI does NOT need a package — it is called via raw `fetch` in `embed.ts`
- [ ] Confirm `@anthropic-ai/sdk` and `@supabase/supabase-js` are already in `package.json`

---

## Task 3 — Database schema additions

Add to `lib/db/schema.sql`. Do not remove existing tables — only add:

- [ ] `CREATE EXTENSION IF NOT EXISTS vector` (pgvector)
- [ ] `ALTER TABLE tests ADD COLUMN IF NOT EXISTS embedding vector(1024)`
- [ ] `ALTER TABLE tests ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20) UNIQUE`
- [ ] `ALTER TABLE tests ADD COLUMN IF NOT EXISTS search_vector tsvector` (generated, stored)
- [ ] `CREATE INDEX` on `tests.embedding` using `ivfflat`
- [ ] `CREATE INDEX` on `tests.search_vector` using `GIN`
- [ ] `CREATE TABLE IF NOT EXISTS test_name_mappings` (full definition from architecture doc)
- [ ] `CREATE TABLE IF NOT EXISTS mapping_jobs` (full definition from architecture doc)
- [ ] `CREATE TABLE IF NOT EXISTS mapping_review_queue` (full definition from architecture doc)
- [ ] `CREATE OR REPLACE FUNCTION match_tests(...)` (vector similarity search, from architecture doc)

---

## Task 4 — Create `scrapers/lib/normalize.ts`

Exact implementation from `docs/mapping-architecture.md`.

- [ ] Lithuanian diacritics map
- [ ] Known medical abbreviation expansions (TSH, OAM, KLA, CRB, Vit., 25-OH, etc.)
- [ ] Noise token removal
- [ ] Export `normalizeTestName(raw: string): string`
- [ ] Run `npx tsc --noEmit` — must pass with no errors on this file

---

## Task 5 — Create `scrapers/lib/embed.ts`

Exact implementation from `docs/mapping-architecture.md`.

- [ ] `embedText(text: string): Promise<number[]>` — single embedding via Voyage AI
- [ ] `embedBatch(texts: string[]): Promise<number[][]>` — batch embedding, sorted by index
- [ ] Uses `process.env.VOYAGE_API_KEY`
- [ ] Uses model `voyage-3`
- [ ] Throws a clear error if the API returns non-200
- [ ] Run `npx tsc --noEmit` — must pass

---

## Task 6 — Create `scrapers/lib/mapping-agent.ts`

Exact implementation from `docs/mapping-architecture.md`.

- [ ] All 5 tool definitions: `search_canonical_tests`, `get_test_details`, `map_to_existing`, `create_new_canonical`, `flag_for_human`
- [ ] `SYSTEM_PROMPT` constant with Lithuanian medical domain knowledge
- [ ] `executeTool()` function handling all 5 tools
- [ ] `runMappingAgent(ctx, initialCandidates)` — the agentic loop (max 10 steps)
- [ ] Every agent run wrapped in a Langfuse trace
- [ ] Terminal tools (`map_to_existing`, `create_new_canonical`, `flag_for_human`) break the loop
- [ ] Uses `claude-sonnet-4-20250514`
- [ ] Run `npx tsc --noEmit` — must pass

---

## Task 7 — Create `scrapers/lib/mapper.ts`

Exact implementation from `docs/mapping-architecture.md`.

- [ ] `RawTest` interface exported
- [ ] `mapAndUpsertTests(rawTests, lab)` function
- [ ] Tier 1: cache lookup in `test_name_mappings` — HIT → upsert price, continue
- [ ] Tier 2: embed → `match_tests` RPC → if similarity ≥ 0.94 auto-save and upsert price
- [ ] Tier 3: MISS → insert into `mapping_jobs` with `status='pending'`
- [ ] Private `upsertPrice()` helper
- [ ] Does NOT call `runMappingAgent` — that is the worker's job
- [ ] Run `npx tsc --noEmit` — must pass

---

## Task 8 — Update `scrapers/run-all.ts`

- [ ] Import `mapAndUpsertTests` from `./lib/mapper`
- [ ] Replace any existing inline matching / Fuse.js / upsert logic with a call to `mapAndUpsertTests(extractedTests, lab)`
- [ ] The scraper should never import `embed.ts` or `mapping-agent.ts` directly
- [ ] Log `matched` and `queued` counts per lab after each scrape
- [ ] Run `npx tsc --noEmit` — must pass

---

## Task 9 — Create `workers/process-mapping-jobs.ts`

Exact implementation from `docs/mapping-architecture.md`.

- [ ] Polls `mapping_jobs WHERE status = 'pending'`
- [ ] Atomically claims batches by updating `status='processing'` and `claimed_at`
- [ ] For each job: embeds raw name → gets top vector candidates → calls `runMappingAgent`
- [ ] Marks job `status='done'` on success, `status='failed'` with error on failure
- [ ] 500ms pause between jobs
- [ ] Exits cleanly when queue is empty (`process.exit(0)`)
- [ ] Run `npx tsc --noEmit` — must pass

---

## Task 10 — Create `scripts/bootstrap-canonical.ts`

Exact implementation from `docs/mapping-architecture.md`.

- [ ] Reads from `raw_scraped_tests` table (created during initial scrape before bootstrap)
- [ ] Batch-embeds all names
- [ ] Clusters by cosine similarity (threshold 0.88) using the `clusterBySimilarity` function
- [ ] AI agent reviews each cluster — confirms single test or flags for splitting
- [ ] Inserts confirmed canonical tests with embeddings
- [ ] Saves cluster members as `bootstrap_cluster` mappings
- [ ] Single-occurrence tests → inserted into `mapping_review_queue`
- [ ] Run `npx tsc --noEmit` — must pass

---

## Task 11 — GitHub Actions: mapping worker workflow

Create `.github/workflows/process-mappings.yml`:

- [ ] Triggers on `workflow_run` when "Daily Price Scrape" completes
- [ ] Also has `workflow_dispatch` for manual trigger
- [ ] Runs `npx tsx workers/process-mapping-jobs.ts`
- [ ] Uses secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`

---

## Task 12 — Environment variables

- [ ] Add to `.env.local.example` (NOT `.env.local`):
  ```
  VOYAGE_API_KEY=your-voyage-api-key-here
  LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
  LANGFUSE_SECRET_KEY=your-langfuse-secret-key
  LANGFUSE_HOST=https://cloud.langfuse.com
  ```
- [ ] Verify these are also referenced (as `${{ secrets.XXX }}`) in both GitHub Actions workflow files

---

## Task 13 — Final checks

- [ ] Run `npx tsc --noEmit` across the whole project — zero errors
- [ ] Run `npm run build` — must succeed
- [ ] Confirm no file imports `fuse.js` anywhere
- [ ] Confirm `scrapers/run-all.ts` does not directly import `mapping-agent.ts` or `embed.ts`
- [ ] Confirm `workers/process-mapping-jobs.ts` exists and compiles
- [ ] List all new files created during this session

---

## Done

When all tasks are checked off, report:
1. Every file created or modified
2. Any tasks that needed deviation from the architecture doc and why
3. Anything that needs manual action (e.g. running SQL migrations in Supabase, adding secrets to GitHub)