# Mapping Agent Architecture

> Reference document for the test name mapping system.
> Claude Code should read this before modifying anything in `/scrapers/lib/` or `/workers/`.

---

## The problem this solves

Each lab uses different names for the same blood test:
- "Vitaminas D (25-OH)" / "Vit. D 25-hidroksi" / "25-OH vitaminas D" → same test
- "TSH" / "Tireotropinas" / "TTH" → same test
- "Gliukozė (serume)" / "Gliukozė (šlapime)" → **different tests** (different sample type)

String similarity (Fuse.js) cannot solve this — "TSH" and "Tireotropinas" have near-zero
string overlap. Medical synonym matching requires semantic embeddings.

---

## Two phases: bootstrap and ongoing

### Phase 0 — Bootstrap (run once, before first production scrape)

File: `scripts/bootstrap-canonical.ts`

1. Scrape all labs simultaneously — collect every raw test name across all labs
2. Batch-embed all names with Voyage AI `voyage-3` (~$0.02 for ~2000 names)
3. Cluster names by cosine similarity (threshold 0.88) — each cluster is a candidate canonical test
4. AI agent reviews each cluster:
   - Confirms all members are truly the same test
   - Names the canonical test (Lithuanian + English)
   - Assigns category
   - Flags clusters that need splitting (e.g. same analyte, different sample type)
5. Inserts canonical tests into `tests` table with embeddings
6. Saves all cluster members as confirmed mappings in `test_name_mappings`

After bootstrap, the canonical DB exists and daily scrapes can use it.

### Phase 1+ — Ongoing (daily scrape)

Split into two separate jobs:

**Job 1: Scraper** (`scrapers/run-all.ts`)
- Fetches pages, extracts raw names + prices
- Cache lookup per name → HIT: upsert price | MISS: enqueue in `mapping_jobs`
- Always exits fast

**Job 2: Mapping worker** (`workers/process-mapping-jobs.ts`)
- Runs after scraper finishes (GitHub Actions `workflow_run` trigger)
- Processes `mapping_jobs` queue
- Writes results back to `test_name_mappings` + `prices`

---

## Database schema additions

Add these to `lib/db/schema.sql` in addition to the base schema from `docs/spec.sql`:

```sql
-- Enable pgvector (run once in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to canonical tests table
ALTER TABLE tests ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE tests ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20) UNIQUE;

-- Full-text search vector (auto-maintained)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', canonical_name_lt || ' ' || COALESCE(canonical_name_en, '') || ' ' || COALESCE(array_to_string(aliases, ' '), ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS tests_embedding_idx ON tests
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS tests_search_vector_idx ON tests USING GIN(search_vector);

-- Permanent mapping cache: vendor raw name → canonical test
-- This is what makes daily scrapes nearly free after bootstrap
CREATE TABLE IF NOT EXISTS test_name_mappings (
  id                   SERIAL PRIMARY KEY,
  lab_id               INTEGER NOT NULL REFERENCES labs(id),
  raw_name             VARCHAR(500) NOT NULL,
  raw_name_normalized  VARCHAR(500) NOT NULL,
  canonical_test_id    INTEGER REFERENCES tests(id),
  match_method         VARCHAR(20) NOT NULL,
  -- match_method values:
  --   'bootstrap_cluster' — confirmed during bootstrap clustering
  --   'exact'             — exact string match after normalization
  --   'vector_auto'       — cosine similarity ≥ 0.94, auto-accepted
  --   'ai_agent'          — agent called map_to_existing, confidence ≥ 0.85
  --   'ai_created'        — agent created a new canonical entry
  --   'ai_confirmed'      — agent suggestion approved by human admin
  --   'manual'            — admin mapped directly without AI suggestion
  match_confidence     NUMERIC(4,3),
  ai_reasoning         TEXT,
  verified_by_human    BOOLEAN DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(lab_id, raw_name_normalized)  -- never re-process the same name
);

-- Job queue: raw names the scraper couldn't resolve from cache
CREATE TABLE IF NOT EXISTS mapping_jobs (
  id           SERIAL PRIMARY KEY,
  lab_id       INTEGER NOT NULL REFERENCES labs(id),
  raw_name     VARCHAR(500) NOT NULL,
  price_eur    NUMERIC(8,2),
  lab_test_url TEXT,
  status       VARCHAR(20) DEFAULT 'pending',
  -- status values: 'pending' | 'processing' | 'done' | 'failed'
  claimed_at   TIMESTAMP,    -- set when worker picks up the job
  finished_at  TIMESTAMP,
  error        TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Human review queue: low-confidence agent decisions
CREATE TABLE IF NOT EXISTS mapping_review_queue (
  id                SERIAL PRIMARY KEY,
  lab_id            INTEGER NOT NULL REFERENCES labs(id),
  raw_name          VARCHAR(500) NOT NULL,
  price_eur         NUMERIC(8,2),
  ai_suggestion_id  INTEGER REFERENCES tests(id),
  ai_confidence     NUMERIC(4,3),
  ai_reasoning      TEXT,
  status            VARCHAR(20) DEFAULT 'pending',
  -- status values: 'pending' | 'approved' | 'rejected' | 'new_test' | 'skipped'
  reviewed_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Vector similarity search function (called via supabase.rpc)
CREATE OR REPLACE FUNCTION match_tests(
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
RETURNS TABLE (id int, canonical_name_lt text, canonical_name_en text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    canonical_name_lt,
    canonical_name_en,
    1 - (embedding <=> query_embedding) AS similarity
  FROM tests
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

---

## File: `scrapers/lib/embed.ts`

```typescript
// Voyage AI embeddings — voyage-3 is strong on medical/scientific text

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage AI error ${response.status}: ${err}`);
  }

  const data = await response.json();
  // Sort by index to guarantee order matches input
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding);
}
```

