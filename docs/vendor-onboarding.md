# Vendor Onboarding Procedure

> Read this fully before starting. Every step exists because we 
> learned it the hard way during Anteja + Rezus onboarding.
> Following this procedure keeps costs under €1 per new vendor.

---

## Before you start — research (zero cost)

### 1. Find the price list structure

Visit the lab's website manually. Answer these questions:

- Is there a single page listing all tests + prices?
- Or are tests on individual product pages?
- Does the site have a `sitemap.xml`? Check: `https://[domain]/sitemap.xml`
- Does the price list require login? (If yes — out of scope for now)
- Does the site heavily use JavaScript rendering? (Note this — affects Firecrawl config)

**Rule:** If there is a sitemap → use it as the URL source (cheap).
If no sitemap but a single listing page → scrape that page (cheap).
If neither → use Firecrawl crawl from the root (more expensive, use as last resort).

### 2. Check robots.txt

```
https://[domain]/robots.txt
```

If scraping is disallowed for your use case — stop. Document it and skip this vendor.

### 3. Check page structure with 3 sample pages

Fetch 3 test pages manually or with a quick Firecrawl call.
Look for consistent patterns:
- Is the test name always in an `<h1>` or a specific CSS class?
- Is the price always in the same format (e.g. `€12.50` or `12.50 €`)?
- Are there price ranges, VAT variants, or conditional prices?

**If structure is consistent** → write a regex parser (zero AI cost for extraction).
**If structure varies** → use Haiku extraction (cheap, ~$0.001/page).
**Never use Sonnet for extraction** — it is only for mapping agent decisions.

### 4. Estimate test count

Check the sitemap or category pages. Estimate:
- Total tests the lab offers
- How many are already in your canonical DB (rough guess based on overlap with existing labs)

Use this formula to estimate cost before starting:
```
extraction_cost = total_pages × $0.001  (Haiku) or $0.00 (regex parser)
mapping_cost    = (total_tests × 0.25) × $0.002  (assume 25% cache miss, tiered model)
total_estimate  = extraction_cost + mapping_cost
```

If estimate exceeds €2 — review the approach before proceeding.

---

## Step 1 — Add lab to config (zero cost)

Add the new lab to `scrapers/config/labs.ts`:

```typescript
{
  slug: 'newlab',
  name: 'New Lab Name',
  website_url: 'https://newlab.lt',
  booking_url: 'https://newlab.lt/registracija',
  price_list_url: 'https://newlab.lt/kainos',      // main listing page
  sitemap_url: 'https://newlab.lt/sitemap.xml',    // if exists
  extraction_method: 'regex' | 'haiku',            // from your research
  extraction_hint: '',                              // lab-specific prompt hint if needed
}
```

Insert the lab into the `labs` table in Supabase:
```sql
INSERT INTO labs (name, slug, website_url, booking_url, is_active)
VALUES ('New Lab Name', 'newlab', 'https://newlab.lt', 
        'https://newlab.lt/registracija', true);
```

---

## Step 2 — Build the scraper (minimal code)

### If regex parser works (preferred — zero extraction cost)

Create `scrapers/labs/newlab.ts`:

```typescript
import { scrapeLabWithParser } from '../lib/scrape-with-parser';
import { parseLabPage } from '../lib/newlab-parser'; // write this

export async function scrapeNewlab() {
  return scrapeLabWithParser({
    slug: 'newlab',
    sitemapUrl: 'https://newlab.lt/sitemap.xml',
    isTestUrl: (url) => /newlab\.lt\/[a-z0-9-]+$/.test(url),
    parser: parseLabPage,
    maxPages: process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES) : undefined,
  });
}
```

Write the parser by looking at 3 sample pages:

```typescript
// scrapers/lib/newlab-parser.ts
export function parseLabPage(markdown: string, url: string) {
  // Extract test name — usually the H1
  const nameMatch = markdown.match(/^#\s+(.+)$/m);
  
  // Extract price — adjust regex to match the lab's format
  const priceMatch = markdown.match(/(\d+[.,]\d+)\s*€/);
  
  if (!nameMatch || !priceMatch) return null;
  
  return {
    name: nameMatch[1].trim(),
    price_eur: parseFloat(priceMatch[1].replace(',', '.')),
    url,
  };
}
```

Test the parser on 10 pages before running the full scrape:
```bash
MAX_PAGES=10 npx tsx scrapers/labs/newlab.ts
```

Check: do names and prices look correct? Any nulls? Any obviously wrong values?

