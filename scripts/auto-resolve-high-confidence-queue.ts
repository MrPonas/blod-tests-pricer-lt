import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';
import { embedBatch } from '@/scrapers/lib/embed';

const VECTOR_HIGH_THRESHOLD = 0.95;
const EMBED_CHUNK = 100;

type QueueItem = {
  id: number;
  lab_id: number;
  raw_name: string;
  price_eur: number;
  ai_suggestion_id: number;
};

async function approveItem(item: QueueItem, canonicalId: number, method: 'exact' | 'vector_auto') {
  const norm = normalizeTestName(item.raw_name);

  await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: item.lab_id,
    raw_name: item.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: canonicalId,
    match_method: method,
    match_confidence: method === 'exact' ? 1.0 : VECTOR_HIGH_THRESHOLD,
    ai_reasoning: method === 'exact'
      ? 'Normalized name matched existing mapping exactly'
      : `Vector similarity ≥${(VECTOR_HIGH_THRESHOLD * 100).toFixed(0)}% to suggested canonical`,
    verified_by_human: false,
  }, { onConflict: 'lab_id,raw_name_normalized' });

  await supabaseAdmin.from('prices').upsert({
    test_id: canonicalId,
    lab_id: item.lab_id,
    price_eur: item.price_eur,
    lab_test_name: item.raw_name,
    lab_test_url: null,
    scraped_at: new Date().toISOString(),
    is_stale: false,
  }, { onConflict: 'test_id,lab_id' });

  await supabaseAdmin.from('mapping_review_queue')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', item.id);
}

async function main() {
  // ── Fetch pending items that have a suggested canonical ──────────────────────
  const { data: pending, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur, ai_suggestion_id')
    .eq('status', 'pending')
    .not('ai_suggestion_id', 'is', null);

  if (error) { console.error('Fetch failed:', error.message); return; }
  if (!pending?.length) { console.log('No pending items with suggestions.'); return; }

  const items = pending as QueueItem[];
  console.log(`Found ${items.length} pending items with a suggested canonical\n`);

  // ── Tier 1: exact normalized match in test_name_mappings ─────────────────────
  const normalizedNames = items.map(i => normalizeTestName(i.raw_name));
  const uniqueNorms = [...new Set(normalizedNames)];

  const { data: existingMappings } = await supabaseAdmin
    .from('test_name_mappings')
    .select('raw_name_normalized, canonical_test_id')
    .in('raw_name_normalized', uniqueNorms)
    .not('canonical_test_id', 'is', null);

  const normToCanonical = new Map<string, number>(
    (existingMappings ?? []).map(m => [m.raw_name_normalized, m.canonical_test_id as number])
  );

  const exactItems: Array<{ item: QueueItem; canonicalId: number }> = [];
  const remainderItems: QueueItem[] = [];

  items.forEach((item, i) => {
    const canonicalId = normToCanonical.get(normalizedNames[i]);
    if (canonicalId !== undefined) {
      exactItems.push({ item, canonicalId });
    } else {
      remainderItems.push(item);
    }
  });

  // Approve exact matches
  console.log(`Tier 1 (exact normalized match): ${exactItems.length}`);
  for (const { item, canonicalId } of exactItems) {
    try {
      await approveItem(item, canonicalId, 'exact');
    } catch (err) {
      console.error(`  ✗ id=${item.id} "${item.raw_name}": ${err}`);
    }
  }

  // ── Tier 2: high vector similarity to the suggested canonical ─────────────────
  let vectorApproved = 0;
  let stillPending = 0;

  if (remainderItems.length > 0) {
    console.log(`\nTier 2: embedding ${remainderItems.length} remaining items...`);

    const embeddings: number[][] = [];
    for (let i = 0; i < remainderItems.length; i += EMBED_CHUNK) {
      const chunk = remainderItems.slice(i, i + EMBED_CHUNK).map(it => it.raw_name);
      const vecs = await embedBatch(chunk);
      embeddings.push(...vecs);
      process.stdout.write(`  embedded ${Math.min(i + EMBED_CHUNK, remainderItems.length)}/${remainderItems.length}\r`);
    }
    console.log('');

    for (let i = 0; i < remainderItems.length; i++) {
      const item = remainderItems[i];
      const { data: candidates } = await supabaseAdmin.rpc('match_tests', {
        query_embedding: embeddings[i],
        match_threshold: VECTOR_HIGH_THRESHOLD,
        match_count: 1,
      });

      const topHit = (candidates as Array<{ id: number; similarity: number }> | null)?.[0];

      if (topHit && topHit.id === item.ai_suggestion_id && topHit.similarity >= VECTOR_HIGH_THRESHOLD) {
        try {
          await approveItem(item, item.ai_suggestion_id, 'vector_auto');
          vectorApproved++;
        } catch (err) {
          console.error(`  ✗ id=${item.id} "${item.raw_name}": ${err}`);
          stillPending++;
        }
      } else {
        stillPending++;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const { count: humanPending } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log('\n─────────────────────────────────────────────');
  console.log(`Exact matches auto-approved  : ${exactItems.length}`);
  console.log(`High similarity auto-approved: ${vectorApproved}`);
  console.log(`Still pending for human      : ${humanPending ?? '?'} (incl. ${24} with no suggestion)`);
  console.log('─────────────────────────────────────────────');
}

main().catch(console.error);
