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

// Known non-blood-test keywords from failed jobs
const SERVICE_KEYWORDS = [
  'masažas', 'masaž', 'kineziterapija', 'teipavimas', 'hidromasaž',
  'pažyma', 'konsultacija', 'procedūra', 'plovimas', 'vienkartinės',
  'infuzinė', 'laboratorijos specialisto', 'rinkiniai',
];

function looksLikeService(name: string): boolean {
  const lower = name.toLowerCase();
  return SERVICE_KEYWORDS.some(k => lower.includes(k));
}

async function main() {
  const failed = await sql(`
    SELECT mj.id, mj.raw_name, l.name AS lab, mj.lab_test_url
    FROM mapping_jobs mj JOIN labs l ON l.id=mj.lab_id
    WHERE mj.status='failed'
    ORDER BY mj.id
  `);

  const services = (failed as any[]).filter(r => looksLikeService(r.raw_name));
  const legit    = (failed as any[]).filter(r => !looksLikeService(r.raw_name));

  console.log(`Total failed: ${(failed as any[]).length}`);
  console.log(`  Services/non-tests: ${services.length}`);
  console.log(`  Likely blood tests: ${legit.length}`);

  if (legit.length > 0) {
    console.log('\nLegitimate tests that need retry (top up credits then re-run):');
    legit.slice(0, 30).forEach((r: any) => console.log(`  [${r.lab}] "${r.raw_name}"`));
    if (legit.length > 30) console.log(`  ... and ${legit.length - 30} more`);
  }

  if (services.length > 0) {
    console.log('\nService/non-test entries (safe to delete):');
    services.slice(0, 10).forEach((r: any) => console.log(`  [${r.lab}] "${r.raw_name}"`));
    if (services.length > 10) console.log(`  ... and ${services.length - 10} more`);
  }

  // IDs to delete
  const serviceIds = services.map((r: any) => r.id);
  console.log(`\nSQL to mark services as done-invalid (run when ready):`);
  if (serviceIds.length > 0) {
    console.log(`UPDATE mapping_jobs SET status='skipped' WHERE id IN (${serviceIds.join(',')});`);
  }
}

main().catch(console.error);
