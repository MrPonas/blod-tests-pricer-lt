# How to Build This App with Claude Code
### A practical step-by-step workflow guide

---

## What is Claude Code?

Claude Code is a CLI tool that runs in your terminal and acts as a coding agent — it reads your files, writes code, runs commands, fixes errors, and iterates, all autonomously. You talk to it like a developer colleague: describe what you want, it does the work, you review and approve.

You keep control. Claude Code asks before doing anything destructive and shows you diffs before applying changes.

---

## Part 1 — Install & Set Up Claude Code

### Step 1: Install Claude Code

Open your terminal and run:

**macOS / Linux / WSL:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

Verify it worked:
```bash
claude --version
claude doctor   # shows full health check
```

### Step 2: Log in

You need a Claude **Pro or Max plan** (or Anthropic Console account with billing).

```bash
claude
```

On first run it opens your browser for login. Sign in with your Claude.ai account. Done.

### Step 3: Set up your project folder

```bash
mkdir lt-lab-prices
cd lt-lab-prices
git init
```

> From now on, always run `claude` from inside this folder. Claude Code reads everything in the current directory so it understands your project.

---

## Part 2 — The CLAUDE.md File (Critical Step)

Before writing a single line of code, create a `CLAUDE.md` file in your project root. This is what Claude Code reads at the start of every session — it's your project's instruction manual for the agent.

```bash
touch CLAUDE.md
```

Paste this into it:

```markdown
# LT Blood Test Price Aggregator

## What this project is
A public Next.js website that scrapes blood test prices from 6 Lithuanian lab networks
daily and shows them in one place. See full spec in `docs/spec.md`.

## Tech stack
- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL)
- Firecrawl (page fetching)
- Anthropic Claude API — model: claude-sonnet-4-20250514 (price extraction)
- Fuse.js (fuzzy test name matching)
- Tailwind CSS
- GitHub Actions (daily cron)
- Deployed on Vercel

## Key rules
- All scraper code lives in /scrapers/
- All DB logic goes through /lib/db.ts only — never write raw SQL elsewhere
- Never hardcode API keys — always use process.env
- Use TypeScript everywhere, no plain JS files
- Run `npm run dev` to start the dev server on localhost:3000

## Lab price list URLs (update these as you find them)
- Synlab: https://www.synlab.lt/tyrimai-ir-kainos
- Anteja: https://anteja.lt/tyrimu-kainos (confirm this URL)
- Affidea: TBD
- Meliva: TBD
- Rezus: TBD

## Environment variables needed
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FIRECRAWL_API_KEY
ANTHROPIC_API_KEY
ADMIN_SECRET
```

Copy your `lt-blood-test-aggregator-spec.md` into the project too:
```bash
mkdir docs
cp /path/to/lt-blood-test-aggregator-spec.md docs/spec.md
```

---

## Part 3 — Building the App (Phase by Phase)

### How to talk to Claude Code

Launch Claude Code in your project folder:
```bash
claude
```

You'll see an interactive prompt. Type your instruction, press Enter. Claude Code reads your files, writes code, runs commands, and shows you what it's doing. You can approve, edit, or reject each change.

**Key controls:**
- `y` or Enter → approve a file change
- `n` → reject it
- `e` → edit Claude's proposed change before accepting
- Type a follow-up → correct or refine what it just did

---

### Phase 1, Step 1: Scaffold the project

Say this to Claude Code:

```
Read docs/spec.md and CLAUDE.md. Then scaffold a new Next.js 14 project with 
TypeScript and Tailwind CSS. Use the App Router. Create the folder structure 
described in the spec. Also create a .env.local.example file with all needed 
environment variables. Don't install Supabase or Firecrawl packages yet — 
just get the base project structure ready.
```

Claude Code will run `npx create-next-app`, create folders, set up files. Watch it work. When it's done:

```bash
npm run dev
```

Open `http://localhost:3000` and confirm you see the Next.js default page.

