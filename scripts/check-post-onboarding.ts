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
  const [totals, staleByLab, nullEmb, androstendionas, pendingJobs] = await Promise.all([
    sql(`SELECT (SELECT COUNT(*) FROM tests) AS tests, (SELECT COUNT(*) FROM prices) AS prices`),
    sql(`SELECT l.name, COUNT(*) AS stale FROM prices p JOIN labs l ON l.id=p.lab_id WHERE p.is_stale=true GROUP BY l.name ORDER BY stale DESC`),
    sql(`SELECT COUNT(*) AS null_embeddings FROM tests WHERE embedding IS NULL`),
    sql(`SELECT t.canonical_name_lt, l.name, p.price_eur, p.is_stale, p.lab_test_url
         FROM tests t JOIN prices p ON p.test_id=t.id JOIN labs l ON l.id=p.lab_id
         WHERE t.canonical_name_lt ILIKE '%androstendion%' ORDER BY l.name`),
    sql(`SELECT status, COUNT(*) FROM mapping_jobs GROUP BY status`),
  ]);

  console.log('=== DB totals ===');
  console.log(JSON.stringify(totals[0], null, 2));
  console.log('\n=== Stale by lab ===');
  (staleByLab as any[]).forEach(r => console.log(`  ${r.name}: ${r.stale}`));
  console.log('\n=== Null embeddings ===');
  console.log(nullEmb[0]);
  console.log('\n=== Androstendionas ===');
  if ((androstendionas as any[]).length === 0) {
    console.log('  NOT FOUND in DB');
  } else {
    (androstendionas as any[]).forEach(r =>
      console.log(`  ${r.name}: €${r.price_eur} stale=${r.is_stale} url=${r.lab_test_url}`)
    );
  }
  console.log('\n=== mapping_jobs status ===');
  (pendingJobs as any[]).forEach(r => console.log(`  ${r.status}: ${r.count}`));
}

main().catch(console.error);
