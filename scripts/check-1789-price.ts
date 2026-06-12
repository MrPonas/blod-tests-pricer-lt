import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;
async function sql(q: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}
async function main() {
  console.log('=== prices for test_id=1789 ===');
  console.log(JSON.stringify(await sql(`
    SELECT p.price_eur, l.name, p.scraped_at, p.is_stale, p.lab_test_name
    FROM prices p JOIN labs l ON l.id = p.lab_id
    WHERE p.test_id = 1789
  `), null, 2));

  console.log('\n=== test_name_mappings for canonical 1789 ===');
  console.log(JSON.stringify(await sql(`
    SELECT tnm.raw_name, tnm.match_method, tnm.match_confidence, l.name as lab
    FROM test_name_mappings tnm JOIN labs l ON l.id = tnm.lab_id
    WHERE tnm.canonical_test_id = 1789
  `), null, 2));
}
main().catch(console.error);
