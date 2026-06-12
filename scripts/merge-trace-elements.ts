/**
 * Merge trace element "(serumas)" variants (which have Rezus prices)
 * INTO the simple canonical names (which are better display names but have no prices).
 * Also moves the simple names to category 12 (Mikroelementai).
 *
 * Merge direction: serumas variant → simple name (keep simple name as canonical)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// [FROM id (serumas variant), INTO id (simple/canonical name)]
const PAIRS: [number, number][] = [
  [2250, 93],   // Alavas (Sn) serume → Alavas
  [2237, 104],  // Aliuminis (serumas) → Aliuminis
  [2326, 158],  // Auksas (Au) serume → Auksas
  [2239, 160],  // Berilis (serume) → Berilis
  [2248, 167],  // Bismutas (serumas) → Bismutas
];

const MIKROELEMENTAI_CAT_ID = 12;

async function mergePair(fromId: number, intoId: number) {
  const { data: from } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', fromId).single();
  const { data: into } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', intoId).single();
  console.log(`\nMerging id=${fromId} "${from?.canonical_name_lt}" → id=${intoId} "${into?.canonical_name_lt}"`);

  const { data: fromPrices } = await db.from('prices').select('lab_id, price_eur, lab:labs(name)').eq('test_id', fromId);
  const { data: intoPrices } = await db.from('prices').select('lab_id').eq('test_id', intoId);
  const intoLabIds = new Set((intoPrices ?? []).map(p => p.lab_id));

  for (const p of fromPrices ?? []) {
    if (intoLabIds.has(p.lab_id)) {
      console.log(`  skip conflict lab_id=${p.lab_id}`);
      await db.from('prices').delete().eq('test_id', fromId).eq('lab_id', p.lab_id);
    } else {
      await db.from('prices').update({ test_id: intoId }).eq('test_id', fromId).eq('lab_id', p.lab_id);
      console.log(`  moved price: ${(p.lab as { name: string }).name} €${p.price_eur}`);
    }
  }

  // Move price_history
  await db.from('price_history').update({ test_id: intoId }).eq('test_id', fromId);

  // Update FK tables
  await db.from('test_name_mappings').update({ canonical_test_id: intoId }).eq('canonical_test_id', fromId);
  await db.from('mapping_review_queue').update({ ai_suggestion_id: intoId }).eq('ai_suggestion_id', fromId);
  await db.from('pending_review').update({ resolved_test_id: intoId }).eq('resolved_test_id', fromId);

  // Merge aliases
  const fromAliases: string[] = from?.aliases ?? [];
  const intoAliases: string[] = into?.aliases ?? [];
  const fromName: string = from?.canonical_name_lt ?? '';
  const newAliases = [fromName, ...fromAliases].filter(a => a && !intoAliases.includes(a));
  if (newAliases.length) {
    await db.from('tests').update({ aliases: [...intoAliases, ...newAliases] }).eq('id', intoId);
    console.log(`  merged aliases:`, newAliases);
  }

  // Delete FROM
  await db.from('tests').delete().eq('id', fromId);
  console.log(`  deleted id=${fromId}`);
}

async function main() {
  for (const [fromId, intoId] of PAIRS) {
    await mergePair(fromId, intoId);
  }

  // Move all 5 simple names to Mikroelementai
  const intoIds = PAIRS.map(([, into]) => into);
  const { error } = await db.from('tests').update({ category_id: MIKROELEMENTAI_CAT_ID }).in('id', intoIds);
  if (error) throw new Error(`category update failed: ${error.message}`);
  console.log(`\nMoved ${intoIds.length} tests to Mikroelementai (cat 12)`);

  // Verify final state
  const { data: final } = await db
    .from('tests')
    .select('id, canonical_name_lt, category_id, aliases')
    .in('id', intoIds);
  for (const t of final ?? []) {
    const { data: prices } = await db.from('prices').select('price_eur, lab:labs(name)').eq('test_id', t.id);
    console.log(`  id=${t.id} "${t.canonical_name_lt}" cat=${t.category_id} prices=[${prices?.map(p => (p.lab as {name:string}).name + ' €' + p.price_eur).join(', ')}]`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