---

## File: `scrapers/lib/normalize.ts`

```typescript
// Pure string normalization — no API calls, no cost
// Gets you most of the way before embedding is needed

const LT_DIACRITICS: Record<string, string> = {
  'ą':'a','č':'c','ę':'e','ė':'e','į':'i','š':'s','ų':'u','ū':'u','ž':'z',
  'Ą':'a','Č':'c','Ę':'e','Ė':'e','Į':'i','Š':'s','Ų':'u','Ū':'u','Ž':'z',
};

const KNOWN_EXPANSIONS: Record<string, string> = {
  'vit\\.': 'vitaminas',
  '\\bvit\\b': 'vitaminas',
  '\\btsh\\b': 'tireotropinas',
  '\\btth\\b': 'tireotropinas',
  '\\bkla\\b': 'kraujo bendra analize',
  '\\bbka\\b': 'kraujo bendra analize',
  '\\boam\\b': 'slapimo bendra analize',
  '\\bcrp\\b': 'c reaktyvusis baltymas',
  '25-oh': '25 hidroksivitaminas',
  '25-hidroksi': '25 hidroksivitaminas',
};

// Procedural noise words that don't help matching
const NOISE_TOKENS = new Set([
  'tyrimas', 'nustatymas', 'kiekybinis', 'kokybinis',
  'be pvm', 'su pvm', 'kaina',
]);

export function normalizeTestName(raw: string): string {
  let s = raw.toLowerCase().trim();

  // Replace Lithuanian diacritics
  s = s.replace(/[ąčęėįšųūž]/gi, c => LT_DIACRITICS[c] ?? c);

  // Expand known abbreviations (order matters — longer patterns first)
  for (const [pattern, expansion] of Object.entries(KNOWN_EXPANSIONS)) {
    s = s.replace(new RegExp(pattern, 'gi'), expansion);
  }

  // Remove purely procedural qualifiers in parentheses
  s = s.replace(/\((be nuorodos|ambulatorinis|skubus|papildomas|pirminis)\)/gi, '');

  // Normalize punctuation and whitespace
  s = s.replace(/[.,\-\/\\()\[\]]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // Remove noise tokens
  s = s.split(' ').filter(t => !NOISE_TOKENS.has(t)).join(' ');

  return s;
}
```

---

## File: `scrapers/lib/mapping-agent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Langfuse } from 'langfuse';
import { supabaseAdmin } from '@/lib/db';
import { embedText } from './embed';

const anthropic = new Anthropic();
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  host: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
});

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_canonical_tests',
    description: 'Search the canonical test database by name, abbreviation, or medical concept. Use this to find candidates before deciding. You can search in Lithuanian, English, or use abbreviations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query — Lithuanian name, English name, abbreviation, or LOINC code',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_test_details',
    description: 'Get full details of a canonical test including all known aliases from all labs. Use this to verify a candidate before committing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        canonical_id: { type: 'number' },
      },
      required: ['canonical_id'],
    },
  },
  {
    name: 'map_to_existing',
    description: 'Confirm this raw name maps to an existing canonical test. Call this when confident.',
    input_schema: {
      type: 'object' as const,
      properties: {
        canonical_id: { type: 'number' },
        confidence: {
          type: 'number',
          description: '0.0 to 1.0 — your confidence this is the correct canonical test',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why this is a match',
        },
      },
      required: ['canonical_id', 'confidence', 'reasoning'],
    },
  },
  {
    name: 'create_new_canonical',
    description: 'Create a new canonical test entry when this test genuinely does not exist in the database. Only use this after searching and confirming no match exists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        canonical_name_lt: {
          type: 'string',
          description: 'Full standard Lithuanian medical name',
        },
        canonical_name_en: {
          type: 'string',
          description: 'Full standard English medical name',
        },
        category: {
          type: 'string',
          enum: ['hormones', 'vitamins', 'biochemistry', 'haematology', 'infections', 'allergy', 'tumour_markers', 'urinalysis', 'other'],
        },
        aliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'All known name variants for this test including the raw name being processed',
        },
      },
      required: ['canonical_name_lt', 'category'],
    },
  },
  {
    name: 'flag_for_human',
    description: 'Flag this case for human review. Use when genuinely unsure — e.g. same analyte but possibly different sample type, or a rare specialised test.',
    input_schema: {
      type: 'object' as const,
      properties: {
        candidate_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Canonical IDs that are plausible matches (empty if no candidates)',
        },
        reason: {
          type: 'string',
          description: 'Clear explanation of why you are unsure',
        },
      },
      required: ['reason'],
    },
  },
];

