# 🩸 LT Blood Test Price Aggregator — Project Specification

> **Purpose of this document:** A full specification for an AI coding agent (Cursor, Claude Code, etc.) to build a public web application that scrapes blood test prices from major Lithuanian laboratory networks and presents them in one unified, searchable interface.

---

## 1. Project Overview

### What it does
A public website where anyone in Lithuania can search for a blood test by name or browse by category and instantly see the current price at every major lab — without visiting six different websites.

### Why it matters
Blood test prices vary significantly between labs in Lithuania. This tool saves time, reduces friction, and helps people make informed decisions about where to get tested.

---

## 2. Target Lab Networks (Phase 1)

| Lab | Website | Notes |
|-----|---------|-------|
| Synlab | synlab.lt | Major national chain |
| Anteja | anteja.lt | |
| Affidea | affidea.lt | |
| Meliva | meliva.lt | |
| Rezus | rezus.lt | |
| MB (to confirm) | TBD | Confirm exact domain |

> **Phase 2:** Architecture must allow easy addition of new labs without restructuring the codebase. Each lab should be a self-contained scraper module.

---

## 3. Core Features

### 3.1 Price Comparison Table
- User searches for a test (e.g. "Vitaminas D", "gliukozė", "TSH")
- App shows a table: **Test name | Lab | Price | Last updated | Link to book**
- Results sorted by price (cheapest first) by default
- Show the lowest price prominently (highlighted)

### 3.2 Browse by Category
Tests organized into categories, e.g.:
- Bendra kraujo analizė (Complete blood count)
- Hormonai (Hormones)
- Vitaminai (Vitamins)
- Biochemija (Biochemistry)
- Infekcijos / Serologijos (Infections / Serology)
- Alergologijos (Allergy)
- Onkologiniai žymenys (Tumor markers)
- Kita (Other)

Categories should be editable without code changes (stored in config or DB).

### 3.3 Search
- Full-text search across test names (Lithuanian + common abbreviations)
- Fuzzy matching (handle typos, e.g. "gliukoze" → "gliukozė")
- Search should work in both Lithuanian (with diacritics) and without (ASCII fallback)

### 3.4 Daily Price Refresh
- Scrapers run automatically once per day (e.g. 03:00 AM Lithuanian time)
- Each scrape updates only that lab's prices in the DB
- Show "Last updated: [date]" per lab on the UI
- If a scrape fails, keep the last known price and mark it as stale (warn user)

---

## 4. Technical Architecture

### 4.1 Recommended Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js (React) | SSR for SEO, fast search UX |
| Backend / API | Next.js API routes | Lightweight, co-located with frontend |
| Database | PostgreSQL via Supabase | Managed, free tier, easy querying |
| Page fetching | **Firecrawl** | Handles JS rendering, anti-bot, proxy rotation automatically |
| Data extraction | **Claude API** (`claude-sonnet-4-20250514`) | Extracts structured JSON from raw page content — adapts when sites redesign |
| Scheduler | GitHub Actions cron | Free, simple, runs daily |
| Hosting | Vercel (frontend + API) | Free tier, zero-config deploys |

### Why Firecrawl + Claude instead of raw Playwright

Raw Playwright/Puppeteer requires you to maintain per-lab CSS selectors that break every time a lab redesigns their site. The professional 2026 approach separates two concerns:

1. **Fetching** — Firecrawl handles headless rendering, residential proxy rotation, and anti-bot fingerprinting. You never touch this layer.
2. **Extracting** — Claude reads the raw page content and returns structured JSON. No selectors. No breakage on redesigns. Prompt changes take 30 seconds.

For 6 labs scraped once per day, Firecrawl's free tier (500 credits/month) covers everything. Claude API costs for this volume are under $1/month.

### 4.2 Database Schema

```sql
-- Labs table
CREATE TABLE labs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,        -- e.g. "Synlab"
  slug VARCHAR(50) UNIQUE NOT NULL,  -- e.g. "synlab"
  website_url TEXT NOT NULL,
  booking_url TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Test categories
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name_lt VARCHAR(200) NOT NULL,     -- Lithuanian name
  name_en VARCHAR(200),
  slug VARCHAR(100) UNIQUE NOT NULL
);

-- Master test list (canonical test names)
CREATE TABLE tests (
  id SERIAL PRIMARY KEY,
  canonical_name_lt VARCHAR(300) NOT NULL,
  canonical_name_en VARCHAR(300),
  category_id INTEGER REFERENCES categories(id),
  aliases TEXT[],                    -- Alternative names / abbreviations for search
  created_at TIMESTAMP DEFAULT NOW()
);

-- Per-lab prices (updated daily)
CREATE TABLE prices (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id),
  lab_id INTEGER REFERENCES labs(id),
  price_eur NUMERIC(8,2) NOT NULL,
  lab_test_name VARCHAR(300),        -- Exact name as shown on lab's website
  lab_test_url TEXT,                 -- Direct link to this test on lab's site
  scraped_at TIMESTAMP NOT NULL,
  is_stale BOOLEAN DEFAULT false,    -- true if last scrape failed
  UNIQUE(test_id, lab_id)
);

-- Scrape run log
CREATE TABLE scrape_runs (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id),
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  status VARCHAR(20),                -- 'success' | 'partial' | 'failed'
  tests_updated INTEGER,
  error_message TEXT
);
```

