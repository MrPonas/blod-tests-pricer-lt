/**
 * Batch merge of zero-price canonicals with their priced naming-variant siblings.
 * All 10 pairs are the same test under different naming conventions.
 *
 * SKIPPED (different specimen types):
 *  - Chlamydia PGR šlapime (206) vs general (2041)
 *  - Mycoplasma genitalium PGR (456) vs šlapime (459)
 *  - Trichomonas vaginalis PGR šlapime (1021) vs general (2036)
 *  - Sifilio antikūnai TPHA (1014) vs IgM/IgG (972) — different assay
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// [FROM (to delete, prices moved away), INTO (to keep)]
const MERGES: [number, number][] = [
  [1846, 413],   // Litis (Li) → Litis
  [1860, 161],   // Kaulų rezorbcijos žymuo (Beta-CrossLaps) → Kaulų rezorbcijos Žymuo
  [1785, 367],   // Jodas (serume) → Jodas
  [450, 211],    // Cholesterolis atliekamas analizatoriumi → Cholesterolis
  [460, 1753],   // Mycoplasma hominis (PGR) → Mycoplasma hominis DNR nustatymas (PGR metodu)
  [1763, 987],   // Švinas (Pb) kraujyje → Švinas
  [2121, 1052],  // Vitaminas B1 (Tiaminas) → Vitaminas B1
  [1750, 1060],  // Vitaminas B6 (Piridoksinas) → Vitaminas B6
  [2125, 1062],  // Vitaminas C (askorbo rūgštis) → Vitaminas C
  [2122, 1055],  // Vitaminas B2 (Riboflavinas) → Vitaminas B2
];

async function mergePair(fromId: number, intoId: number) {
  const { data: from } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', fromId).single();
  const { data: into } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', intoId).single();
  process.stdout.write(`  ${fromId} "${from?.canonical_name_lt}" → ${intoId} "${into?.canonical_name_lt}"\n`);

  const { data: fromPrices } = await db.from('prices').select('lab_id, price_eur, is_stale').eq('test_id', fromId);
  const { data: intoPrices } = await db.from('prices').select('lab_id, price_eur, is_stale').eq('test_id', intoId);
  const intoLabIds = new Set((intoPrices ?? []).map(p => p.lab_id));

  for (const p of fromPrices ?? []) {
    if (intoLabIds.has(p.lab_id)) {
      // Same lab — keep fresher; if FROM is fresh and INTO is stale, swap
      const intoP = intoPrices!.find(x => x.lab_id === p.lab_id)!;
      if (!p.is_stale && intoP.is_stale) {
        await db.from('prices').update({ price_eur: p.price_eur, is_stale: false }).eq('test_id', intoId).eq('lab_id', p.lab_id);
        process.stdout.write(`    updated stale→fresh price lab_id=${p.lab_id}\n`);
      }
      await db.from('prices').delete().eq('test_id', fromId).eq('lab_id', p.lab_id);
    } else {
      await db.from('prices').update({ test_id: intoId }).eq('test_id', fromId).eq('lab_id', p.lab_id);
      process.stdout.write(`    moved €${p.price_eur} from lab_id=${p.lab_id}\n`);
    }
  }

  await db.from('price_history').update({ test_id: intoId }).eq('test_id', fromId);
  await db.from('test_name_mappings').update({ canonical_test_id: intoId }).eq('canonical_test_id', fromId);
  await db.from('mapping_review_queue').update({ ai_suggestion_id: intoId }).eq('ai_suggestion_id', fromId);
  await db.from('pending_review').update({ resolved_test_id: intoId }).eq('resolved_test_id', fromId);

  const fromAliases: string[] = from?.aliases ?? [];
  const intoAliases: string[] = into?.aliases ?? [];
  const fromName: string = from?.canonical_name_lt ?? '';
  const newAliases = [fromName, ...fromAliases].filter(a => a && !intoAliases.includes(a));
  if (newAliases.length) {
    await db.from('tests').update({ aliases: [...intoAliases, ...newAliases] }).eq('id', intoId);
  }

  await db.from('tests').delete().eq('id', fromId);
}

async function main() {
  console.log(`Running ${MERGES.length} merges...\n`);
  for (const [fromId, intoId] of MERGES) {
    await mergePair(fromId, intoId);
  }
  console.log('\nDone. Verifying final state:');
  const intoIds = MERGES.map(([, into]) => into);
  const { data: finals } = await db.from('tests').select('id, canonical_name_lt').in('id', intoIds);
  for (const t of finals ?? []) {
    const { data: prices } = await db.from('prices').select('price_eur, is_stale, lab:labs(name)').eq('test_id', t.id);
    const priceStr = prices?.map(p => `${(p.lab as { name: string }).name} €${p.price_eur}${p.is_stale ? '(stale)' : ''}`).join(', ') || 'NO PRICES';
    console.log(`  id=${t.id}  "${t.canonical_name_lt}"  [${priceStr}]`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