const SYSTEM_PROMPT = `
You are a Lithuanian medical laboratory test classification expert.

Your domain knowledge:
- Lithuanian medical terminology and abbreviations:
  TSH / TTH = Tireotropinas, OAM = Šlapimo bendroji analizė,
  KLA / BKA = Kraujo bendroji analizė, CRB = C reaktyvusis baltymas,
  Vit. / Vit = Vitaminas, 25-OH = 25-hidroksivitaminas
- Sample type distinctions matter clinically:
  "Gliukozė (serume)" and "Gliukozė (šlapime)" are DIFFERENT tests
  When sample type differs, flag for human review
- LOINC codes (if provided by the lab) are definitive — match on LOINC first
- Quantitative vs qualitative variants are different products:
  "Anti-TPO" (titer value) vs "Anti-TPO aptikimas" (positive/negative) differ
- Combined panels: "+" suffix or slash-separated names group multiple tests

Decision rules:
1. Search before deciding — always check candidates with search_canonical_tests
2. If top vector candidate has similarity > 0.94, verify with get_test_details then confirm
3. If genuinely the same analyte + same sample type → map_to_existing
4. If this test is not in the database after searching → create_new_canonical
5. If unsure about sample type or clinical distinction → flag_for_human
6. Do not create duplicates — always search first
`.trim();

// ── Tool execution ────────────────────────────────────────────────────────────

interface JobContext {
  labId: number;
  labName: string;
  rawName: string;
  priceEur: number;
  labTestUrl?: string | null;
}

const TERMINAL_TOOLS = new Set(['map_to_existing', 'create_new_canonical', 'flag_for_human']);

