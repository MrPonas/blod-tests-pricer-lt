import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from './normalize';
import { embedText } from './embed';
import { applyHardRules } from './hard-rules';

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

    // ── Hard rules: deterministic pre-filters before AI ───────────────────
    if (topMatch) {
      const rule = applyHardRules(raw.name, topMatch.canonical_name_lt, topMatch.similarity);

      if (rule === 'safe_to_merge') {
        await supabaseAdmin.from('test_name_mappings').upsert({
          lab_id: lab.id,
          raw_name: raw.name,
          raw_name_normalized: normalized,
          canonical_test_id: topMatch.id,
          match_method: 'hard_rule',
          match_confidence: topMatch.similarity ?? 1.0,
          verified_by_human: false,
        }, { onConflict: 'lab_id,raw_name_normalized' });
        await upsertPrice(topMatch.id, lab.id, raw);
        matched++;
        continue;
      }

      // 'create_new' from hard rules → enqueue; worker will create without AI
      // 'needs_ai' with high vector confidence → auto-accept
      if (rule === 'needs_ai' && topMatch.similarity >= 0.94) {
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
    }

    // ── Tier 3: Enqueue for mapping worker ────────────────────────────────
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