---

### Phase 1, Step 2: Set up the database

Go to [supabase.com](https://supabase.com), create a free project, then say:

```
Set up Supabase in this project. Install the Supabase client library. 
Then create a file at lib/db/schema.sql with the full database schema 
from docs/spec.md. After that create lib/db.ts with typed helper functions 
for: getting all labs, getting all categories, upserting a price, and 
inserting a scrape run log entry. Use the Supabase client from 
@supabase/supabase-js.
```

Once done, copy your Supabase credentials into `.env.local`. Then test:

```
Run the schema SQL against my Supabase database and confirm all tables 
were created. Then write a quick test script at scripts/test-db.ts that 
inserts a dummy lab and reads it back. Run it.
```

---

### Phase 1, Step 3: Build the first scraper

This is the core of the project. Say:

```
Build the scraper pipeline for Synlab. Use Firecrawl to fetch the page at 
the URL in CLAUDE.md. Then pass the returned markdown to the Claude API 
(claude-sonnet-4-20250514) with an extraction prompt that pulls all test 
names and prices as JSON. Use the schema from docs/spec.md. 
Save the result to scrapers/labs/synlab.ts. 
Also create scrapers/lib/extract.ts with the shared Claude extraction logic, 
and scrapers/lib/firecrawl.ts with the Firecrawl client wrapper.
Install the needed packages.
```

After Claude Code builds it, test it:

```
Run the Synlab scraper now and print the extracted results to the console. 
Don't write to the database yet — just show me what it finds.
```

Review the output. If prices look wrong or some are missing:

```
The extraction is missing tests that are in a dropdown/tab on the page. 
Update the prompt in extract.ts to handle paginated or tabbed content. 
Also add a hint that Synlab shows prices in a table format.
```

Keep iterating until the output looks right. Then:

```
Now add the fuzzy matching step using Fuse.js. Match extracted test names 
to canonical tests in the database. Tests with no match go to a 
pending_review table. Then write all matched prices to the prices table.
Run the full Synlab scraper end-to-end.
```

---

### Phase 1, Step 4: Build the frontend

```
Build the homepage at app/page.tsx. It should have:
- A prominent search bar in the centre
- A category grid below it (fetched from the database)
- Clean, modern design using Tailwind CSS
- Lithuanian language for all text
- The site name "Laboratorijų kainos" at the top

Also build the search results page at app/search/page.tsx that shows a 
price comparison table when a test name is searched. The table should have 
columns: Lab name | Price (€) | Last updated | Book link.
Highlight the cheapest option in green.
Fetch data from the Supabase database.
```

When it's done, open `http://localhost:3000` and check the UI. If something looks off:

```
The search results table on mobile is overflowing horizontally. 
Fix the layout to be mobile-responsive — the table should scroll 
horizontally on small screens or stack into cards.
```

Or for any design issue, just describe what you see and what you want instead. Be specific:

```
The category grid cards look too plain. Make them more visually distinct — 
add a light background colour per category, make the text larger, add 
some spacing. Keep it clean, not flashy.
```

---

### Phase 1, Step 5: Checking the UI properly

Claude Code can connect to your browser if you have the **Claude in Chrome extension** installed. This lets it see what the page actually looks like and catch visual bugs.

In Claude Code, type:
```
@browser go to localhost:3000 and tell me if there are any console errors 
or layout issues on the homepage
```

Or:
```
@browser search for "Vitaminas D" on localhost:3000 and check if the 
results table renders correctly
```

Without the extension, just open Chrome and check manually — then describe issues in text and Claude Code fixes them.

---

### Phase 1, Step 6: Set up the daily cron

```
Create the GitHub Actions workflow file at .github/workflows/daily-scrape.yml 
using the configuration from docs/spec.md. The workflow should run all 
scrapers in sequence, log success/failure per lab, and trigger at 01:00 UTC daily. 
Also create scrapers/run-all.ts that imports each lab scraper and runs them 
one by one with a 3 second delay between each.
```

---

## Part 4 — Adding More Labs (Repeat Pattern)

Once Synlab works, adding each new lab is fast. Say:

```
Add Anteja as a new lab. The price list URL is [URL]. Follow the same 
pattern as synlab.ts. Test the scraper and show me the output before 
writing to the database.
```

If a lab's page is structured differently:

```
The Anteja extraction is getting the wrong prices — it's picking up 
the price with VAT instead of without. Add a note in the extraction 
prompt to always extract the base price excluding VAT (be pirminio 
PVM / be PVM).
```

---

## Part 5 — Useful Claude Code Commands

### Ask it to explain what it built
```
Explain how the extraction pipeline works in scrapers/lib/extract.ts
```

### Ask it to find bugs
```
I'm getting a TypeScript error when running the scraper. Read the error 
output and fix it.
```

(Paste the error into the prompt, or Claude Code will read terminal output directly.)

### Ask it to add error handling
```
The scraper crashes if Firecrawl fails to load a page. Add proper 
error handling — if a page fails, log the error, mark the scrape_run 
as failed for that lab, and continue with the next lab.
```

### Ask it to write tests
```
Write a test for the fuzzy matching logic in scrapers/lib/match.ts. 
Test that "Vitaminas D 25-OH" matches the canonical test "Vitaminas D (25-OH)" 
and that a completely unrelated string returns no match.
```

### Ask it to review your code
```
Review scrapers/run-all.ts for any potential issues — error handling, 
performance, anything that could cause silent failures in production.
```

---

## Part 6 — Deploy to Vercel

When the app is working locally:

```
Prepare this project for deployment to Vercel. Make sure there are no 
hardcoded values, all env vars are referenced from process.env, and 
the build passes with `npm run build`. Fix any build errors.
```

Then push to GitHub and connect your repo in [vercel.com](https://vercel.com). Add your environment variables in the Vercel dashboard. Done.

For GitHub Actions, add your secrets at:
`GitHub repo → Settings → Secrets and variables → Actions`

Add: `DATABASE_URL`, `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`

---

## Part 7 — Iteration Tips

**Be specific about what's wrong.** Don't say "the UI looks bad." Say "the price table on the /search page has no padding between rows and the Lab column is too narrow — prices get cut off."

**Give Claude Code context when switching tasks.** If you start a new session (close and reopen terminal), say:

```
Read CLAUDE.md and docs/spec.md to get up to speed. We've already built 
the Synlab scraper and the homepage. Today I want to add the category 
browse page.
```

**Use short feedback loops.** Don't ask Claude Code to build everything at once. Build one piece, test it, fix it, then move on. Catching a problem in a 20-line file is easier than in a 500-line one.

**When something is wrong, say exactly what you expected vs what happened:**
```
Expected: searching "TSH" should show results from all labs that have TSH
Actual: the search returns no results even though Synlab has TSH in the database
Fix this — check both the API route and the Fuse.js search logic.
```

---

## Cheat Sheet: Key Prompts to Save

| When you want to... | Say this |
|---|---|
| Start a session | `Read CLAUDE.md and remind me where we left off` |
| Check the UI | `@browser go to localhost:3000 and check for errors` |
| Fix a crash | `I got this error: [paste]. Read the relevant file and fix it.` |
| Add a new lab | `Add [lab name] scraper. URL is [url]. Follow synlab.ts pattern.` |
| Improve extraction | `The extraction for [lab] is wrong — it's getting [X] instead of [Y]. Fix the prompt in extract.ts.` |
| Debug silently failing code | `Add console.log statements to run-all.ts so I can see what's happening at each step.` |
| Prepare for deploy | `Run npm run build and fix any errors. Then check all env vars are from process.env.` |

---

*Keep this file open in a separate tab while working. Update the lab URLs in CLAUDE.md as you find them.*