async function executeTool(
  toolName: string,
  input: Record<string, any>,
  ctx: JobContext
): Promise<{ result: any; isTerminal: boolean }> {
  switch (toolName) {

    case 'search_canonical_tests': {
      const embedding = await embedText(input.query);
      const { data } = await supabaseAdmin.rpc('match_tests', {
        query_embedding: embedding,
        match_threshold: 0.55,
        match_count: input.limit ?? 5,
      });
      return { result: data ?? [], isTerminal: false };
    }

    case 'get_test_details': {
      const { data } = await supabaseAdmin
        .from('tests')
        .select(`
          id, canonical_name_lt, canonical_name_en, aliases, loinc_code,
          categories ( name_lt )
        `)
        .eq('id', input.canonical_id)
        .single();
      return { result: data ?? { error: 'not found' }, isTerminal: false };
    }

    case 'map_to_existing': {
      const normalized = (await import('./normalize')).normalizeTestName(ctx.rawName);
      await supabaseAdmin.from('test_name_mappings').upsert({
        lab_id: ctx.labId,
        raw_name: ctx.rawName,
        raw_name_normalized: normalized,
        canonical_test_id: input.canonical_id,
        match_method: input.confidence >= 0.85 ? 'ai_agent' : 'ai_agent_low',
        match_confidence: input.confidence,
        ai_reasoning: input.reasoning,
        verified_by_human: false,
      }, { onConflict: 'lab_id,raw_name_normalized' });

      if (input.confidence >= 0.85) {
        await supabaseAdmin.from('prices').upsert({
          test_id: input.canonical_id,
          lab_id: ctx.labId,
          price_eur: ctx.priceEur,
          lab_test_name: ctx.rawName,
          lab_test_url: ctx.labTestUrl ?? null,
          scraped_at: new Date().toISOString(),
          is_stale: false,
        }, { onConflict: 'test_id,lab_id' });
      } else {
        // Low confidence — save mapping but queue for review
        await supabaseAdmin.from('mapping_review_queue').insert({
          lab_id: ctx.labId,
          raw_name: ctx.rawName,
          price_eur: ctx.priceEur,
          ai_suggestion_id: input.canonical_id,
          ai_confidence: input.confidence,
          ai_reasoning: input.reasoning,
          status: 'pending',
        });
      }
      return { result: { success: true }, isTerminal: true };
    }

    case 'create_new_canonical': {
      const { embedText: embed } = await import('./embed');
      const embedding = await embed(input.canonical_name_lt);
      const { data: newTest, error } = await supabaseAdmin
        .from('tests')
        .insert({
          canonical_name_lt: input.canonical_name_lt,
          canonical_name_en: input.canonical_name_en ?? null,
          aliases: input.aliases ?? [ctx.rawName],
          embedding,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create canonical test: ${error.message}`);

      const normalized = (await import('./normalize')).normalizeTestName(ctx.rawName);
      await supabaseAdmin.from('test_name_mappings').upsert({
        lab_id: ctx.labId,
        raw_name: ctx.rawName,
        raw_name_normalized: normalized,
        canonical_test_id: newTest.id,
        match_method: 'ai_created',
        match_confidence: 0.99,
        ai_reasoning: `Agent created new canonical: ${input.canonical_name_lt}`,
        verified_by_human: false,
      }, { onConflict: 'lab_id,raw_name_normalized' });

      await supabaseAdmin.from('prices').upsert({
        test_id: newTest.id,
        lab_id: ctx.labId,
        price_eur: ctx.priceEur,
        lab_test_name: ctx.rawName,
        lab_test_url: ctx.labTestUrl ?? null,
        scraped_at: new Date().toISOString(),
        is_stale: false,
      }, { onConflict: 'test_id,lab_id' });

      return { result: { success: true, new_canonical_id: newTest.id }, isTerminal: true };
    }

    case 'flag_for_human': {
      await supabaseAdmin.from('mapping_review_queue').insert({
        lab_id: ctx.labId,
        raw_name: ctx.rawName,
        price_eur: ctx.priceEur,
        ai_suggestion_id: input.candidate_ids?.[0] ?? null,
        ai_confidence: 0,
        ai_reasoning: input.reason,
        status: 'pending',
      });
      return { result: { success: true }, isTerminal: true };
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` }, isTerminal: false };
  }
}

// ── Main agent function ───────────────────────────────────────────────────────

export async function runMappingAgent(
  ctx: JobContext,
  initialCandidates: Array<{ id: number; canonical_name_lt: string; similarity: number }>
): Promise<void> {
  const trace = langfuse.trace({
    name: 'mapping-agent',
    input: { raw_name: ctx.rawName, lab: ctx.labName },
    metadata: { lab_id: ctx.labId },
  });

  const candidateList = initialCandidates.length > 0
    ? initialCandidates
        .map(c => `  - ID ${c.id}: "${c.canonical_name_lt}" (${(c.similarity * 100).toFixed(0)}% similarity)`)
        .join('\n')
    : '  (none above 55% similarity threshold)';

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `
Lab: ${ctx.labName}
Raw test name to classify: "${ctx.rawName}"
Price: €${ctx.priceEur}

Top semantic candidates from our database:
${candidateList}

Classify this test name. Use search_canonical_tests to explore if needed.
    `.trim(),
  }];

  const generation = trace.generation({
    name: 'agent-loop',
    model: 'claude-sonnet-4-20250514',
    input: messages,
  });

  try {
    for (let step = 0; step < 10; step++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === 'end_turn') break;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      if (toolUseBlocks.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let terminated = false;

      for (const block of toolUseBlocks) {
        const { result, isTerminal } = await executeTool(block.name, block.input as Record<string, any>, ctx);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
        if (isTerminal) terminated = true;
      }

      messages.push({ role: 'user', content: toolResults });
      if (terminated) break;
    }

    generation.end({ output: 'completed' });
    trace.update({ output: { status: 'done' } });
  } catch (err) {
    generation.end({ output: String(err), level: 'ERROR' });
    trace.update({ output: { status: 'error', error: String(err) } });
    throw err;
  } finally {
    await langfuse.flushAsync();
  }
}
```

---

## File: `scrapers/lib/mapper.ts`

```typescript
import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from './normalize';
import { embedText } from './embed';
import { runMappingAgent } from './mapping-agent';

export interface RawTest {
  name: string;
  price_eur: number;
  url?: string | null;
}

interface Lab {
  id: number;
  name: string;
  slug: string;
}

