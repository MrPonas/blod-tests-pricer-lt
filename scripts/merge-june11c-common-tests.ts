/**
 * Merges 17 bootstrap-era orphan canonicals into their active counterparts,
 * plus deletes id=223 (Chloras — confirmed 404 at Rezus and Anteja).
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
  // keep, del, label
  const MERGES: [number, number, string][] = [
    [1986, 86,  'Aktyvuotas dalinis tromboplastino laikas (ADTL)'],
    [88,   87,  'Alfa fetoproteinas (AFP)'],
    [2259, 82,  'ABO ir Rh(D) kraujo grupės nustatymas'],
    [1899, 89,  'Adrenokortikotropinis hormonas (AKTH)'],
    [2107, 110, 'Antimiulerio hormonas (AMH)'],
    [1872, 109, 'Antimitochondriniai antikūnai (AMA)'],
    [1961, 124, 'Hepatito B paviršiaus antikūnai (anti-HBs)'],
    [2266, 125, 'Hepatito C viruso antikūnai (anti-HCV), kiekybinis'],
    [2226, 150, 'Antistreptolizino O (ASLO) nustatymas'],
    [157,  156, 'aTPO Antikūnai prieš skydliaukės peroksidazę'],
    [2222, 172, 'C-peptidas'],
    [1776, 221, 'Kreatinkinazės širdies izofermento masės nustatymas (CK-MB)'],
    [2149, 258, 'Epštein-Baro viruso IgG antikūnai (EBV IgG)'],
    [2257, 259, 'Epšteino-Baro viruso IgM antikūnai (EBV IgM)'],
    [1760, 279, 'Folinė rūgštis'],
    [1778, 253, 'DTL cholesterolis (HDL — full Lithuanian name)'],
    [1778, 254, 'DTL cholesterolis (HDL — redundant canonical with 1 price)'],
  ];

  console.log(`=== Merging ${MERGES.length} orphans ===\n`);
  const absorbed = new Set<number>();
  let ok = 0, fail = 0;

  for (const [keep, del, label] of MERGES) {
    if (absorbed.has(del)) {
      console.log(`  [skip] ${del} already absorbed`);
      continue;
    }
    try {
      await merge(keep, del, label);
      absorbed.add(del);
      ok++;
    } catch (err) {
      console.error(`  ✗ keep=${keep} ← del=${del}: ${err}`);
      fail++;
    }
  }
  console.log(`\nMerged: ${ok}  Failed: ${fail}\n`);

  // ── Delete Chloras (id=223) ────────────────────────────────────────────────
  console.log('=== Deleting id=223 "Chloras" (Rezus 404) ===\n');
  const [{ price_check }] = await sql<{ price_check: number }>(
    `SELECT COUNT(*)::int AS price_check FROM prices WHERE test_id = 223`
  );
  if (price_check > 0) {
    console.error(`  ⛔ ABORT: ${price_check} prices reference id=223 — investigate first`);
    process.exit(1);
  }
  await sql(`DELETE FROM test_name_mappings WHERE canonical_test_id = 223`);
  await sql(`DELETE FROM mapping_review_queue WHERE ai_suggestion_id = 223`);
  await sql(`DELETE FROM pending_review WHERE resolved_test_id = 223`);
  await sql(`DELETE FROM tests WHERE id = 223`);
  console.log(`  ✓ Deleted id=223 (Chloras)\n`);

  // ── DTL/HDL verification ──────────────────────────────────────────────────
  console.log('=== DTL cholesterolis (id=1778) after merge ===\n');
  const dtl = await sql<{ lab: string; price_eur: number; lab_test_name: string }>(
    `SELECT l.name AS lab, p.price_eur, p.lab_test_name
     FROM prices p JOIN labs l ON l.id = p.lab_id
     WHERE p.test_id = 1778 AND p.is_stale = false
     ORDER BY l.name`
  );
  dtl.forEach(r =>
    console.log(`  ${(r as any).lab}  €${(r as any).price_eur}  raw="${(r as any).lab_test_name}"`)
  );
  if (dtl.length < 2) console.warn('  ⚠ Expected both labs — check manually');
  else console.log('  ✓ Both labs present');

  // ── Final checks ──────────────────────────────────────────────────────────
  console.log('\n=== Final checks ===\n');
  const [[stale], [noEmb], [tots], [totp], [zeroP]] = await Promise.all([
    sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM prices WHERE is_stale = true`),
    sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tests WHERE embedding IS NULL`),
    sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tests`),
    sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM prices WHERE is_stale = false`),
    sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tests t WHERE NOT EXISTS (SELECT 1 FROM prices WHERE test_id = t.id)`),
  ]);

  console.log(`  is_stale = true:          ${(stale as any).n} ${(stale as any).n === 0 ? '✓' : '⚠'}`);
  console.log(`  null embeddings:          ${(noEmb as any).n} ${(noEmb as any).n === 0 ? '✓' : '⚠'}`);
  console.log(`  Total canonicals:         ${(tots as any).n}`);
  console.log(`  Total active prices:      ${(totp as any).n}`);
  console.log(`  Zero-price remaining:     ${(zeroP as any).n}`);
}

main().catch(console.error);