### 4.3 Scraper Architecture

#### Folder structure

```
/scrapers/
  config/
    labs.ts             ← Lab definitions: slug, name, price-list URL(s)
  lib/
    firecrawl.ts        ← Firecrawl client wrapper
    extract.ts          ← Claude API extraction logic (shared)
    match.ts            ← Fuzzy test name → canonical test matching
    db.ts               ← DB write helpers
  labs/
    synlab.ts           ← Lab-specific overrides (if any)
    anteja.ts
    affidea.ts
    meliva.ts
    rezus.ts
  run-all.ts            ← Orchestrator: runs all labs, writes to DB
```

#### How each scrape works (3 steps)

**Step 1 — Fetch with Firecrawl**

Firecrawl renders the lab's price list page (handles JS, anti-bot, proxies) and returns clean markdown.

```typescript
import FirecrawlApp from '@mendable/firecrawl-js';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

const result = await firecrawl.scrapeUrl(lab.priceListUrl, {
  formats: ['markdown'],
  proxy: 'auto',          // Firecrawl picks basic or stealth as needed
});

const pageMarkdown = result.markdown;
```

**Step 2 — Extract with Claude**

Pass the raw markdown to Claude API with a structured extraction prompt. Claude returns clean JSON — no CSS selectors, no XPath, no breakage when the lab redesigns.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: `
      You are extracting blood test prices from a Lithuanian lab website.
      From the page content below, extract ALL tests and their prices.
      
      Return ONLY valid JSON in this exact format — no explanation, no markdown:
      {
        "tests": [
          {
            "name": "Vitaminas D (25-OH)",
            "price_eur": 12.50,
            "url": "https://..." // direct link to this test if visible, else null
          }
        ]
      }
      
      Page content:
      ${pageMarkdown}
    `
  }]
});

const extracted = JSON.parse(response.content[0].text);
```

**Step 3 — Match & write to DB**

Map extracted test names to canonical tests using fuzzy matching (`fuzzysort` or `fuse.js`), then upsert prices.

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(canonicalTests, { keys: ['name_lt', 'aliases'], threshold: 0.3 });

for (const item of extracted.tests) {
  const match = fuse.search(item.name)[0];
  
  if (match && match.score < 0.3) {
    await upsertPrice({ testId: match.item.id, labId, priceEur: item.price_eur, ... });
  } else {
    await insertPendingReview({ labId, rawName: item.name, priceEur: item.price_eur });
  }
}
```

#### Lab config file

Each lab is just a config entry — no custom scraping code needed unless a lab has unusual page structure.

```typescript
// scrapers/config/labs.ts
export const labs = [
  {
    slug: 'synlab',
    name: 'Synlab',
    priceListUrl: 'https://www.synlab.lt/tyrimai-ir-kainos',
    bookingUrl: 'https://www.synlab.lt/registracija',
  },
  {
    slug: 'anteja',
    name: 'Anteja',
    priceListUrl: 'https://anteja.lt/tyrimu-kainos',
    bookingUrl: 'https://anteja.lt',
  },
  // ... add new labs here, no other code changes needed
];
```

> **Adding a new lab in Phase 2:** Add one entry to `labs.ts`. If the page is a multi-page catalogue, add `additionalUrls: [...]` to crawl them all. No new scraper file needed in most cases.

### 4.4 API Endpoints

```
GET /api/tests?search=vitaminas+d          → search tests + all prices
GET /api/tests?category=hormonai           → browse by category
GET /api/tests/:id                         → single test detail with all lab prices
GET /api/categories                        → list all categories
GET /api/labs                              → list all labs + last scrape time
GET /api/admin/scrape-status               → scrape run history (admin only)
POST /api/admin/trigger-scrape             → manually trigger scrape (admin only)
```

---

## 5. Frontend UI

### 5.1 Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with search bar + category grid |
| `/search?q=...` | Search results page |
| `/category/[slug]` | Browse all tests in a category |
| `/test/[id]` | Single test page with price comparison table |
| `/about` | About the project, data freshness info |
| `/admin` | Admin dashboard (scrape status, pending mappings) |

### 5.2 Key UI Components

**Price comparison table** (on `/test/[id]` and search results):
```
| Lab        | Price    | Last updated  | Book          |
|------------|----------|---------------|---------------|
| ✅ Meliva  | €8.50    | Today         | [Book →]      |
| Synlab     | €10.20   | Today         | [Book →]      |
| Anteja     | €11.00   | Today         | [Book →]      |
| Affidea    | €12.50   | Yesterday ⚠️ | [Book →]      |
| Rezus      | —        | —             | Not available |
```

