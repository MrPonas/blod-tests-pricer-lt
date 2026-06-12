/**
 * Claude-assisted batch review of unresolved pending_review items.
 * Matches them against canonical tests using AI, then:
 *   - Existing test: upserts price + adds alias + resolves pending item
 *   - Genuinely new: creates canonical test + upserts price + resolves
 *
 * Safe to re-run — only processes unresolved items.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getAI() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const BATCH_SIZE = 50;

async function reviewBatch(
  pending: { id: number; lab_id: number; raw_name: string; price_eur: number }[],
  canonicalTests: { id: number; canonical_name_lt: string; aliases: string[] }[]
): Promise<{ resolved: number; created: number }> {
  const canonicalList = canonicalTests
    .map((t) => `${t.id}: ${t.canonical_name_lt}`)
    .join('\n');

  const rawList = pending
    .map((p, i) => `${i}: ${p.raw_name}`)
    .join('\n');

  const prompt = `You are matching Lithuanian blood test names from different labs to a canonical list.

CANONICAL TESTS (id: name):
${canonicalList}

RAW SCRAPED NAMES (index: name):
${rawList}

For each raw name, determine if it matches a canonical test (same test, possibly different wording, abbreviation, or language).
Return ONLY valid JSON, no explanation:
{"matches":[{"index":0,"canonical_id":42},{"index":1,"canonical_id":null}]}

Rules:
- canonical_id: the matching canonical test id, or null if this is a genuinely new/different test
- Be conservative: only match if you are confident it is the same test
- Abbreviations count as matches (TSH = Skydliaukę stimuliuojantis hormonas, PSA = Prostatos specifinis antigenas, etc.)
- Packages/bundles (e.g. "ištyrimo programa") should be null unless an exact canonical match exists`;

  const response = await getAI().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  let matches: { index: number; canonical_id: number | null }[];

  try {
    matches = JSON.parse(text).matches;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Failed to parse Claude response: ${text.substring(0, 300)}`);
    matches = JSON.parse(m[0]).matches;
  }

  let resolved = 0;
  let created = 0;

  for (const { index, canonical_id } of matches) {
    const item = pending[index];
    if (!item) continue;

    let testId = canonical_id;

    if (!testId) {
      // Create new canonical test
      const { data: newTest, error } = await db
        .from('tests')
        .insert({ canonical_name_lt: item.raw_name.trim(), aliases: [] })
        .select('id')
        .single();
      if (error) { console.error(`Failed to create test "${item.raw_name}":`, error.message); continue; }
      testId = newTest.id;
      created++;
    }

    // Upsert price
    await db.from('prices').upsert({
      test_id: testId,
      lab_id: item.lab_id,
      price_eur: item.price_eur,
      lab_test_name: item.raw_name,
      scraped_at: new Date().toISOString(),
      is_stale: false,
    }, { onConflict: 'test_id,lab_id' });

    // Add alias if matching an existing test
    if (canonical_id) {
      await db.rpc('add_test_alias', { p_test_id: canonical_id, p_alias: item.raw_name });
    }

    // Resolve pending item
    await db.from('pending_review').update({ is_resolved: true, resolved_test_id: testId }).eq('id', item.id);
    resolved++;
  }

  return { resolved, created };
}

async function main() {
  const { data: pending, error } = await db
    .from('pending_review')
    .select('id, lab_id, raw_name, price_eur')
    .eq('is_resolved', false)
    .order('raw_name');

  if (error) throw error;
  if (!pending?.length) { console.log('No unresolved pending items.'); return; }

  console.log(`Processing ${pending.length} unresolved items in batches of ${BATCH_SIZE}...`);

  const { data: tests } = await db.from('tests').select('id, canonical_name_lt, aliases');
  const canonicalTests = tests ?? [];

  let totalResolved = 0;
  let totalCreated = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pending.length / BATCH_SIZE)}...`);
    const { resolved, created } = await reviewBatch(batch, canonicalTests);
    totalResolved += resolved;
    totalCreated += created;
    console.log(`  → ${resolved} resolved, ${created} new tests created`);
  }

  console.log(`\nDone: ${totalResolved} items resolved, ${totalCreated} new canonical tests created.`);
}

main().catch(console.error);
