import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';
import { embedText } from '@/scrapers/lib/embed';

// ── ID lists ──────────────────────────────────────────────────────────────────

const TIER_A_IDS = [
  47,48,49,50,51,52,53,58,59,60,62,72,93,96,122,84,94,95,
  121,124,127,132,134,153,159,241,248,252,258,220,228,245,
  251,274,282,319,322,331,392,386,390,
];

const TIER_B_STANDALONE_IDS = [3, 4, 20, 27, 74, 162];

const TIER_B_PAIRS: Array<{ ids: [number, number]; canonicalName: string; category: string }> = [
  { ids: [55, 107], canonicalName: 'Genitalijų opų 7-ių sukėlėjų paletė iš šlapimo',   category: 'infections' },
  { ids: [56, 108], canonicalName: 'Genitalijų opų 7-ių sukėlėjų paletė iš nuograndų', category: 'infections' },
  { ids: [57, 109], canonicalName: 'Bakterinės vaginozės 7-ių sukėlėjų paletė PGR',    category: 'infections' },
];

// IDs 11 and 12: different pathogen counts → each gets its own canonical
const TIER_B_SEPARATE_IDS = [11, 12];

// ── Category inference ────────────────────────────────────────────────────────

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('vitamin'))                                                      return 'vitamins';
  if (/horm|insulin|tsh|ft3|ft4|tireotrop/.test(n))                             return 'hormones';
  if (/antikūn|igg|igm|iga|sukėlėj|sukelėj|virusas|bakter|pgr|dnr|lpi|lpl|chlamyd|mycoplasm|borrelia|herpes|hepatit/.test(n)) return 'infections';
  if (/kraujo|hemoglobin|leukocit|eritrocit|trombocit/.test(n))                  return 'haematology';
  if (/alergij|alergenas/.test(n))                                                return 'allergy';
  if (/vėžio|psa|antigen|ca \d|cea|afp|chromogranin/.test(n))                   return 'tumour_markers';
  if (/šlapimo|šlapimas|urinaliz/.test(n))                                        return 'urinalysis';
  if (/gliukoz|cholesterol|bilirub|ferment|kreatinin|amilaz|lipaz|albumin/.test(n)) return 'biochemistry';
  return 'other';
}

// ── DB helpers ────────────────────────────────────────────────────────────────

type QueueRow = {
  id: number;
  lab_id: number;
  raw_name: string;
  price_eur: number;
  ai_suggestion_id: number | null;
};

