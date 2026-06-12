import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql(q: string): Promise<unknown[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as unknown[];
}

async function main() {
  console.log('=== 1. Canonicals matching 17-hidroksiprogesterona or 17-OH ===');
  const canonicals = await sql(`
    SELECT id, canonical_name_lt, canonical_name_en,
           (embedding IS NOT NULL) as has_embedding
    FROM tests
    WHERE canonical_name_lt ILIKE '%hidroksiprogesterona%'
       OR canonical_name_lt ILIKE '%17-OH%'
       OR canonical_name_lt ILIKE '%17-hidroksi%'
       OR canonical_name_lt ILIKE '%17 OH%'
    ORDER BY id
  `) as Array<{ id: number; canonical_name_lt: string; canonical_name_en: string | null; has_embedding: boolean }>;

  for (const c of canonicals) {
    console.log(`  id=${c.id}  embedding=${c.has_embedding ? '✓' : '✗'}`);
    console.log(`    lt: ${c.canonical_name_lt}`);
    console.log(`    en: ${c.canonical_name_en ?? '(null)'}`);
  }
  console.log(`\n  Total: ${canonicals.length}`);

  if (canonicals.length === 0) return;

  const ids = canonicals.map(c => c.id);
  console.log('\n=== 2. Prices for each canonical ===');
  const prices = await sql(`
    SELECT t.id as test_id, t.canonical_name_lt, l.name as lab,
           p.price_eur, p.is_stale, p.lab_test_name, p.scraped_at
    FROM prices p
    JOIN tests t ON t.id = p.test_id
    JOIN labs l ON l.id = p.lab_id
    WHERE t.id IN (${ids.join(',')})
    ORDER BY t.id, l.name
  `) as Array<{ test_id: number; canonical_name_lt: string; lab: string; price_eur: string; is_stale: boolean; lab_test_name: string; scraped_at: string }>;

  let lastId = 0;
  for (const p of prices) {
    if (p.test_id !== lastId) {
      console.log(`\n  canonical id=${p.test_id} "${p.canonical_name_lt}"`);
      lastId = p.test_id;
    }
    console.log(`    ${p.lab}: €${p.price_eur}  stale=${p.is_stale}  raw="${p.lab_test_name}"`);
  }
  if (prices.length === 0) console.log('  (no prices found)');

  console.log('\n=== 3. Similarity between these canonicals ===');
  if (ids.length > 1) {
    const pairs = await sql(`
      SELECT t1.id as id1, t1.canonical_name_lt as name1,
             t2.id as id2, t2.canonical_name_lt as name2,
             round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) as similarity
      FROM tests t1 JOIN tests t2 ON t1.id < t2.id
      WHERE t1.id IN (${ids.join(',')}) AND t2.id IN (${ids.join(',')})
        AND t1.embedding IS NOT NULL AND t2.embedding IS NOT NULL
      ORDER BY similarity DESC
    `) as Array<{ id1: number; name1: string; id2: number; name2: string; similarity: number }>;
    for (const r of pairs) {
      console.log(`  [${r.similarity}] id=${r.id1} ↔ id=${r.id2}`);
      console.log(`    "${r.name1}"`);
      console.log(`    "${r.name2}"`);
    }
    if (pairs.length === 0) console.log('  (no pairs with embeddings to compare)');
  }
}

main().catch(console.error);