export async function mapAndUpsertTests(
  rawTests: RawTest[],
  lab: Lab
): Promise<{ matched: number; queued: number }> {
  let matched = 0;
  let queued = 0;

  for (const raw of rawTests) {
    const normalized = normalizeTestName(raw.name);

    // ── Tier 1: Mapping cache (free, instant) ─────────────────────────────
    const { data: cached } = await supabaseAdmin
      .from('test_name_mappings')
      .select('canonical_test_id')
      .eq('lab_id', lab.id)
      .eq('raw_name_normalized', normalized)
      .not('canonical_test_id', 'is', null)
      .maybeSingle();

    if (cached?.canonical_test_id) {
      await upsertPrice(cached.canonical_test_id, lab.id, raw);
      matched++;
      continue;
    }

    // ── Tier 2: Vector similarity search ──────────────────────────────────
    const embedding = await embedText(raw.name);
    const { data: candidates } = await supabaseAdmin.rpc('match_tests', {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 5,
    });

    const topMatch = candidates?.[0];

    if (topMatch && topMatch.similarity >= 0.94) {
      // High-confidence vector match — auto-accept
      await supabaseAdmin.from('test_name_mappings').upsert({
        lab_id: lab.id,
        raw_name: raw.name,
        raw_name_normalized: normalized,
        canonical_test_id: topMatch.id,
        match_method: 'vector_auto',
        match_confidence: topMatch.similarity,
        verified_by_human: false,
      }, { onConflict: 'lab_id,raw_name_normalized' });

      await upsertPrice(topMatch.id, lab.id, raw);
      matched++;
      continue;
    }

    // ── Tier 3: Enqueue for mapping worker ────────────────────────────────
    // Do NOT call the agent here — the scraper stays fast
    await supabaseAdmin.from('mapping_jobs').insert({
      lab_id: lab.id,
      raw_name: raw.name,
      price_eur: raw.price_eur,
      lab_test_url: raw.url ?? null,
      status: 'pending',
    });
    queued++;
  }

  return { matched, queued };
}

async function upsertPrice(testId: number, labId: number, raw: RawTest) {
  const { error } = await supabaseAdmin.from('prices').upsert({
    test_id: testId,
    lab_id: labId,
    price_eur: raw.price_eur,
    lab_test_name: raw.name,
    lab_test_url: raw.url ?? null,
    scraped_at: new Date().toISOString(),
    is_stale: false,
  }, { onConflict: 'test_id,lab_id' });

  if (error) console.error('Price upsert failed:', error.message);
}
```

---

## File: `workers/process-mapping-jobs.ts`

```typescript
import { supabaseAdmin } from '@/lib/db';
import { embedText } from '@/scrapers/lib/embed';
import { runMappingAgent } from '@/scrapers/lib/mapping-agent';

const BATCH_SIZE = 20;

