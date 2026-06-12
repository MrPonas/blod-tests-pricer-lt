import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

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

async function merge(keep: number, del: number) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
}

// Rule 11 safe-to-merge pairs: [id1, id2] — we'll pick keep by price count, tie → lower id
const PAIRS: [number, number][] = [
  [1009, 1970],  // Toxocora vs Toxocara canis IgG
  [1059, 2123],  // Vitaminas B5 Pantoteno vs Panteno rūgštis
  [1066, 2208],  // Vitaminas E Tokoferolis vs alfa-tokoferolis
  [209,  1881],  // Chlamydia Trachomatis IgG vs Antikūnai IgG prieš Chlamydia trachomatis
  [973,  2150],  // Sifilio RPR vs RPR Sifilio
  [1068, 1069],  // Vitaminas K Filochinonas vs Filokinonas
  [131,  1365],  // Anti-GAD vs Anti-GAD Antikūnai (longer)
  [251,  1791],  // Didelio jautrumo CRB vs CRB didelio jautrumo
  [203,  1990],  // Chlamydia Pneumoniae IgG vs Antikūnai IgG prieš Chlamydia pneumoniae
  [126,  1757],  // Antikūnai prieš tiroglobuliną vs Anti-Tg
  [130,  2098],  // Anti-CCP vs Anti-CCP (longer)
  [204,  1383],  // Chlamydia Pneumoniae IgM vs Antikūnai IgM prieš Chlamydia pneumoniae
  [268,  1411],  // Erkinio Encefalito IgG vs IgG Antikūnai IgG
  [961,  963],   // Se Selenas vs Selenas
  [1383, 2194],  // Antikūnai IgM Chlamydia pneumoniae vs Chlamydia pneumoniae IgM (chain: 2194→204 after above)
  [520,  1985],  // Pankreatinė amilazė vs Pankreatinė amilazė (plazma)
  [269,  1412],  // Erkinio Encefalito IgM vs IgM Antikūnai IgM
  [144,  1748],  // Apo A-I Apolipoproteinas A-I vs Apolipoproteinas A-I
  [145,  1748],  // Apolipoproteinas A1 vs Apolipoproteinas A-I (chain — 1748 may be absorbed)
  [465,  1381],  // Mycoplasma Pneumoniae IgG vs Antikūnai IgG prieš Mycoplasma pneumoniae
  [466,  1387],  // Mycoplasma Pneumoniae IgM vs Antikūnai IgM prieš Mycoplasma pneumoniae
  [146,  1839],  // Apolipoproteinas B vs Apolipoproteinas B (ApoB)
  [146,  147],   // Apolipoproteinas B vs ApoB Apolipoproteinas B
  [414,  1745],  // Lipoproteinas a vs Lipoproteinas (a)
  [1872, 2088],  // Antimitochondriniai antikūnai (AMA) vs AMA atrankos tyrimas
];

async function main() {
  console.log(`Fetching price counts for ${new Set(PAIRS.flat()).size} canonicals...`);

  const ids = [...new Set(PAIRS.flat())];
  const rows = await sql<{ id: number; cnt: number }>(
    `SELECT test_id AS id, COUNT(*)::int AS cnt FROM prices WHERE is_stale = false AND test_id IN (${ids.join(',')}) GROUP BY test_id`
  );
  const priceCount = new Map(rows.map(r => [r.id, r.cnt]));
  const getCount = (id: number) => priceCount.get(id) ?? 0;

  const absorbed = new Set<number>();
  let merged = 0;
  let skipped = 0;

  for (const [a, b] of PAIRS) {
    if (absorbed.has(a) || absorbed.has(b)) {
      console.log(`  [skip] ${a} ↔ ${b} — already absorbed`);
      skipped++;
      continue;
    }

    const ca = getCount(a);
    const cb = getCount(b);
    const keep = ca >= cb ? a : b;
    const del  = keep === a ? b : a;

    try {
      await merge(keep, del);
      absorbed.add(del);
      console.log(`  ✓ keep=${keep}(${getCount(keep)}) ← del=${del}(${getCount(del)})`);
      merged++;
    } catch (err) {
      console.error(`  ✗ keep=${keep} ← del=${del}: ${err}`);
      skipped++;
    }
  }

  console.log(`\nMerged: ${merged}  Skipped: ${skipped}`);

  const [{ stale_count }] = await sql<{ stale_count: number }>(
    `SELECT COUNT(*)::int as stale_count FROM prices WHERE is_stale = true`
  );
  console.log(`is_stale = true: ${stale_count} ${stale_count === 0 ? '✓' : '⚠'}`);
}

main().catch(console.error);
