import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';
import { embedText } from '@/scrapers/lib/embed';

type QueueRow = { id: number; lab_id: number; raw_name: string; price_eur: number };

async function approveToExisting(item: QueueRow, canonicalId: number) {
  const norm = normalizeTestName(item.raw_name);
  const { error: e1 } = await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: item.lab_id,
    raw_name: item.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: canonicalId,
    match_method: 'human_approved',
    match_confidence: 1.0,
    verified_by_human: true,
  }, { onConflict: 'lab_id,raw_name_normalized' });
  if (e1) throw new Error(`mapping upsert: ${e1.message}`);

  const { error: e2 } = await supabaseAdmin.from('prices').upsert({
    test_id: canonicalId,
    lab_id: item.lab_id,
    price_eur: item.price_eur,
    lab_test_name: item.raw_name,
    lab_test_url: null,
    scraped_at: new Date().toISOString(),
    is_stale: false,
  }, { onConflict: 'test_id,lab_id' });
  if (e2) throw new Error(`price upsert: ${e2.message}`);

  const { error: e3 } = await supabaseAdmin.from('mapping_review_queue')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', item.id);
  if (e3) throw new Error(`queue update: ${e3.message}`);
}

async function createCanonical(name: string, category: string, aliases: string[]): Promise<number> {
  const embedding = await embedText(name);
  const { data, error } = await supabaseAdmin
    .from('tests')
    .insert({ canonical_name_lt: name, aliases, embedding })
    .select('id')
    .single();
  if (error) throw new Error(`insert tests: ${error.message}`);
  return data.id;
}

async function createAndMap(item: QueueRow, canonicalId: number) {
  const norm = normalizeTestName(item.raw_name);
  const { error: e1 } = await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: item.lab_id,
    raw_name: item.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: canonicalId,
    match_method: 'human_created',
    match_confidence: 1.0,
    verified_by_human: true,
  }, { onConflict: 'lab_id,raw_name_normalized' });
  if (e1) throw new Error(`mapping upsert: ${e1.message}`);

  const { error: e2 } = await supabaseAdmin.from('prices').upsert({
    test_id: canonicalId,
    lab_id: item.lab_id,
    price_eur: item.price_eur,
    lab_test_name: item.raw_name,
    lab_test_url: null,
    scraped_at: new Date().toISOString(),
    is_stale: false,
  }, { onConflict: 'test_id,lab_id' });
  if (e2) throw new Error(`price upsert: ${e2.message}`);

  const { error: e3 } = await supabaseAdmin.from('mapping_review_queue')
    .update({ status: 'new_test', reviewed_at: new Date().toISOString() })
    .eq('id', item.id);
  if (e3) throw new Error(`queue update: ${e3.message}`);
}