async function approveToExisting(item: QueueRow, canonicalId: number) {
  const norm = normalizeTestName(item.raw_name);
  await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: item.lab_id,
    raw_name: item.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: canonicalId,
    match_method: 'human_approved',
    match_confidence: 1.0,
    verified_by_human: true,
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

async function createCanonical(canonicalName: string, category: string, aliases: string[]): Promise<number> {
  const embedding = await embedText(canonicalName);
  const { data, error } = await supabaseAdmin
    .from('tests')
    .insert({ canonical_name_lt: canonicalName, aliases, embedding })
    .select('id')
    .single();
  if (error) throw new Error(`Insert failed for "${canonicalName}": ${error.message}`);
  return data.id;
}

async function createAndMap(item: QueueRow, canonicalName: string, canonicalId: number) {
  const norm = normalizeTestName(item.raw_name);
  await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: item.lab_id,
    raw_name: item.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: canonicalId,
    match_method: 'human_created',
    match_confidence: 1.0,
    verified_by_human: true,
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
    .update({ status: 'new_test', reviewed_at: new Date().toISOString() })
    .eq('id', item.id);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allIds = [
    ...TIER_A_IDS, ...TIER_B_STANDALONE_IDS,
    ...TIER_B_PAIRS.flatMap(p => p.ids), ...TIER_B_SEPARATE_IDS,
  ];

  const { data: rows, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur, ai_suggestion_id')
    .in('id', allIds);

  if (error) { console.error('Fetch failed:', error.message); return; }

  const byId = new Map((rows as QueueRow[]).map(r => [r.id, r]));

  const { count: pendingBefore } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`Pending before: ${pendingBefore}\n`);

  let aOk = 0, aFail = 0;
  let bOk = 0, bFail = 0;
  let bPairsOk = 0, bPairsFail = 0;

  // ── Tier A: approve to suggested canonical ─────────────────────────────────
  console.log(`Tier A: approving ${TIER_A_IDS.length} items to suggested canonicals...`);
  for (const id of TIER_A_IDS) {
    const item = byId.get(id);
    if (!item) { console.error(`  [A] id=${id} not found in pending queue`); aFail++; continue; }
    if (!item.ai_suggestion_id) { console.error(`  [A] id=${id} has no suggestion`); aFail++; continue; }
    try {
      await approveToExisting(item, item.ai_suggestion_id);
      aOk++;
    } catch (e) {
      console.error(`  [A fail] id=${id}: ${e}`);
      aFail++;
    }
  }

  // ── Tier B standalone: create new canonical per item ──────────────────────
  console.log(`\nTier B standalone: creating canonicals for IDs ${TIER_B_STANDALONE_IDS.join(',')}...`);
  const rawNameToNewCanonicalId = new Map<string, number>();

  for (const id of TIER_B_STANDALONE_IDS) {
    const item = byId.get(id);
    if (!item) { console.error(`  [B] id=${id} not found`); bFail++; continue; }

    try {
      // Reuse canonical if same raw_name already processed (e.g. ids 74 + 162)
      let canonicalId = rawNameToNewCanonicalId.get(item.raw_name);
      const isNew = canonicalId === undefined;

      if (isNew) {
        const category = inferCategory(item.raw_name);
        canonicalId = await createCanonical(item.raw_name, category, [item.raw_name]);
        rawNameToNewCanonicalId.set(item.raw_name, canonicalId);
        console.log(`  [B new] "${item.raw_name.slice(0, 60)}" → canonical id=${canonicalId} (${category})`);
      } else {
        console.log(`  [B map] id=${id} "${item.raw_name.slice(0, 60)}" → reuse canonical id=${canonicalId}`);
      }

      await createAndMap(item, item.raw_name, canonicalId!);
      bOk++;
    } catch (e) {
      console.error(`  [B fail] id=${id}: ${e}`);
      bFail++;
    }
  }

  // ── Tier B pairs: one canonical, map both IDs ─────────────────────────────
  console.log('\nTier B pairs: creating one canonical per pair...');
  for (const { ids, canonicalName, category } of TIER_B_PAIRS) {
    try {
      const items = ids.map(id => byId.get(id)).filter(Boolean) as QueueRow[];
      if (items.length === 0) { console.error(`  [pair] none of ${ids} found`); bPairsFail++; continue; }

      const canonicalId = await createCanonical(canonicalName, category, items.map(i => i.raw_name));
      console.log(`  [pair] "${canonicalName.slice(0, 60)}" → id=${canonicalId}, mapping ${items.length} queue items`);

      for (const item of items) {
        await createAndMap(item, canonicalName, canonicalId);
      }
      bPairsOk += items.length;
    } catch (e) {
      console.error(`  [pair fail] ${ids}: ${e}`);
      bPairsFail += 2;
    }
  }

  // ── Tier B separate: ids 11 + 12 each get their own canonical ─────────────
  console.log('\nTier B separate (11 & 12): one canonical each...');
  for (const id of TIER_B_SEPARATE_IDS) {
    const item = byId.get(id);
    if (!item) { console.error(`  [sep] id=${id} not found`); bFail++; continue; }
    try {
      const category = inferCategory(item.raw_name);
      const canonicalId = await createCanonical(item.raw_name, category, [item.raw_name]);
      console.log(`  [sep] id=${id} "${item.raw_name.slice(0, 60)}" → canonical id=${canonicalId}`);
      await createAndMap(item, item.raw_name, canonicalId);
      bOk++;
    } catch (e) {
      console.error(`  [sep fail] id=${id}: ${e}`);
      bFail++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const { count: pendingAfter } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log('\n─────────────────────────────────────────────');
  console.log(`Tier A auto-approved  : ${aOk}${aFail ? ` (${aFail} failed)` : ''}`);
  console.log(`Tier B new canonicals : ${bOk}${bFail ? ` (${bFail} failed)` : ''}`);
  console.log(`Tier B pairs mapped   : ${bPairsOk}${bPairsFail ? ` (${bPairsFail} failed)` : ''}`);
  console.log(`Tier C left pending   : (untouched)`);
  console.log('─────────────────────────────────────────────');
  console.log(`Pending before: ${pendingBefore}`);
  console.log(`Pending after : ${pendingAfter}`);
}

main().catch(console.error);
