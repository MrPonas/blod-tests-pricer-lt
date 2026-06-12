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
  console.log('=== 1. prices WHERE lab=anteja AND test_id=2067 ===');
  const r1 = await sql(`
    SELECT p.*, l.name as lab_name
    FROM prices p
    JOIN labs l ON p.lab_id = l.id
    WHERE p.lab_id = (SELECT id FROM labs WHERE slug='anteja')
      AND p.test_id = 2067
  `);
  console.log(JSON.stringify(r1, null, 2));

  console.log('\n=== 2. test_name_mappings WHERE lab=anteja AND normalized ILIKE %kraujo%benda% ===');
  const r2 = await sql(`
    SELECT tnm.*, l.name as lab_name
    FROM test_name_mappings tnm
    JOIN labs l ON tnm.lab_id = l.id
    WHERE tnm.lab_id = (SELECT id FROM labs WHERE slug='anteja')
      AND tnm.raw_name_normalized ILIKE '%kraujo%benda%'
  `);
  console.log(JSON.stringify(r2, null, 2));

  console.log('\n=== 3. mapping_jobs WHERE lab=anteja AND (raw_name ILIKE %BKT% OR %bendras kraujo%) ===');
  const r3 = await sql(`
    SELECT mj.*, l.name as lab_name
    FROM mapping_jobs mj
    JOIN labs l ON mj.lab_id = l.id
    WHERE mj.lab_id = (SELECT id FROM labs WHERE slug='anteja')
      AND (mj.raw_name ILIKE '%BKT%' OR mj.raw_name ILIKE '%bendras kraujo%')
  `);
  console.log(JSON.stringify(r3, null, 2));

  console.log('\n=== 4. mapping_review_queue WHERE lab=anteja AND (raw_name ILIKE %BKT% OR %bendras kraujo%) ===');
  const r4 = await sql(`
    SELECT mrq.*, l.name as lab_name
    FROM mapping_review_queue mrq
    JOIN labs l ON mrq.lab_id = l.id
    WHERE mrq.lab_id = (SELECT id FROM labs WHERE slug='anteja')
      AND (mrq.raw_name ILIKE '%BKT%' OR mrq.raw_name ILIKE '%bendras kraujo%')
  `);
  console.log(JSON.stringify(r4, null, 2));

  // Also check canonical 2067
  console.log('\n=== canonical test 2067 ===');
  const r5 = await sql(`SELECT id, canonical_name_lt, aliases FROM tests WHERE id = 2067`);
  console.log(JSON.stringify(r5, null, 2));

  // Also check if anteja has ANY price for any haematology/BKT-like test
  console.log('\n=== anteja prices with lab_test_name ILIKE %BKT% or %kraujo% ===');
  const r6 = await sql(`
    SELECT p.test_id, p.lab_test_name, p.price_eur, t.canonical_name_lt
    FROM prices p
    JOIN tests t ON p.test_id = t.id
    WHERE p.lab_id = (SELECT id FROM labs WHERE slug='anteja')
      AND (p.lab_test_name ILIKE '%BKT%' OR p.lab_test_name ILIKE '%bendras kraujo%')
  `);
  console.log(JSON.stringify(r6, null, 2));
}

main().catch(console.error);