### If Haiku extraction needed

Use the existing `extract.ts` with `ANTHROPIC_API_KEY_EXTRACTION`.
Add a lab-specific hint to `scrapers/config/labs.ts` if the page has unusual structure:

```typescript
extraction_hint: 'Prices are shown without VAT. Ignore the VAT price shown in red.'
```

---

## Step 3 — Dry run (zero cost)

Before touching the DB, run in dry-run mode to see what would happen:

```bash
DRY_RUN=true npx tsx scrapers/labs/newlab.ts
```

Check the output:
- Do test names look clean and medical?
- Are prices in a sensible range (€3–€500)?
- Any obviously wrong extractions (prices of €0 or €9999)?
- How many tests found?

Fix any parser issues before proceeding.

---

## Step 4 — Scrape to DB (small batch first)

Run 20 pages first to verify the full pipeline:

```bash
MAX_PAGES=20 npx tsx scrapers/labs/newlab.ts
```

Check:
- Tests appeared in `mapping_jobs` table
- Cache hit rate looks reasonable (expect 60-80% for most labs)
- No DB errors

If everything looks good, run the full scrape:

```bash
npx tsx scrapers/labs/newlab.ts
```

---

## Step 5 — Run the mapping worker

```bash
npx tsx workers/process-mapping-jobs.ts
```

Watch the logs. For every job you should see:
```
[Job X/N] "test name" (Lab)
  → vector top: "canonical name" at 0.XX
  → path: haiku / sonnet
  → decision: map_to_existing(id=X) / create_new / flagged
  → est. cost: $0.00X
```

Expected cost distribution:
- ~60-70% cache hits (free) — tests that exist at other labs
- ~20% vector auto-resolve (free) — similarity ≥ 0.94
- ~10% Haiku decides (cheap) — similarity 0.65-0.94
- ~10% Sonnet creates new canonical (moderate) — genuinely new tests

If Sonnet is handling more than 20% of jobs, something is wrong —
check if the DB canonical count is growing suspiciously fast 
(may indicate duplicates being created instead of matching).

---

## Step 6 — Review the mapping queue

```bash
open http://localhost:3000/admin/mappings
```

You will see:
- **Auto-approved** items (confidence ≥ 0.95) — no action needed
- **Pending review** items — need your eyes

For each pending item:
- If same test, different name → click **Patvirtinti** (Confirm)
- If genuinely different test → click **Naujas** (New)
- If a package/program → click **Praleisti** (Skip)

Bulk approve high-confidence items first (button at top of page).

Expected pending count for a new lab:
- ~5-20 items if DB is well-populated
- Never more than 50 after the hard rules and auto-resolution

If you see 100+ pending items — stop and investigate before approving.
Something went wrong in the mapping pipeline.

---

## Step 7 — Run post-onboarding checklist

This is mandatory after every new vendor. Do not skip.

```bash
# Find and merge duplicate canonicals created during onboarding
npx tsx scripts/merge-duplicate-canonicals.ts

# Find cross-lab tests mapped to different canonicals
npx tsx scripts/audit-coverage-gaps.ts

# Find tests that exist at one lab but not mapped at another
npx tsx scripts/check-single-lab-tests.ts
```

After each script, review the output:
- `merge-duplicate-canonicals.ts` — should auto-merge 0.98+ pairs, show you 0.92-0.98 pairs for review
- `audit-coverage-gaps.ts` — should find 0 new actionable pairs if the DB is mature
- `check-single-lab-tests.ts` — shows single-lab tests that might be cross-lab duplicates

Then verify DB health:
```sql
-- All should return 0
SELECT COUNT(*) FROM prices WHERE is_stale = true;
SELECT COUNT(*) FROM tests WHERE embedding IS NULL;
SELECT COUNT(*) FROM mapping_jobs WHERE status = 'pending';
```

---

## Step 8 — Spot-check in the app

Search for 10 common tests and verify both old and new lab prices appear:

```
TSH
Vitaminas D
Gliukozė
Cholesterolis
Kreatininas
Hemoglobinas / BKT
Feritinas
Vitaminas B12
Folio rūgštis
ALT
```

