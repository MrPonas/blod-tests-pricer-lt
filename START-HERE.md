# START HERE
## Complete setup guide — from zero to building the app

Read this top to bottom. Do each step before moving to the next.

---

## BEFORE YOU START — What you need

- [ ] A computer with internet
- [ ] [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- [ ] [VS Code](https://code.visualstudio.com) installed
- [ ] [Node.js 18+](https://nodejs.org) installed → check with `node -v` in terminal
- [ ] A [GitHub](https://github.com) account (free)
- [ ] A [Supabase](https://supabase.com) account (free)
- [ ] An [Anthropic Console](https://console.anthropic.com) account (for the Claude API key)
- [ ] A [Claude.ai Pro or Max plan](https://claude.ai) (required for Claude Code)

---

## STAGE 1 — Install Claude Code

Open a terminal (in VS Code: press `` Ctrl+` `` or `Cmd+` `` on Mac).

**macOS / Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://claude.ai/install.ps1 | iex
```

Verify it worked:
```bash
claude --version
```

Log in (opens browser):
```bash
claude
```

Sign in with your Claude.ai account. Come back to the terminal when done.

---

## STAGE 2 — Create the project folder and connect Git

Do this in your terminal, step by step:

```bash
# 1. Go to wherever you keep your projects
cd ~/Documents       # or wherever you prefer, e.g. C:\Projects on Windows

# 2. Create the project folder
mkdir lt-lab-prices
cd lt-lab-prices

# 3. Open it in VS Code immediately
code .
```

VS Code opens. Now back in the terminal (you can use VS Code's built-in terminal from now on):

```bash
# 4. Initialise Git
git init

# 5. Create a .gitignore straight away so you never accidentally commit secrets
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.next/
dist/
.DS_Store
EOF

# 6. Create your first commit
git add .gitignore
git commit -m "init"
```

### Connect to GitHub

Go to [github.com/new](https://github.com/new), create a new **private** repository called `lt-lab-prices`. Don't add README or .gitignore — the repo should be empty.

Copy the two commands GitHub shows you under "push an existing repository" and run them in your terminal. They look like:

```bash
git remote add origin https://github.com/YOUR-USERNAME/lt-lab-prices.git
git push -u origin main
```

✅ Your project is now on GitHub. VS Code's Git panel (left sidebar) will show changes going forward.

---

## STAGE 3 — Set up Firecrawl locally (one-time, reusable forever)

This installs your personal scraping tool that all your future projects can use.

```bash
# Go back to home directory — Firecrawl lives separately from your project
cd ~

# Clone Firecrawl
git clone https://github.com/firecrawl/firecrawl.git
cd firecrawl

# Create the config file
cp apps/api/.env.example apps/api/.env
```

Open `~/firecrawl/apps/api/.env` in any text editor and make sure these lines are set:

```env
PORT=3002
HOST=0.0.0.0
USE_DB_AUTHENTICATION=false
BULL_AUTH_KEY=mylocalsecret123
NUM_WORKERS_PER_QUEUE=2
```

Start it (first time downloads ~3-4GB, takes a few minutes):
```bash
docker compose up -d
```

Wait about 60 seconds then test it:
```bash
curl -X POST http://localhost:3002/v1/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mylocalsecret123" \
  -d '{"url": "https://example.com", "formats": ["markdown"]}'
```

If you get back a big block of markdown text — it's working. ✅

Add convenient shortcuts to your shell (so you can start/stop Firecrawl easily):

**macOS / Linux** — add to `~/.zshrc` or `~/.bashrc`:
```bash
echo 'alias firecrawl-start="docker compose -f ~/firecrawl/docker-compose.yaml up -d"' >> ~/.zshrc
echo 'alias firecrawl-stop="docker compose -f ~/firecrawl/docker-compose.yaml down"' >> ~/.zshrc
source ~/.zshrc
```

**Windows** — just run `docker compose up -d` from the `~/firecrawl` folder when you need it.

> **Note:** Firecrawl uses ~4GB RAM while running. Stop it when you're not working:
> `firecrawl-stop` (or `docker compose down` in the firecrawl folder)

---

## STAGE 4 — Get your API keys

You need three keys. Get them now before writing any code.

### Supabase
1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `lt-lab-prices`, choose a region close to Lithuania (e.g. Frankfurt)
3. Save the database password somewhere safe
4. Go to Project Settings → API
5. Copy: `Project URL`, `anon public key`, `service_role key`

### Anthropic (Claude API)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key
3. Copy the key (you only see it once)

### Firecrawl (local)
- URL: `http://localhost:3002`
- Key: `mylocalsecret123` (whatever you set in BULL_AUTH_KEY above)

---

## STAGE 5 — Set up the project files (CLAUDE.md + .env)

Go back to your project:
```bash
cd ~/Documents/lt-lab-prices
```

### Create CLAUDE.md

This is the most important file — Claude Code reads it every session.

Create a file called `CLAUDE.md` in the project root with this content:

```markdown
# LT Blood Test Price Aggregator

## What this project is
A public Next.js website that scrapes blood test prices from Lithuanian lab
networks daily and shows them in one place so users can compare prices.
See full spec in docs/spec.md.

## Tech stack
- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL) for the database
- Firecrawl running locally at http://localhost:3002 for page fetching
- Anthropic Claude API claude-sonnet-4-20250514 for price extraction
- Fuse.js for fuzzy test name matching
- Tailwind CSS for styling
- GitHub Actions for daily scrape cron
- Vercel for hosting

## Key rules
- All scraper code lives in /scrapers/
- All DB access goes through /lib/db.ts only
- Never hardcode API keys — always use process.env
- TypeScript everywhere — no .js files
- Run npm run dev to start dev server on localhost:3000
- Firecrawl is local: http://localhost:3002 (must be running via Docker)

## Lab price list URLs
- Synlab: https://www.synlab.lt/tyrimai-ir-kainos
- Anteja: https://anteja.lt (find exact prices page)
- Affidea: https://www.affidea.lt (find exact prices page)
- Meliva: https://meliva.lt (find exact prices page)
- Rezus: https://rezus.lt (find exact prices page)

## Environment variables (in .env.local)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FIRECRAWL_API_URL=http://localhost:3002
FIRECRAWL_API_KEY=mylocalsecret123
ANTHROPIC_API_KEY
ADMIN_SECRET
```

### Create .env.local

Create `.env.local` in the project root and fill in your real keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FIRECRAWL_API_URL=http://localhost:3002
FIRECRAWL_API_KEY=mylocalsecret123
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_SECRET=choose-any-secret-password
```

### Copy the spec file
```bash
mkdir docs
# Copy spec file into docs/spec.md
# (copy lt-blood-test-aggregator-spec.md you downloaded earlier into docs/spec.md)
```

### Commit everything
```bash
git add CLAUDE.md docs/
git commit -m "add project spec and claude instructions"
git push
```

> ⚠️ `.env.local` is in `.gitignore` — it will NOT be pushed to GitHub. Good.

---

## STAGE 6 — Launch Claude Code and build

Make sure Firecrawl is running:
```bash
firecrawl-start
# wait 30 seconds, then confirm:
docker ps   # should show 5 firecrawl containers
```

Go to your project folder in VS Code terminal:
```bash
cd ~/Documents/lt-lab-prices
claude
```

Claude Code starts. You'll see a `>` prompt. Now paste this as your first message:

```
Read CLAUDE.md and docs/spec.md carefully. 

We're starting Phase 1. Do these tasks in order:

1. Scaffold a new Next.js 14 project here with TypeScript, Tailwind CSS, 
   and the App Router. Use `npx create-next-app@latest . --typescript 
   --tailwind --app --no-git` (we already have git set up).

2. Install these packages: @supabase/supabase-js @mendable/firecrawl-js 
   @anthropic-ai/sdk fuse.js

3. Create the folder structure: /scrapers/config, /scrapers/lib, 
   /scrapers/labs, /lib

4. Create /lib/db.ts with typed Supabase client and helper functions 
   for: getLabs, getCategories, upsertPrice, insertScrapeRun

5. Create /lib/db/schema.sql with the full database schema from 
   docs/spec.md

When done, run `npm run dev` and confirm it starts on localhost:3000.
```

Then just keep talking to it naturally from there.

---

## STAGE 7 — Your daily workflow

Every time you sit down to work:

```bash
# 1. Start Firecrawl (if not already running)
firecrawl-start

# 2. Open project in VS Code
cd ~/Documents/lt-lab-prices
code .

# 3. Start Claude Code in the VS Code terminal
claude
```

When you start a new Claude Code session after a break, always say:

```
Read CLAUDE.md. Here's where we are: [describe what you built last time 
and what you want to do today]
```

When you're done for the day:
```bash
# Stop Firecrawl to free up RAM
firecrawl-stop
```

---

## STAGE 8 — Checking your work as you build

### Check the UI
```bash
npm run dev
```
Open `http://localhost:3000` in Chrome. Keep this tab open while building.

When something looks wrong, tell Claude Code exactly what you see:
```
The homepage loads but the search bar is not centred — it's pushed to 
the left on desktop. Fix the layout.
```

### Check the scraper output
Tell Claude Code to run it and print results without touching the DB:
```
Run the Synlab scraper and console.log the extracted tests. 
Don't write to the database yet — I want to see the raw output first.
```

### Check the database
Go to your Supabase project → Table Editor and browse the `prices` table directly after a scrape.

### Fix errors
When you see a red error in the terminal, paste it to Claude Code:
```
Getting this error when I run the scraper: [paste full error]
Read the relevant file and fix it.
```

---

## Quick Reference Card

| Task | Command / Action |
|---|---|
| Start Claude Code | `claude` (from project folder) |
| Start Firecrawl | `firecrawl-start` |
| Stop Firecrawl | `firecrawl-stop` |
| Start dev server | `npm run dev` |
| View the app | `http://localhost:3000` |
| Check Firecrawl | `http://localhost:3002` |
| Commit progress | `git add . && git commit -m "description"` |
| Push to GitHub | `git push` |
| Check DB | Supabase dashboard → Table Editor |

---

## When something goes wrong

**Claude Code says it can't find a file:**
→ Make sure you ran `claude` from inside the project folder, not from home directory.

**Firecrawl returns errors:**
```bash
docker compose -f ~/firecrawl/docker-compose.yaml logs --tail=50
```

**npm run dev fails:**
→ Paste the error to Claude Code: `I got this error running npm run dev: [error]. Fix it.`

**Claude Code session feels lost / confused:**
→ Start a fresh session: type `exit`, then `claude` again, then re-read CLAUDE.md.

**Supabase connection fails:**
→ Double-check your `.env.local` keys match exactly what's in Supabase dashboard → Settings → API.

---

*You have three other documents for this project:*
- `docs/spec.md` — full technical specification
- `claude-code-workflow-guide.md` — detailed prompts and patterns for building
- This file — the setup checklist
