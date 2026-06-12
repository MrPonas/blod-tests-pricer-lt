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
  // How many total Rezus prices?
  const [rezusTotals] = await sql(`
    SELECT
      COUNT(*) FILTER (WHERE is_stale=false) AS fresh,
      COUNT(*) FILTER (WHERE is_stale=true)  AS stale,
      COUNT(*) AS total
    FROM prices WHERE lab_id = (SELECT id FROM labs WHERE slug='rezus')
  `);
  console.log('Rezus prices:', rezusTotals);

  // Sample stale Rezus prices — do they have lab_test_url?
  const stale = await sql(`
    SELECT t.canonical_name_lt, p.lab_test_name, p.lab_test_url, p.price_eur
    FROM prices p JOIN tests t ON t.id=p.test_id
    WHERE p.lab_id=(SELECT id FROM labs WHERE slug='rezus') AND p.is_stale=true
    ORDER BY t.canonical_name_lt
    LIMIT 20
  `);
  console.log('\nSample stale Rezus prices (first 20):');
  (stale as any[]).forEach(r =>
    console.log(`  "${r.lab_test_name}" → canonical="${r.canonical_name_lt}" url=${r.lab_test_url ?? 'NULL'}`)
  );

  // Failed mapping_jobs — when were they created?
  const failedJobs = await sql(`
    SELECT DATE(created_at) AS day, COUNT(*) AS cnt
    FROM mapping_jobs WHERE status='failed'
    GROUP BY day ORDER BY day DESC LIMIT 10
  `);
  console.log('\nFailed mapping_jobs by day:');
  (failedJobs as any[]).forEach(r => console.log(`  ${r.day}: ${r.cnt}`));

  // Today's failed jobs — what are they?
  const todayFailed = await sql(`
    SELECT mj.raw_name, l.name AS lab
    FROM mapping_jobs mj JOIN labs l ON l.id=mj.lab_id
    WHERE mj.status='failed' AND mj.created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY mj.id
    LIMIT 30
  `);
  console.log('\nFailed jobs from last 24h:');
  (todayFailed as any[]).forEach(r => console.log(`  [${r.lab}] "${r.raw_name}"`));

  // Pending jobs still open
  const pending = await sql(`
    SELECT COUNT(*), l.name FROM mapping_jobs mj JOIN labs l ON l.id=mj.lab_id
    WHERE mj.status='pending' GROUP BY l.name
  `);
  console.log('\nStill pending:');
  (pending as any[]).forEach(r => console.log(`  ${r.name}: ${r.count}`));
}

main().catch(console.error);
