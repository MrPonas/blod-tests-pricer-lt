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

async function merge(keep: number, del: number, note: string) {
  console.log(`  merging ${del} → ${keep}  "${note}"`);
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
  console.log(`  ✓ done`);
}

async function main() {
  // Fix 1: merge 1843 and 2207 into 1073 (25-OH Vitaminas D)
  console.log('\n=== Fix 1: 25-OH Vitaminas D ===');
  await merge(1073, 1843, '25-OH Vitaminas D — bootstrap duplicate');
  await merge(1073, 2207, 'Vitaminas D (25-OH) serume — bootstrap duplicate');

  // Fix 2: merge 2120 into 1064 (1,25-(OH)₂-D3)
  console.log('\n=== Fix 2: 1,25-(OH)₂-D3 Vitaminas D ===');
  await merge(1064, 2120, 'Vitaminas D3 (1,25-(OH)2-D3) — bootstrap duplicate');

  // Fix 3: retry keep=1087 ← del=2034 (failed due to transient 502 earlier)
  console.log('\n=== Fix 3: ŽPV aukštos rizikos (retry) ===');
  await merge(1087, 2034, 'ŽPV aukštos rizikos — list position');

  // Verification
  console.log('\n=== Verification ===');

  // Vitaminas D spot-check
  const vitD = await sql<{ id: number; name: string; lab: string; price: string; stale: boolean }>(`
    SELECT t.id, t.canonical_name_lt as name, l.name as lab,
           p.price_eur as price, p.is_stale as stale
    FROM tests t
    JOIN prices p ON p.test_id = t.id
    JOIN labs l ON l.id = p.lab_id
    WHERE t.canonical_name_lt ILIKE '%vitaminas d%'
       OR t.canonical_name_lt ILIKE '%25-OH%'
       OR t.canonical_name_lt ILIKE '%25-hidroksi%'
       OR t.canonical_name_lt ILIKE '%kolekalcifero%'
    ORDER BY t.id, l.name
  `);

  console.log('\nVitaminas D canonicals:');
  let lastId = 0;
  for (const r of vitD) {
    if (r.id !== lastId) {
      console.log(`  [id=${r.id}] "${r.name}"`);
      lastId = r.id;
    }
    console.log(`    ${r.lab}: €${r.price}  stale=${r.stale}`);
  }

  // Stale check
  const [{ stale_count }] = await sql<{ stale_count: number }>(
    `SELECT COUNT(*)::int as stale_count FROM prices WHERE is_stale = true`
  );
  console.log(`\nis_stale = true: ${stale_count} ${stale_count === 0 ? '✓' : '⚠'}`);

  // Similarity check above 0.98
  const high = await sql<{ id1: number; name1: string; id2: number; name2: string; similarity: number }>(`
    SELECT
      t1.id as id1, t1.canonical_name_lt as name1,
      t2.id as id2, t2.canonical_name_lt as name2,
      round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) as similarity
    FROM tests t1 JOIN tests t2 ON t1.id < t2.id
    WHERE 1 - (t1.embedding <=> t2.embedding) > 0.98
    ORDER BY similarity DESC
  `);

  console.log(`\nPairs above 0.98 similarity: ${high.length} ${high.length === 0 ? '✓' : '⚠'}`);
  for (const r of high) {
    console.log(`  [${r.similarity}] id=${r.id1} ↔ id=${r.id2}`);
    console.log(`    "${r.name1}"`);
    console.log(`    "${r.name2}"`);
  }
}

main().catch(console.error);