For each test:
1. Does the new lab appear alongside existing labs?
2. Is the price correct? (spot-check against the lab's website)
3. Does the booking link go to the right page?

If a test is missing from one lab — check `check-single-lab-tests.ts` output first
before investigating manually. It usually shows up there.

---

## Step 9 — Update GitHub Actions

The scraper needs to run daily for the new lab too.

In `.github/workflows/daily-scrape.yml`, add the new lab's scraper
to the sequence in `scrapers/run-all.ts`:

```typescript
import { scrapeNewlab } from './labs/newlab';

// In the main sequence:
await scrapeNewlab();
await sleep(3000); // 3 second courtesy delay between labs
```

Push to GitHub and verify the workflow runs correctly on the next
scheduled execution (or trigger manually from GitHub Actions UI).

---

## Cost reference

Expected costs per new vendor after the canonical DB is mature:

| Component | Cost |
|---|---|
| Extraction (regex parser) | €0.00 |
| Extraction (Haiku fallback, ~5%) | ~€0.01 |
| Mapping worker (tiered model) | ~€0.30–0.80 |
| Post-onboarding scripts | €0.00 |
| **Total one-time onboarding** | **~€0.30–0.80** |
| **Daily maintenance** | **~€0.02/day** |

**Zero-price canonicals after full onboarding:** expect 5–10% of the
canonical DB to have no prices. This is normal and correct — it reflects
tests offered by some labs but not others, niche prenatal/genetic panels,
certificate-only services, and trace elements not listed by every lab.
Do not force-populate these with placeholder prices or delete them;
they are accurate representations of lab coverage gaps.

If your actual cost significantly exceeds this estimate — stop and investigate
before spending more. Common causes:
- Parser is failing and falling back to Haiku on every page
- Mapping agent is creating too many new canonicals (DB not matching)
- Sonnet being called more than expected (check similarity thresholds)

---

## Troubleshooting

**Too many new canonicals being created**
The DB has good coverage now. If >20% of tests are creating new canonicals,
the new lab probably uses very different naming conventions.
Check the hard rules are firing correctly:
```bash
DRY_RUN=true npx tsx workers/process-mapping-jobs.ts
```
Look at the path taken per job — if most go to Sonnet, add lab-specific
aliases to normalize the naming before mapping.

**Price not showing for a test**
1. Check `mapping_jobs` — did it get processed? (`status = 'done'`)
2. Check `test_name_mappings` — is it mapped to the right canonical?
3. Check `prices` — is `is_stale = false`?
4. Run `check-single-lab-tests.ts` — might be mapped to a different canonical

**Mapping queue has 100+ pending items**
Something went wrong. Do not bulk-approve blindly.
Check if IgG/IgM tests are being confused, or if sample type variants 
are being merged incorrectly. Fix the root cause first.

**Anteja cookie wall on individual product pages**
Some Anteja individual product pages return a cookie consent wall instead
of content when fetched via Firecrawl. If the parser returns null for
Anteja pages that definitely exist (confirmed 200 via HEAD), add
`waitFor: 3000` to the Firecrawl scrape options and retry:

```typescript
const result = await app.v1.scrapeUrl(url, {
  formats: ['markdown'],
  timeout: 60000,
  waitFor: 3000,
});
```

If still failing, the price may already exist under a different canonical
from the bootstrap era — run `check-single-lab-tests.ts` and inspect its
output before assuming the test is missing. Anteja prices scraped from
the main listing page often land on active canonicals with bootstrap-era
naming; the individual page URL just confirms the test exists.

**Firecrawl timeout on specific pages**
The `withTimeout(90_000)` guard in the scraper will skip hung pages.
Check the failed URLs in the scrape output and re-run them individually
or add them to a retry list.

**Lab's sitemap missing test pages**
Some labs don't include all product pages in their sitemap.
Use Firecrawl `map()` to discover all URLs, then cross-reference
against what the sitemap provides.

---

## Checklist summary

```
Before starting:
[ ] Found price list URL / sitemap
[ ] Checked robots.txt — scraping allowed
[ ] Tested 3 sample pages — structure understood
[ ] Estimated cost — under €2

During onboarding:
[ ] Added to labs.ts and labs DB table
[ ] Parser written and tested on 10 pages (dry run)
[ ] Full scrape completed
[ ] Mapping worker completed
[ ] Mapping review queue processed (< 50 items, all reviewed)

Post-onboarding:
[ ] merge-duplicate-canonicals.ts — run and reviewed
[ ] audit-coverage-gaps.ts — run and reviewed  
[ ] check-single-lab-tests.ts — run and reviewed
[ ] is_stale = 0 confirmed
[ ] null embeddings = 0 confirmed
[ ] 10 common tests spot-checked in app
[ ] GitHub Actions updated with new lab
[ ] Actual cost noted: ___
```
