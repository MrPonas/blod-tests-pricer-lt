/**
 * Merges canonical clusters discovered via prefixed Rezus slugs.
 * After scraping 8 prefixed Rezus URLs (cor-, lt3-, lt4-, mg-, pth-, zn-, cu-, phos-),
 * Rezus prices landed on active canonicals separate from the Anteja ones.
 * This script consolidates each cluster into one canonical with both labs.
 *
 * Clusters:
 *  FT3: keep=2196, del: 2332 (Rezus), 427 (Anteja dupe), 286 (orphan)
 *  PTH serum: keep=363, del: 1803 (Anteja dupe), 2186 (Rezus), 562 (orphan)
 *  PTH plasma: keep=364, del: 2409 (Anteja dupe)
 *  Kortizolis morning: keep=230, del: 2417 (Anteja dupe), 2105 (Rezus morning), 390 (orphan)
 *  Kortizolis evening: keep=2185, del: 231 (Anteja dupe)
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

async function main() {
  const MERGES: [number, number, string][] = [
    // FT3 cluster
    [2196, 427,  'Laisvo trijodtironino konc. nustatymas → Laisvas trijodtironinas (FT3) [Anteja dupe]'],
    [2196, 2332, 'Laisvas trijodtironinas (FT3) serume → Laisvas trijodtironinas (FT3) [add Rezus]'],
    [2196, 286,  'Laisvas trijodtironinas → Laisvas trijodtironinas (FT3) [orphan]'],

    // PTH serum cluster
    [363, 1803, 'Parathormonas (intaktinis) serume → iPTH Parathormonas (intaktinis) [Anteja dupe]'],
    [363, 2186, 'Parathormonas (PTH) → iPTH Parathormonas (intaktinis) [add Rezus]'],
    [363, 562,  'Parathormonas → iPTH Parathormonas (intaktinis) [orphan]'],

    // PTH plasma cluster
    [364, 2409, 'Parathormono (intaktinio) koncentracija plazmoje → iPTH...plazmoje [Anteja dupe]'],

    // Kortizolis morning cluster
    [230, 2417, 'Kortizolis rytinis (7-9 val.) → CORTr Kortizolis rytinis (7-9 val.) [Anteja dupe]'],
    [230, 2105, 'Kortizolis (rytinis) serume → CORTr Kortizolis rytinis (7-9 val.) [add Rezus]'],
    [230, 390,  'Kortizolis (COR) ryte → CORTr Kortizolis rytinis (7-9 val.) [orphan]'],

    // Kortizolis evening cluster
    [2185, 231, 'CORTv Kortizolis vakarinis (15-17 val.) → Kortizolis (vakare) [Anteja dupe]'],
  ];

  console.log(`=== Merging ${MERGES.length} cluster pairs ===\n`);
  let ok = 0, fail = 0;

  for (const [keep, del, label] of MERGES) {
    try {
      await merge(keep, del, label);
      ok++;
    } catch (err) {
      console.error(`  ✗ keep=${keep} ← del=${del}: ${err}`);
      fail++;
    }
  }

  console.log(`\nMerged: ${ok}  Failed: ${fail}\n`);

  // Verify final state of each cluster
  console.log('=== Cluster verification ===\n');
  const clusters = [
    { ids: [2196], label: 'FT3: Laisvas trijodtironinas (FT3)' },
    { ids: [363], label: 'PTH serum: iPTH Parathormonas (intaktinis)' },
    { ids: [364], label: 'PTH plasma: iPTH Parathormono...plazmoje' },
    { ids: [230], label: 'Kortizolis rytinis (CORTr)' },
    { ids: [2185], label: 'Kortizolis vakare' },
    { ids: [228], label: 'Kortizolis generic (Rezus-only)' },
  ];

  for (const { ids, label } of clusters) {
    const rows = await sql<{ lab: string; price_eur: number }>(
      `SELECT l.name AS lab, p.price_eur FROM prices p JOIN labs l ON l.id=p.lab_id WHERE p.test_id IN (${ids.join(',')}) AND p.is_stale=false ORDER BY l.name`
    );
    const summary = rows.map((r: any) => `${r.lab} €${r.price_eur}`).join(', ');
    console.log(`  ${label}: [${summary || 'NO PRICES'}]`);
  }

  // Final DB counts
  console.log('\n=== Final DB state ===\n');
  const [[tots], [totp], [zeroP], [stale]] = await Promise.all([
    sql<{ n: number }>('SELECT COUNT(*)::int AS n FROM tests'),
    sql<{ n: number }>('SELECT COUNT(*)::int AS n FROM prices WHERE is_stale=false'),
    sql<{ n: number }>('SELECT COUNT(*)::int AS n FROM tests t WHERE NOT EXISTS (SELECT 1 FROM prices WHERE test_id=t.id)'),
    sql<{ n: number }>('SELECT COUNT(*)::int AS n FROM prices WHERE is_stale=true'),
  ]);
  console.log(`  Total canonicals:    ${(tots as any).n}`);
  console.log(`  Total active prices: ${(totp as any).n}`);
  console.log(`  Zero-price:          ${(zeroP as any).n}`);
  console.log(`  is_stale=true:       ${(stale as any).n} ${(stale as any).n === 0 ? '✓' : '⚠'}`);
}

main().catch(console.error);
