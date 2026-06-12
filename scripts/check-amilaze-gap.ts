import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql(q: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  return res.json();
}

async function main() {
  const rows = await sql(`
    SELECT t.id, t.canonical_name_lt, l.name AS lab, p.price_eur, p.lab_test_name
    FROM prices p
    JOIN tests t ON t.id = p.test_id
    JOIN labs l ON l.id = p.lab_id
    WHERE (t.canonical_name_lt ILIKE '%amilaz%' OR p.lab_test_name ILIKE '%amilaz%')
      AND p.is_stale = false
    ORDER BY t.id, l.name
  `);

  console.log('Amilazė entries in DB:');
  (rows as any[]).forEach(r =>
    console.log(`  test_id=${r.id}  lab=${r.lab}  price=€${r.price_eur}  canonical="${r.canonical_name_lt}"  raw="${r.lab_test_name}"`)
  );

  // Also check similarity between any two amilazė canonicals
  if ((rows as any[]).length > 0) {
    const ids = [...new Set((rows as any[]).map((r: any) => r.id))];
    if (ids.length > 1) {
      const sim = await sql(`
        SELECT t1.id AS id1, t1.canonical_name_lt AS name1,
               t2.id AS id2, t2.canonical_name_lt AS name2,
               1 - (t1.embedding <=> t2.embedding) AS similarity
        FROM tests t1, tests t2
        WHERE t1.id IN (${ids.join(',')}) AND t2.id IN (${ids.join(',')}) AND t1.id < t2.id
      `);
      console.log('\nSimilarity between amilazė canonicals:');
      (sim as any[]).forEach(r =>
        console.log(`  [${Number(r.similarity).toFixed(4)}] id=${r.id1} "${r.name1}" ↔ id=${r.id2} "${r.name2}"`)
      );
    }
  }
}

main().catch(console.error);
