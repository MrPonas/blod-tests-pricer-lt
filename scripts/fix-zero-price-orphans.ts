/**
 * Executes the zero-price orphan cleanup in 4 steps:
 *  1. Merge 28 confirmed-safe orphans into their active canonicals
 *  2. Bulk delete 118 A+B1+B2+B3 non-blood-test canonicals
 *     (after clearing referencing rows in related tables)
 *
 * No user data is lost — orphan→active redirects all mappings first.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN       = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql<T = Record<string, unknown>>(q: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as T[];
}

// keep=active (has prices), del=orphan (zero prices)
async function merge(keep: number, del: number, label: string) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
  console.log(`  ✓ keep=${keep} ← del=${del}  "${label}"`);
}

// ── Classification (mirrors audit-zero-price-canonicals.ts) ──────────────────

function classify(id: number, name: string): 'A' | 'B1' | 'B2' | 'B3' | 'B4' {
  if (/^\|KL\d+\|/.test(name)) return 'A';
  if (/ištyrimo programa|sveikatos programa|tyrimų programa|imuniteto žvaigždės|energijos balanso|nuovargio priežasčių|speciali vyro|speciali moters|mamos dienai|kaimynų pagrindinė/i.test(name)) return 'B1';
  if (/GeneScreen|myPrenatal|Placenta Safe|GlycanAge|GenoTricho|GenoAthletic|myCancerRisk|myGeneticRisk|myPharma|AnteMEL|Diagnostic Panel|NIPTIFY|Pregnancy Loss|WID-easy|Bladder EpiCheck/i.test(name)) return 'B2';
  if (/mikroskopinis tyrimas grybams|citopatolinis.*tepinėlis|nuograndų tyrimas spalin|burnos gleivinės.*nuograndų|antigenų nustatymas iš nosies|tepinėlis iš nosiaryklės|pasėlis iš nosiaryklės/i.test(name)) return 'B3';
  return 'B4';
}

async function main() {
  // ── Step 1: Safe merges (keep=active, del=orphan) ────────────────────────
  // Ordered: keep first, del (orphan) second
  const MERGES: [number, number, string][] = [
    [73,   72,   '3 LPL paletė — typo "genitlium"→"genitalium"'],
    [2169, 74,   '4 LPL paletė — name variant (same 4 pathogens)'],
    [423,  75,   '4 LPL sukėlėjai — naming convention variant'],
    [2089, 84,   'Antikardiolipininių antikūnų atrankos tyrimas (ACA)'],
    [2093, 103,  'ALEX3 Makrogardelė 300'],
    [2086, 111,  'ANA | Antinuklearinių antikūnų atrankos tyrimas'],
    [2087, 112,  'ANCA | Atineutrofilinės citoplazmos antikūnų'],
    [2262, 123,  'Hepatito B šerdinio antigeno antikūnai (Anti-HBc)'],
    [2146, 142,  'Antikūnų prieš Trichineles IgG nustatymas'],
    [2108, 162,  'Beta žmogaus chorioninis gonadotropinas (β-HCG)'],
    [2129, 163,  'Beta-karotenas'],
    [2203, 165,  'Bendras bilirubinas (serumas)'],
    [1772, 222,  'Kreatinkinazė (CK)'],
    [2092, 250,  'Diamino oksidazė (DAO)'],
    [2170, 280,  'Fosforas šlapime'],
    [341,  315,  'Hg Gyvsidabris'],
    [2265, 319,  'Hepatito A viruso IgG (postvakcininis)'],
    [2180, 329,  'Helicobacter pylori antigeno nustatymas išmatose'],
    [2236, 334,  'Her-2/neu (krūties vėžio žymuo)'],
    [2142, 338,  'Herpes simplex viruso I/II tipo IgG'],
    [2185, 391,  'Kortizolis (vakare)'],
    [2173, 448,  'Makroprolaktinas (MProl)'],
    [528,  529,  'Pavienis dažnas alergenas (išsirenkama iš katalogo)'],
    [2164, 547,  'Platesnis lytiškai plintančių ligų sukėlėjų nustatymas'],
    [2212, 984,  'ST2 biožymuo (sST2)'],
    [2215, 994,  'TBC | Tuberkuliozės kokybinis nustatymas'],
    [1929, 1034, 'Erkinio encefalito IgG (povakcininis)'],
    [2091, 1081, 'Žmogaus leukocitų antigeno B27 (ŽLA-B27)'],
  ];

  console.log(`=== Step 1: Merging ${MERGES.length} orphans into active canonicals ===\n`);
  const absorbed = new Set<number>();
  let mergeOk = 0, mergeFail = 0;

  for (const [keep, del, label] of MERGES) {
    if (absorbed.has(del)) {
      console.log(`  [skip] ${del} already absorbed`);
      continue;
    }
    try {
      await merge(keep, del, label);
      absorbed.add(del);
      mergeOk++;
    } catch (err) {
      console.error(`  ✗ keep=${keep} ← del=${del}: ${err}`);
      mergeFail++;
    }
  }
  console.log(`\nMerged: ${mergeOk}  Failed: ${mergeFail}\n`);

  // ── Step 4: Bulk delete A+B1+B2+B3 canonicals ───────────────────────────
  console.log('=== Step 4: Collecting A+B1+B2+B3 canonical IDs for deletion ===\n');

  const zeros = await sql<{ id: number; canonical_name_lt: string }>(
    `SELECT t.id, t.canonical_name_lt
     FROM tests t
     WHERE NOT EXISTS (SELECT 1 FROM prices WHERE test_id = t.id)
     ORDER BY t.id`
  );

  const deleteIds: number[] = [];
  for (const r of zeros) {
    const cat = classify(r.id, r.canonical_name_lt);
    if (cat !== 'B4') deleteIds.push(r.id);
  }
  console.log(`  Found ${deleteIds.length} non-B4 zero-price canonicals to delete`);

  if (deleteIds.length === 0) {
    console.log('  Nothing to delete.');
    return;
  }

  const idList = deleteIds.join(',');

  // Verify no price rows snuck in
  const [{ price_refs }] = await sql<{ price_refs: number }>(
    `SELECT COUNT(*)::int AS price_refs FROM prices WHERE test_id IN (${idList})`
  );
  if (price_refs > 0) {
    console.error(`  ⛔ ABORT: ${price_refs} price rows reference these IDs — investigate first`);
    process.exit(1);
  }
  console.log(`  price refs: ${price_refs} ✓`);

  // Clear referencing rows before deleting canonicals
  const [{ tnm }] = await sql<{ tnm: number }>(
    `SELECT COUNT(*)::int AS tnm FROM test_name_mappings WHERE canonical_test_id IN (${idList})`
  );
  const [{ mrq }] = await sql<{ mrq: number }>(
    `SELECT COUNT(*)::int AS mrq FROM mapping_review_queue WHERE ai_suggestion_id IN (${idList})`
  );
  const [{ pr }] = await sql<{ pr: number }>(
    `SELECT COUNT(*)::int AS pr FROM pending_review WHERE resolved_test_id IN (${idList})`
  );
  console.log(`  test_name_mappings to clear: ${tnm}`);
  console.log(`  mapping_review_queue to clear: ${mrq}`);
  console.log(`  pending_review to clear: ${pr}\n`);

  if (tnm > 0) {
    await sql(`DELETE FROM test_name_mappings WHERE canonical_test_id IN (${idList})`);
    console.log(`  ✓ Deleted ${tnm} test_name_mappings rows`);
  }
  if (mrq > 0) {
    await sql(`DELETE FROM mapping_review_queue WHERE ai_suggestion_id IN (${idList})`);
    console.log(`  ✓ Deleted ${mrq} mapping_review_queue rows`);
  }
  if (pr > 0) {
    await sql(`DELETE FROM pending_review WHERE resolved_test_id IN (${idList})`);
    console.log(`  ✓ Deleted ${pr} pending_review rows`);
  }

  // Delete the canonicals
  const [{ deleted }] = await sql<{ deleted: number }>(
    `WITH d AS (DELETE FROM tests WHERE id IN (${idList}) RETURNING id)
     SELECT COUNT(*)::int AS deleted FROM d`
  );
  console.log(`\n  ✓ Deleted ${deleted} canonical tests (A+B1+B2+B3)\n`);

  // ── Final checks ─────────────────────────────────────────────────────────
  console.log('=== Final checks ===\n');

  const [{ stale }] = await sql<{ stale: number }>(
    `SELECT COUNT(*)::int AS stale FROM prices WHERE is_stale = true`
  );
  const [{ no_emb }] = await sql<{ no_emb: number }>(
    `SELECT COUNT(*)::int AS no_emb FROM tests WHERE embedding IS NULL`
  );
  const [{ total_tests }] = await sql<{ total_tests: number }>(
    `SELECT COUNT(*)::int AS total_tests FROM tests`
  );
  const [{ total_prices }] = await sql<{ total_prices: number }>(
    `SELECT COUNT(*)::int AS total_prices FROM prices WHERE is_stale = false`
  );
  const [{ zero_price_remaining }] = await sql<{ zero_price_remaining: number }>(
    `SELECT COUNT(*)::int AS zero_price_remaining
     FROM tests t WHERE NOT EXISTS (SELECT 1 FROM prices WHERE test_id = t.id)`
  );

  console.log(`  is_stale = true:      ${stale} ${stale === 0 ? '✓' : '⚠'}`);
  console.log(`  null embeddings:      ${no_emb} ${no_emb === 0 ? '✓' : '⚠'}`);
  console.log(`  Total canonicals:     ${total_tests}`);
  console.log(`  Total active prices:  ${total_prices}`);
  console.log(`  Zero-price remaining: ${zero_price_remaining} (B4 genuinely missing)`);
}

main().catch(console.error);
