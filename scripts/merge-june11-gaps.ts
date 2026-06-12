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

async function merge(keep: number, del: number, label: string) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
  console.log(`  ✓  keep=${keep} ← absorbed=${del}  "${label}"`);
}

async function main() {
  // ── 4 new pairs from recovery scrape ────────────────────────────────────────
  const pairs: [number, number, string][] = [
    [1399, 1923, 'B. burgdorferi DNR ir erkinio encefalito viruso RNR tyrimas erkėje'],
    [1358, 1875, 'Antikūnai prieš acetilcholino receptorius (Anti-AChR)'],
    [981,  2414, 'Somatomedinas C (IGF-1)'],
    [1421, 1857, 'G2 subklasė Imunoglobulino IgG'],
    [1422, 1866, 'G3 subklasė Imunoglobulino IgG'],
  ];

  console.log('=== Merging 5 new pairs ===');
  for (const [keep, del, label] of pairs) {
    await merge(keep, del, label);
  }

  // ── Alfa-amilazė: verify then merge 1982 → 80 ──────────────────────────────
  console.log('\n=== Alfa-amilazė: prices before merge ===');
  const before = await sql<{ test_id: number; lab: string; price_eur: number; lab_test_name: string }>(
    `SELECT p.test_id, l.name AS lab, p.price_eur, p.lab_test_name
     FROM prices p JOIN labs l ON l.id = p.lab_id
     WHERE p.test_id IN (80, 1982) AND p.is_stale = false
     ORDER BY p.test_id, l.name`
  );
  before.forEach(r =>
    console.log(`  test_id=${r.test_id}  ${r.lab}  €${r.price_eur}  raw="${r.lab_test_name}"`)
  );

  await merge(80, 1982, 'Alfa Amilazė (removing "serumas" qualifier duplicate)');

  console.log('\n=== Alfa-amilazė: prices after merge (id=80) ===');
  const after = await sql<{ lab: string; price_eur: number; lab_test_name: string }>(
    `SELECT l.name AS lab, p.price_eur, p.lab_test_name
     FROM prices p JOIN labs l ON l.id = p.lab_id
     WHERE p.test_id = 80 AND p.is_stale = false
     ORDER BY l.name`
  );
  after.forEach(r =>
    console.log(`  ${r.lab}  €${r.price_eur}  raw="${r.lab_test_name}"`)
  );

  if (after.length < 2) {
    console.warn('  ⚠ Expected both labs — check manually');
  } else {
    console.log('  ✓ Both labs present');
  }

  // ── Final audit ─────────────────────────────────────────────────────────────
  console.log('\n=== Verifying similarity (threshold 0.98) ===');
  const highSim = await sql<{ id1: number; id2: number; sim: number }>(
    `SELECT t1.id AS id1, t2.id AS id2,
            round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS sim
     FROM tests t1
     JOIN tests t2 ON t2.id > t1.id
     WHERE (1 - (t1.embedding <=> t2.embedding)) >= 0.98`
  );
  if (highSim.length === 0) {
    console.log('  ✓ No pairs above 0.98');
  } else {
    highSim.forEach(r => console.log(`  ⚠ [${r.sim}] id=${r.id1} ↔ id=${r.id2}`));
  }

  const stale = await sql<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM prices WHERE is_stale = true`
  );
  console.log(`  is_stale = true: ${(stale[0] as any).cnt === 0 ? '✓ 0' : '⚠ ' + (stale[0] as any).cnt}`);
}

main().catch(console.error);