async function main() {
  console.log('Mapping worker started');
  let totalProcessed = 0;

  while (true) {
    // Atomically claim a batch — prevents double-processing if worker is re-run
    const { data: jobs, error } = await supabaseAdmin
      .from('mapping_jobs')
      .update({
        status: 'processing',
        claimed_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .is('claimed_at', null)
      .limit(BATCH_SIZE)
      .select('*, labs(id, name, slug)');

    if (error) {
      console.error('Failed to claim jobs:', error.message);
      break;
    }

    if (!jobs || jobs.length === 0) {
      console.log(`Queue empty. Total processed: ${totalProcessed}`);
      break;
    }

    console.log(`Processing batch of ${jobs.length} jobs...`);

    for (const job of jobs) {
      try {
        const lab = job.labs as { id: number; name: string; slug: string };

        // Get top vector candidates to give agent a head start
        const embedding = await embedText(job.raw_name);
        const { data: candidates } = await supabaseAdmin.rpc('match_tests', {
          query_embedding: embedding,
          match_threshold: 0.65,
          match_count: 5,
        });

        await runMappingAgent(
          {
            labId: lab.id,
            labName: lab.name,
            rawName: job.raw_name,
            priceEur: job.price_eur,
            labTestUrl: job.lab_test_url,
          },
          candidates ?? []
        );

        await supabaseAdmin
          .from('mapping_jobs')
          .update({ status: 'done', finished_at: new Date().toISOString() })
          .eq('id', job.id);

        totalProcessed++;
        console.log(`  ✓ ${job.raw_name} (${lab.name})`);

        // Brief pause between jobs — polite to APIs
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`  ✗ Job ${job.id} (${job.raw_name}):`, err);
        await supabaseAdmin
          .from('mapping_jobs')
          .update({
            status: 'failed',
            error: String(err),
            finished_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
```

---

## File: `.github/workflows/process-mappings.yml`

```yaml
name: Process Mapping Jobs

on:
  workflow_run:
    workflows: ["Daily Price Scrape"]
    types: [completed]
  workflow_dispatch:   # Allow manual trigger from GitHub UI

jobs:
  map:
    runs-on: ubuntu-latest
    # Run even if scrape partially failed — process whatever was queued
    if: ${{ github.event.workflow_run.conclusion != 'cancelled' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Process mapping queue
        run: npx tsx workers/process-mapping-jobs.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          VOYAGE_API_KEY: ${{ secrets.VOYAGE_API_KEY }}
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
```

---

## File: `scripts/bootstrap-canonical.ts`

> Run this ONCE before the first production scrape.
> It builds the canonical test database from scratch by clustering all lab names.

```typescript
import { supabaseAdmin } from '@/lib/db';
import { embedBatch, embedText } from '@/scrapers/lib/embed';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface RawScrapedTest {
  id: number;
  lab_id: number;
  lab_name: string;
  name: string;
  price_eur: number;
  embedding?: number[];
}

// Simple cosine similarity
function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}

// Group names into clusters where every pair has similarity >= threshold
function clusterBySimilarity(
  tests: RawScrapedTest[],
  threshold: number
): RawScrapedTest[][] {
  const used = new Set<number>();
  const clusters: RawScrapedTest[][] = [];

  for (let i = 0; i < tests.length; i++) {
    if (used.has(i)) continue;
    const cluster: RawScrapedTest[] = [tests[i]];
    used.add(i);

    for (let j = i + 1; j < tests.length; j++) {
      if (used.has(j)) continue;
      if (!tests[i].embedding || !tests[j].embedding) continue;

      const sim = cosineSim(tests[i].embedding!, tests[j].embedding!);
      if (sim >= threshold) {
        cluster.push(tests[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

async function main() {
  console.log('Bootstrap: collecting all raw scraped test names...');

  // Assumes you have already run all scrapers once with raw_scraped_tests table
  // OR: replace this with direct scraping of all labs
  const { data: allRaw } = await supabaseAdmin
    .from('raw_scraped_tests')
    .select('id, lab_id, labs(name), name, price_eur');

  const tests: RawScrapedTest[] = (allRaw ?? []).map((r: any) => ({
    id: r.id,
    lab_id: r.lab_id,
    lab_name: r.labs?.name ?? 'Unknown',
    name: r.name,
    price_eur: r.price_eur,
  }));

  console.log(`Found ${tests.length} raw test names. Embedding...`);

  // Batch embed all names (~$0.02 for 2000 names)
  const CHUNK = 100;
  for (let i = 0; i < tests.length; i += CHUNK) {
    const chunk = tests.slice(i, i + CHUNK);
    const embeddings = await embedBatch(chunk.map(t => t.name));
    chunk.forEach((t, j) => { t.embedding = embeddings[j]; });
    console.log(`  Embedded ${Math.min(i + CHUNK, tests.length)}/${tests.length}`);
  }

  console.log('Clustering...');
  const clusters = clusterBySimilarity(tests, 0.88);
  console.log(`Found ${clusters.length} candidate canonical tests`);

  // Review each cluster with AI
  let created = 0;
  let queued = 0;

  for (const cluster of clusters) {
    // Single-occurrence rare tests → queue for human
    if (cluster.length === 1) {
      await supabaseAdmin.from('mapping_review_queue').insert({
        lab_id: cluster[0].lab_id,
        raw_name: cluster[0].name,
        price_eur: cluster[0].price_eur,
        ai_reasoning: 'Single occurrence — no cross-lab confirmation',
        status: 'pending',
      });
      queued++;
      continue;
    }

    const memberList = cluster
      .map(m => `  - "${m.name}" (${m.lab_name})`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `
You are a Lithuanian medical laboratory expert.
These test names from different labs were clustered as likely the same test:

${memberList}

1. Are all of these truly the same test (same analyte + same sample type)?
   If some should be split, list their indices (0-based).
2. Standard Lithuanian canonical name
3. Standard English canonical name
4. Category: hormones | vitamins | biochemistry | haematology | infections | allergy | tumour_markers | urinalysis | other
5. Aliases list (all variants above)

Return ONLY valid JSON:
{
  "is_single_test": true,
  "split_indices": [],
  "canonical_name_lt": "Vitaminas D (25-OH)",
  "canonical_name_en": "Vitamin D (25-hydroxyvitamin D)",
  "category": "vitamins",
  "aliases": ["Vit. D 25-OH", "25-hidroksi vitaminas D"]
}
        `.trim(),
      }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const canonical = JSON.parse(raw.replace(/```json|```/g, '').trim());

      if (!canonical.is_single_test) {
        // Needs splitting — queue all members for human review
        for (const member of cluster) {
          await supabaseAdmin.from('mapping_review_queue').insert({
            lab_id: member.lab_id,
            raw_name: member.name,
            price_eur: member.price_eur,
            ai_reasoning: `Cluster needs splitting: ${JSON.stringify(canonical.split_indices)}`,
            status: 'pending',
          });
        }
        queued += cluster.length;
        continue;
      }

      // Insert canonical test with embedding
      const embedding = await embedText(canonical.canonical_name_lt);
      const { data: newTest } = await supabaseAdmin.from('tests').insert({
        canonical_name_lt: canonical.canonical_name_lt,
        canonical_name_en: canonical.canonical_name_en ?? null,
        aliases: canonical.aliases ?? [],
        embedding,
      }).select().single();

      // Save all cluster members as confirmed mappings
      for (const member of cluster) {
        const { normalizeTestName } = await import('@/scrapers/lib/normalize');
        await supabaseAdmin.from('test_name_mappings').upsert({
          lab_id: member.lab_id,
          raw_name: member.name,
          raw_name_normalized: normalizeTestName(member.name),
          canonical_test_id: newTest.id,
          match_method: 'bootstrap_cluster',
          match_confidence: 0.95,
          verified_by_human: false,
        }, { onConflict: 'lab_id,raw_name_normalized' });
      }

      created++;
      if (created % 20 === 0) console.log(`  Created ${created} canonical tests...`);

    } catch (err) {
      console.error(`Failed to process cluster:`, cluster[0].name, err);
    }

    // Brief pause — polite to the API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Bootstrap complete: ${created} canonical tests created, ${queued} queued for review`);
}

main().catch(console.error);
```

---

## New packages to install

```bash
npm install langfuse
# voyageai — use raw fetch (already in embed.ts above), no SDK needed
# @anthropic-ai/sdk and @supabase/supabase-js already installed
```

Remove if present:
```bash
npm uninstall fuse.js
```

---

## Observability: Langfuse

Sign up free at [cloud.langfuse.com](https://cloud.langfuse.com).
Get `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` from your project settings.
Add both to `.env.local` and GitHub Actions secrets.

Every agent run appears in the Langfuse dashboard with:
- Input raw name and lab
- All tool calls made and their results
- Final decision (mapped/created/flagged)
- Token usage and cost per run

This is how you audit the system over time and catch when the agent starts
making strange decisions.

---

## Hard mapping rules

File: `scrapers/lib/hard-rules.ts`  
Entry point: `applyHardRules(rawName, candidateName, similarity?)`  
Returns: `'create_new' | 'safe_to_merge' | 'needs_ai'`

These rules encode domain knowledge that the AI can get wrong and that caused 179 items to land in the human review queue. They run deterministically, in order, with no API calls.

### Where they're called

**`scrapers/lib/mapper.ts`** — after the vector search returns candidates, before the auto-commit / enqueue decision:
- `safe_to_merge` → commit directly with `match_method='hard_rule'`; never reaches AI
- `create_new` → enqueue to `mapping_jobs`; worker will also apply rules and skip the AI
- `needs_ai` → fall through to the existing 0.94-threshold auto-accept or enqueue

**`workers/process-mapping-jobs.ts`** — in the duplicate safety net, after the AI decides to `create` a new canonical:
- Embeds the proposed name and searches for near-duplicates (≥0.88)
- Calls `applyHardRules(proposedName, nearDuplicateName)` to decide whether to flag
- `create_new` → hard rule confirms they're genuinely different; let create proceed
- `safe_to_merge` or `needs_ai` → flag for human review

### The rules (first match wins)

| # | Rule | Signal | Result |
|---|------|---------|--------|
| 9 | **Same normalized name** | `normalizeTestName(raw) === normalizeTestName(candidate)` | `safe_to_merge` |
| 8 | **Rezus pipe format** | `raw` contains `" | "` AND `similarity ≥ 0.85` | `safe_to_merge` |
| 1 | **Antibody class** | IgG/IgM/IgA/IgE/IgD differ between raw and candidate | `create_new` |
| 2 | **Pathogen count** | "X sukėlėjų" vs "Y sukėlėjų" where X ≠ Y | `create_new` |
| 7 | **LPI panel sample type** | LPI/LPL panel: one has "šlapime", other doesn't | `create_new` |
| 3 | **Sample type** | šlapime↔serume, šlapime↔plazmoje, serume↔plazmoje, nuograndų↔šlapimo | `create_new` |
| 3b | **Asymmetric sample type** | one name has explicit sample qualifier, other doesn't | `needs_ai` |
| 4 | **Vitamin B number** | B1/B2/B6/B12 etc. differ | `create_new` |
| 5 | **Panel size (children)** | "X vaikai" vs "Y vaikai" where X ≠ Y | `create_new` |
| 6 | **Positional qualifier conflict** | both raw and candidate have qualifiers, but they differ | `create_new` |
| 10 | **Missing qualifier rule** | raw has NO qualifier, candidate has one (stovint, gulint, ramybėje, po apkrovos, po provokacijos, nevalgius, po valgio, paros, kapiliarinis) | `needs_ai` → flag_for_human |
| 12 | **Pathogen species mismatch** | same genus (Mycoplasma/Chlamydia/Ureaplasma/Neisseria/Trichomonas/Gardnerella) but different species (hominis vs genitalium, trachomatis vs pneumoniae) | `create_new` |
| 11a | **Typo / edit distance** | normalized names differ by ≤ 2 characters (Levenshtein) | `safe_to_merge` |
| 11b | **Word-order / redundant prefix** | same meaningful token set (or one is a strict subset with ≤ 2 non-sample-type extras) | `safe_to_merge` |

### Reasoning

- **Rule 1 (IgClass)**: IgG/IgM/IgA test different biological phenomena. "Candida IgG" and "Candida IgM" are distinct tests. Before this rule the duplicate safety net was incorrectly flagging these as the same test, causing 32 human reviews.
- **Rule 2 (Pathogen count)**: A 7-pathogen STI panel and a 4-pathogen panel are different products even if the lab names are otherwise similar.
- **Rule 3 & 7 (Sample type / LPI)**: Blood serum, urine, and swab samples measure different things. "Gliukozė serume" and "Gliukozė šlapime" are separate clinical tests. Rule 7 is LPI-specific because LPI panels without an explicit sample marker default to swab/genital, not urine.
- **Rule 4 (Vitamin B)**: Each B vitamin is a distinct analyte. B6 deficiency requires B6 measurement; B12 deficiency requires B12. Merging them would show wrong prices for a different test.
- **Rule 5 (Children count)**: DNA paternity tests for "2 vaikai" and "3 vaikai" are different products with different pricing.
- **Rule 6 (Positional qualifier conflict)**: Aldosterone measured standing vs. lying differs by 2–3× due to renin-angiotensin response. Mapping them together would show a lab's standing-position price against another lab's resting price.
- **Rule 8 (Pipe format)**: Rezus always formats names as "ABR | Full Name". The full name after `" | "` reliably identifies the canonical test. High similarity (≥0.85) confirms it's not a prefix coincidence.
- **Rule 9 (Normalized match)**: If names normalize to the same string, no AI call needed.
- **Rule 10 (Missing qualifier)**: "ALD Aldosteronas" was auto-mapped to "Aldosteronas (stovint)" when the correct canonical was "Aldosteronas (ramybėje)". Without the lab's full test description, the system cannot know which positional variant is correct. Any unqualified raw name matched against a qualifier-bearing candidate must be sent to human review, never auto-committed. Qualifiers covered: stovint, gulint, ramybėje, judant, rytinis, vakarinis, po apkrovos, po provokacijos, nevalgius, po valgio, paros, kapiliarinis.
- **Rule 11 (Typo / word-order)**: Catches genuine duplicates that differ only by spelling typo (Toxocora→Toxocara, Filochinonas→Filokinonas) or word order ("CRB didelio jautrumo" vs "Didelio jautrumo CRB"). Levenshtein ≤ 2 handles typos; token-set equality handles word order. Extra tokens are allowed only if they don't include sample-type words (to prevent merging serum and urine variants).
- **Rule 12 (Pathogen species)**: Mycoplasma hominis and Mycoplasma genitalium are different organisms detected by different PCR primers; they must not be merged even though "Mycoplasma ... DNR (PGR)" names have very high vector similarity (~0.87). Rule applies to Mycoplasma, Chlamydia, Ureaplasma, Neisseria, Trichomonas, Gardnerella — all genera with clinically distinct species offered by Lithuanian labs.

### Estimated impact

Of the 179 items that required manual review in the first production mapping run:
- ~60 had pipe format (`" | "`) → Rule 8 would auto-commit all of them
- ~32 had IgClass mismatch → Rule 1 would let the AI create them without flagging
- ~15–20 had sample type or pathogen count differences → Rules 2, 3, 7 would catch them

**~110 of 179 (~62%) would not have reached the human review queue** with these rules in place.

---

## Decision log: why these choices

| Decision | Why |
|---|---|
| Voyage AI `voyage-3` for embeddings | Stronger than OpenAI ada-002 on medical/scientific text; cheaper per token |
| pgvector in Supabase | No extra infra — uses your existing DB; cosine search handles synonyms that string matching can't |
| Anthropic SDK tool use directly | No LangChain/LlamaIndex abstraction needed — tool use loop is 20 lines; frameworks add complexity without benefit at this scale |
| Queue-decoupled worker | Scraper exits fast and reliably; worker can retry failed jobs independently |
| Langfuse for observability | Production-grade agent tracing without building a dashboard yourself |
| Bootstrap clustering | Builds canonical DB from real data instead of hand-writing 500+ test names |
