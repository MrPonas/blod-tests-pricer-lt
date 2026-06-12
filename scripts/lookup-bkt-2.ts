import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql(query: string): Promise<unknown[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as unknown[];
}

async function main() {
  console.log('=== 1. Full details of canonicals 169, 1789, 2067 ===');
  const r1 = await sql(`
    SELECT id, canonical_name_lt, canonical_name_en, aliases
    FROM tests WHERE id IN (169, 1789, 2067)
    ORDER BY id
  `);
  for (const row of r1 as any[]) {
    console.log(`\nid=${row.id}`);
    console.log(`  canonical_name_lt: ${row.canonical_name_lt}`);
    console.log(`  canonical_name_en: ${row.canonical_name_en ?? '(null)'}`);
    console.log(`  aliases: ${JSON.stringify(row.aliases)}`);
  }

  console.log('\n\n=== 2. Labs + prices for each canonical ===');
  const r2 = await sql(`
    SELECT t.id, t.canonical_name_lt, l.name as lab, p.price_eur, p.lab_test_name
    FROM prices p
    JOIN tests t ON t.id = p.test_id
    JOIN labs l ON l.id = p.lab_id
    WHERE t.id IN (169, 1789, 2067)
    ORDER BY t.id, l.name
  `);
  let lastId = '';
  for (const row of r2 as any[]) {
    if (row.id !== lastId) {
      console.log(`\ncanonical id=${row.id} "${row.canonical_name_lt}"`);
      lastId = row.id;
    }
    console.log(`  ${row.lab}: €${row.price_eur}  (raw: "${row.lab_test_name}")`);
  }
  if ((r2 as any[]).length === 0) console.log('  (no prices found)');

  console.log('\n\n=== 3. test_name_mappings for each canonical ===');
  const r3 = await sql(`
    SELECT tnm.canonical_test_id, l.name as lab, tnm.raw_name, tnm.raw_name_normalized,
           tnm.match_method, tnm.match_confidence, tnm.verified_by_human
    FROM test_name_mappings tnm
    JOIN labs l ON tnm.lab_id = l.id
    WHERE tnm.canonical_test_id IN (169, 1789, 2067)
    ORDER BY tnm.canonical_test_id, l.name
  `);
  let lastCid = '';
  for (const row of r3 as any[]) {
    if (row.canonical_test_id !== lastCid) {
      console.log(`\ncanonical id=${row.canonical_test_id}`);
      lastCid = row.canonical_test_id;
    }
    console.log(`  ${row.lab} [${row.match_method} ${row.match_confidence}${row.verified_by_human ? ' ✓human' : ''}]: "${row.raw_name}"`);
  }

  console.log('\n\n=== 4. Similarity between 169, 1789, 2067 ===');
  const r4 = await sql(`
    SELECT t1.id as id1, t1.canonical_name_lt as name1,
           t2.id as id2, t2.canonical_name_lt as name2,
           round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) as similarity
    FROM tests t1 JOIN tests t2 ON t1.id < t2.id
    WHERE t1.id IN (169, 1789, 2067) AND t2.id IN (169, 1789, 2067)
    ORDER BY similarity DESC
  `);
  for (const row of r4 as any[]) {
    console.log(`  [${row.similarity}] id=${row.id1} "${row.name1}"`);
    console.log(`           ↔ id=${row.id2} "${row.name2}"`);
  }
}

main().catch(console.error);
