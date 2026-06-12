/**
 * Merge test id=244 ("Dehidroepiandrosterono sulfatas", 1 price)
 * into   id=1813 ("DHEA-S (Dehidroepiandrosterono sulfatas)", 2 prices).
 *
 * Steps:
 * 1. Verify no lab overlap between the two tests
 * 2. Re-point prices from 244 → 1813
 * 3. Re-point price_history from 244 → 1813
 * 4. Update test_name_mappings, mapping_review_queue, pending_review
 * 5. Merge aliases from 244 into 1813
 * 6. Delete test 244
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const FROM = 244;
const INTO = 1813;

async function main() {
  // 1. Inspect both tests
  const { data: from } = await db.from('tests').select('id, canonical_name_lt, aliases, category_id').eq('id', FROM).single();
  const { data: into } = await db.from('tests').select('id, canonical_name_lt, aliases, category_id').eq('id', INTO).single();
  console.log('FROM:', JSON.stringify(from));
  console.log('INTO:', JSON.stringify(into));

  // 2. Check price overlap
  const { data: fromPrices } = await db.from('prices').select('lab_id, price_eur, lab:labs(name)').eq('test_id', FROM);
  const { data: intoPrices } = await db.from('prices').select('lab_id, price_eur, lab:labs(name)').eq('test_id', INTO);
  console.log('\nFROM prices:', JSON.stringify(fromPrices));
  console.log('INTO prices:', JSON.stringify(intoPrices));

  const intoLabIds = new Set((intoPrices ?? []).map(p => p.lab_id));
  const conflicts = (fromPrices ?? []).filter(p => intoLabIds.has(p.lab_id));
  if (conflicts.length) {
    // If same lab has identical price in both, safe to drop FROM's duplicate
    const unresolvable = conflicts.filter(c => {
      const iP = (intoPrices ?? []).find(p => p.lab_id === c.lab_id);
      return !iP || Number(iP.price_eur) !== Number(c.price_eur);
    });
    if (unresolvable.length) {
      console.error('UNRESOLVABLE conflict — different prices for same lab:', unresolvable);
      process.exit(1);
    }
    // Delete the duplicate FROM prices so move step won't conflict
    for (const c of conflicts) {
      const { error } = await db.from('prices').delete().eq('test_id', FROM).eq('lab_id', c.lab_id);
      if (error) throw new Error(`delete duplicate price failed: ${error.message}`);
      console.log(`Dropped duplicate FROM price for lab_id=${c.lab_id} (same price in INTO, keeping INTO's row)`);
    }
  }
  console.log('\nPre-merge cleanup done — proceeding.');

  // 3. Move prices
  for (const p of fromPrices ?? []) {
    const { error } = await db.from('prices').update({ test_id: INTO }).eq('test_id', FROM).eq('lab_id', p.lab_id);
    if (error) throw new Error(`prices update failed: ${error.message}`);
  }
  console.log(`Moved ${fromPrices?.length ?? 0} price row(s)`);

  // 4. Move price_history
  const { error: phErr, count: phCount } = await db.from('price_history').update({ test_id: INTO }).eq('test_id', FROM);
  if (phErr) throw new Error(`price_history update failed: ${phErr.message}`);
  console.log(`Moved price_history rows`);

  // 5. Update test_name_mappings
  const { error: mnErr } = await db.from('test_name_mappings').update({ canonical_test_id: INTO }).eq('canonical_test_id', FROM);
  if (mnErr) console.warn('test_name_mappings update:', mnErr.message);

  // 6. Update mapping_review_queue
  const { error: mrErr } = await db.from('mapping_review_queue').update({ ai_suggestion_id: INTO }).eq('ai_suggestion_id', FROM);
  if (mrErr) console.warn('mapping_review_queue update:', mrErr.message);

  // 7. Update pending_review
  const { error: prErr } = await db.from('pending_review').update({ resolved_test_id: INTO }).eq('resolved_test_id', FROM);
  if (prErr) console.warn('pending_review update:', prErr.message);

  // 8. Merge aliases: add FROM's aliases to INTO if not already present
  const fromAliases: string[] = from?.aliases ?? [];
  const intoAliases: string[] = into?.aliases ?? [];
  const fromName: string = from?.canonical_name_lt ?? '';
  const newAliases = [fromName, ...fromAliases].filter(a => a && !intoAliases.includes(a));
  if (newAliases.length) {
    const merged = [...intoAliases, ...newAliases];
    const { error: aliasErr } = await db.from('tests').update({ aliases: merged }).eq('id', INTO);
    if (aliasErr) throw new Error(`alias merge failed: ${aliasErr.message}`);
    console.log(`Merged aliases into ${INTO}:`, newAliases);
  }

  // 9. Delete FROM test
  const { error: delErr } = await db.from('tests').delete().eq('id', FROM);
  if (delErr) throw new Error(`delete test failed: ${delErr.message}`);
  console.log(`\nDeleted test id=${FROM}. Merge complete.`);

  // Verify
  const { data: final } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', INTO).single();
  const { data: finalPrices } = await db.from('prices').select('lab_id, price_eur, lab:labs(name)').eq('test_id', INTO);
  console.log('\nFinal state of id=1813:', JSON.stringify(final, null, 2));
  console.log('Final prices:', JSON.stringify(finalPrices, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