async function main() {
  const allIds = [1, 2, 66, 137, 381, 387, 388, 389, 394, 397, 398, 399, 400];

  const { data: rows, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur')
    .in('id', allIds);

  if (error) { console.error('Fetch failed:', error.message); return; }
  const byId = new Map((rows as QueueRow[]).map(r => [r.id, r]));

  function get(id: number): QueueRow {
    const r = byId.get(id);
    if (!r) throw new Error(`id=${id} not found in queue`);
    return r;
  }

  // ── 1. ID 66 & 137 → approve to canonical 1747 ───────────────────────────
  console.log('1. Approving 66 & 137 → canonical 1747 (7 LPL paletė)');
  for (const id of [66, 137]) {
    try {
      await approveToExisting(get(id), 1747);
      console.log(`   ✓ id=${id}`);
    } catch (e) { console.error(`   ✗ id=${id}: ${e}`); }
  }

  // ── 2. ID 389 → approve to canonical 193 ─────────────────────────────────
  console.log('2. Approving 389 → canonical 193 (Candida sukėlėjų paletė PGR)');
  try {
    await approveToExisting(get(389), 193);
    console.log('   ✓ id=389');
  } catch (e) { console.error(`   ✗ id=389: ${e}`); }

  // ── 3. ID 397 → approve to canonical 2040 (Neisseria gonorrhoeae DNR) ────
  console.log('3. Approving 397 → canonical 2040 (Neisseria gonorrhoeae DNR)');
  try {
    await approveToExisting(get(397), 2040);
    console.log('   ✓ id=397');
  } catch (e) { console.error(`   ✗ id=397: ${e}`); }

  // ── 4. ID 381 → approve to canonical 2234 (TPA/NPS) ─────────────────────
  console.log('4. Approving 381 → canonical 2234 (TPA/NPS)');
  try {
    await approveToExisting(get(381), 2234);
    console.log('   ✓ id=381');
  } catch (e) { console.error(`   ✗ id=381: ${e}`); }

  // ── 5. ID 387 → approve to canonical 2113 (Aldosteronas stovint) + alias ─
  console.log('5. Approving 387 → canonical 2113 (Aldosteronas stovint) + adding alias');
  try {
    await approveToExisting(get(387), 2113);
    // Add "ALD Aldosteronas" alias to canonical 2113
    const { data: test } = await supabaseAdmin
      .from('tests')
      .select('aliases')
      .eq('id', 2113)
      .single();
    const existingAliases: string[] = test?.aliases ?? [];
    if (!existingAliases.includes('ALD Aldosteronas')) {
      const { error: aliasErr } = await supabaseAdmin
        .from('tests')
        .update({ aliases: [...existingAliases, 'ALD Aldosteronas'] })
        .eq('id', 2113);
      if (aliasErr) throw new Error(`alias update: ${aliasErr.message}`);
      console.log('   ✓ id=387, alias added');
    } else {
      console.log('   ✓ id=387, alias already present');
    }
  } catch (e) { console.error(`   ✗ id=387: ${e}`); }

  // ── 6. ID 1 → create new canonical (7-sukėlėjų šlapime) ─────────────────
  console.log('6. Creating canonical for ID 1 (LPI 7 šlapime)');
  try {
    const item1 = get(1);
    const name1 = 'Lytiškai plintančių infekcijų 7 sukėlėjų DNR nustatymas šlapime (PGR metodu)';
    const cid1 = await createCanonical(name1, 'infections', [item1.raw_name]);
    await createAndMap(item1, cid1);
    console.log(`   ✓ id=1 → canonical id=${cid1} "${name1}"`);
  } catch (e) { console.error(`   ✗ id=1: ${e}`); }

  // ── 7. ID 2 & 388 → create ONE canonical (LPI 10 sukėlėjų) ──────────────
  console.log('7. Creating ONE canonical for IDs 2 & 388 (LPI 10 sukėlėjų)');
  try {
    const item2   = get(2);
    const item388 = get(388);
    const name10 = item2.raw_name.trim();
    const cid10 = await createCanonical(name10, 'infections', [item2.raw_name, item388.raw_name]);
    await createAndMap(item2,   cid10);
    await createAndMap(item388, cid10);
    console.log(`   ✓ ids=2,388 → canonical id=${cid10}`);
  } catch (e) { console.error(`   ✗ ids=2,388: ${e}`); }

  // ── 8. ID 394 & 399 → create canonical (Fibrinogenas tiesioginis) ────────
  console.log('8. Creating canonical for IDs 394 & 399 (Fibrinogenas tiesioginis matavimas)');
  try {
    const item394 = get(394);
    const item399 = get(399);
    const nameFibr = 'Fibrinogenas (tiesioginis matavimas)';
    const cidFibr = await createCanonical(nameFibr, 'haematology', [item394.raw_name]);
    await createAndMap(item394, cidFibr);
    await createAndMap(item399, cidFibr);
    console.log(`   ✓ ids=394,399 → canonical id=${cidFibr} "${nameFibr}"`);
  } catch (e) { console.error(`   ✗ ids=394,399: ${e}`); }

  // ── 9. ID 400 → create canonical (Prolaktinas ir Makroprolaktinas) ────────
  console.log('9. Creating canonical for ID 400 (Prolaktinas ir Makroprolaktinas)');
  try {
    const item400 = get(400);
    const namePrl = 'Prolaktinas ir Makroprolaktinas (PRL + M-PRL)';
    const cidPrl = await createCanonical(namePrl, 'hormones', [item400.raw_name]);
    await createAndMap(item400, cidPrl);
    console.log(`   ✓ id=400 → canonical id=${cidPrl} "${namePrl}"`);
  } catch (e) { console.error(`   ✗ id=400: ${e}`); }

  // ── 10. ID 398 → create canonical (LPI 4 sukėlėjų — different composition)
  console.log('10. Creating canonical for ID 398 (LPI 4 sukėlėjų — Chlamydia/Mycoplasma genitalium/hominis/Ureaplasma)');
  try {
    const item398 = get(398);
    const name398 = item398.raw_name.trim();
    const cid398 = await createCanonical(name398, 'infections', [item398.raw_name]);
    await createAndMap(item398, cid398);
    console.log(`   ✓ id=398 → canonical id=${cid398}`);
  } catch (e) { console.error(`   ✗ id=398: ${e}`); }

  // ── Summary ───────────────────────────────────────────────────────────────
  const { count } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`\nPending remaining: ${count}`);
}

main().catch(console.error);