**Search bar:**
- Prominent, centered on homepage
- Autocomplete suggestions as user types (debounced, 300ms)
- Support Lithuanian keyboard input

**Category grid** (homepage):
- Icon + category name cards
- Show count of tests per category

### 5.3 Language
- Primary language: **Lithuanian**
- Keep English as a secondary label where helpful (e.g. test abbreviations)
- No full internationalization needed for Phase 1

---

## 6. Scraper Implementation Notes

### Before coding: find each lab's price list URL

The only per-lab research needed upfront is finding the correct price list page URL. Visit each site manually and find the page that shows all tests + prices. Add it to `labs.ts`. That's it — Firecrawl and Claude handle the rest.

Checklist per lab:
- [ ] Find the public price list page (no login required)
- [ ] Check `robots.txt` — confirm scraping is not disallowed
- [ ] If prices span multiple pages/tabs, note all URLs in `additionalUrls`
- [ ] Add the booking/appointment URL

### Rate limiting — handled automatically

Firecrawl manages delays, proxy rotation, and retries internally. On your side:
- Run labs **sequentially** in `run-all.ts`, not in parallel (courteous to the sites)
- Add a 2–3 second `setTimeout` between labs as a basic courtesy
- Firecrawl will retry failed pages automatically (up to 3x)

### Extraction prompt tuning

If Claude's extraction misses tests or gets prices wrong for a specific lab, the fix is a prompt tweak in `extract.ts`, not a code change. Example overrides per lab:

```typescript
const labPromptHints: Record<string, string> = {
  synlab: 'Prices are shown in a table with columns: Test name | Code | Price (€)',
  anteja: 'Some tests have price ranges — extract the lower price.',
};
```

---

## 7. Admin Panel

A simple password-protected admin section (HTTP Basic Auth or a hardcoded token is fine for Phase 1):

- **Scrape status dashboard:** Show last run time, success/failure, tests updated per lab
- **Manual scrape trigger:** Button to kick off a full scrape run immediately
- **Pending test mappings:** Table of lab test names that couldn't be matched to canonical tests → allow admin to map or create new canonical entry
- **Lab on/off toggle:** Disable a specific lab without code changes

---

## 8. Deployment

### Recommended setup (free tier friendly)

```
Frontend (Next.js)     → Vercel (free)
Python scrapers        → GitHub Actions (cron: daily at 03:00 EET)
Database               → Supabase free tier (PostgreSQL)
Backend API            → Vercel serverless functions OR Railway free tier
```

### Environment variables needed

```env
# Supabase
DATABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Scraping
FIRECRAWL_API_KEY=...        # Get free key at firecrawl.dev

# Extraction
ANTHROPIC_API_KEY=...        # claude-sonnet-4-20250514 for extraction

# Admin panel
ADMIN_SECRET=...             # Simple token for admin route protection
```

### GitHub Actions cron job (`.github/workflows/daily-scrape.yml`)

```yaml
name: Daily Price Scrape

on:
  schedule:
    - cron: '0 1 * * *'      # 01:00 UTC = 03:00 EET (UTC+2 summer)
  workflow_dispatch:           # Allow manual trigger from GitHub UI

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx tsx scrapers/run-all.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 9. Phase Roadmap

### Phase 1 — MVP (build first)
- [ ] Set up Supabase DB with schema
- [ ] Set up Firecrawl account + get API key
- [ ] Find price list URLs for all 6 labs + check `robots.txt`
- [ ] Build `run-all.ts` scraper with Firecrawl fetch + Claude extraction
- [ ] Test against Synlab + Anteja, tune extraction prompt until accurate
- [ ] Build basic Next.js frontend: homepage search + price comparison table
- [ ] Set up GitHub Actions daily cron
- [ ] Deploy to Vercel + go public

### Phase 2 — Complete coverage
- [ ] Add remaining lab scrapers (Affidea, Meliva, Rezus)
- [ ] Build category browse UI
- [ ] Admin panel for scrape monitoring + test mapping
- [ ] Handle stale data warnings in UI

### Phase 3 — Nice to haves
- [ ] Price history chart per test (track price changes over time)
- [ ] Email/Telegram alert when a specific test drops in price
- [ ] "Cheapest package" builder (pick multiple tests, find lab with best total)
- [ ] Mobile app (React Native or PWA)
- [ ] User-submitted corrections / reports

---

## 10. Out of Scope (for now)

- User accounts / authentication for end users
- Booking integration (link to lab's own booking page is enough)
- Lab results storage or health tracking
- Tests requiring a doctor's referral (just show price, add disclaimer)
- Private/corporate lab contracts (only public self-pay prices)

---

## 11. Legal & Ethical Notes

- Only scrape **publicly available** price pages (no login required)
- Add a disclaimer: *"Prices are approximate and may differ. Always verify on the lab's official website."*
- Respect `robots.txt` — check each lab's file before scraping
- Do not store any personal data about users
- Consider adding a contact email so labs can request corrections

---

*Last updated: May 2026 | Status: Pre-development*
