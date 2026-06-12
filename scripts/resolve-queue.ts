import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';
import { embedText } from '@/scrapers/lib/embed';

const IG_CLASSES = ['IgG', 'IgM', 'IgA', 'IgE', 'IgD'];
const PACKAGE_KEYWORDS = ['programa', 'programos', 'NIPT', 'myPrenatal', 'Placenta Safe'];

type QueueItem = {
  id: number;
  lab_id: number;
  raw_name: string;
  price_eur: number;
  ai_suggestion_id: number | null;
  tests: { id: number; canonical_name_lt: string } | null;
};

async function approveToExisting(item: QueueItem, canonicalId: number) {
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

async function createNewCanonical(item: QueueItem, canonicalName: string) {
  const embedding = await embedText(canonicalName);
  const { data: newTest, error } = await supabaseAdmin
    .from('tests')
    .insert({ canonical_name_lt: canonicalName, aliases: [item.raw_name], embedding })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const norm = normalizeTestName(item.raw_name);
  await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: item.lab_id,
    raw_name: item.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: newTest.id,
    match_method: 'ai_created',
    match_confidence: 0.99,
    verified_by_human: false,
  }, { onConflict: 'lab_id,raw_name_normalized' });

  await supabaseAdmin.from('prices').upsert({
    test_id: newTest.id,
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

async function main() {
  const { data: pending, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur, ai_suggestion_id, tests(id, canonical_name_lt)')
    .eq('status', 'pending');

  if (error) { console.error('Fetch failed:', error.message); return; }
  if (!pending?.length) { console.log('No pending items.'); return; }

  const items = pending as unknown as QueueItem[];
  console.log(`Pending before: ${items.length}\n`);

  const tierA: QueueItem[] = [];  // pipe-separated → approve to suggestion
  const tierB: QueueItem[] = [];  // IgClass mismatch → create new
  const tierC: QueueItem[] = [];  // packages → skip
  const tierD: QueueItem[] = [];  // leave for human

  for (const item of items) {
    const rawLower = item.raw_name.toLowerCase();
    const suggestedName = item.tests?.canonical_name_lt ?? '';

    // Tier C — packages/programs (check first, some names contain ' | ' too)
    if (PACKAGE_KEYWORDS.some(kw => item.raw_name.includes(kw))) {
      tierC.push(item);
      continue;
    }

    // Tier B — IgClass mismatch
    if (item.ai_suggestion_id && suggestedName) {
      const rawIg = IG_CLASSES.find(ig => item.raw_name.includes(ig));
      const dupIg = IG_CLASSES.find(ig => suggestedName.includes(ig));
      if (rawIg && dupIg && rawIg !== dupIg) {
        tierB.push(item);
        continue;
      }
    }

    // Tier A — pipe-separated Rezus format with a suggestion
    if (item.raw_name.includes(' | ') && item.ai_suggestion_id) {
      tierA.push(item);
      continue;
    }

    // Tier D — leave for human
    tierD.push(item);
  }

  console.log(`Tier A (pipe format, auto-approve) : ${tierA.length}`);
  console.log(`Tier B (IgClass mismatch, create)  : ${tierB.length}`);
  console.log(`Tier C (packages, skip)            : ${tierC.length}`);
  console.log(`Tier D (human review)              : ${tierD.length}`);
  console.log('');

  // ── Tier A: approve to suggested canonical ───────────────────────────────────
  let aOk = 0, aFail = 0;
  for (const item of tierA) {
    try {
      await approveToExisting(item, item.ai_suggestion_id!);
      aOk++;
    } catch (e) {
      console.error(`  [A fail] id=${item.id} "${item.raw_name}": ${e}`);
      aFail++;
    }
  }

  // ── Tier B: create new canonical with the raw_name as canonical name ─────────
  let bOk = 0, bFail = 0;
  for (const item of tierB) {
    // Derive a clean canonical name: strip the "LAB | " prefix if present, else use raw_name
    const cleanName = item.raw_name.includes(' | ')
      ? item.raw_name.split(' | ').slice(1).join(' | ').trim()
      : item.raw_name.trim();
    try {
      await createNewCanonical(item, cleanName);
      console.log(`  [B] created "${cleanName}" (was "${item.raw_name.slice(0, 60)}")`);
      bOk++;
    } catch (e) {
      console.error(`  [B fail] id=${item.id} "${item.raw_name}": ${e}`);
      bFail++;
    }
  }

  // ── Tier C: skip packages ────────────────────────────────────────────────────
  if (tierC.length > 0) {
    const { error: skipErr } = await supabaseAdmin
      .from('mapping_review_queue')
      .update({ status: 'skipped', reviewed_at: new Date().toISOString() })
      .in('id', tierC.map(i => i.id));
    if (skipErr) console.error('  [C fail]', skipErr.message);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const { count: remaining } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log('\n─────────────────────────────────────────────');
  console.log(`Tier A auto-approved  : ${aOk}${aFail ? ` (${aFail} failed)` : ''}`);
  console.log(`Tier B new canonicals : ${bOk}${bFail ? ` (${bFail} failed)` : ''}`);
  console.log(`Tier C skipped        : ${tierC.length}`);
  console.log(`Tier D left pending   : ${tierD.length}`);
  console.log(`─────────────────────────────────────────────`);
  console.log(`Still pending for human review: ${remaining}`);
}

main().catch(console.error);
