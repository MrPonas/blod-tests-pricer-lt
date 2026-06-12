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
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as unknown[];
}

async function main() {
  // All stale rows are from 2026-05-25 bootstrap — scrape date range 2026-05-25 to now
  const [{ count: before }] = await sql(
    `SELECT COUNT(*)::int as count FROM prices WHERE is_stale = true`
  ) as Array<{ count: number }>;
  console.log(`Stale before: ${before}`);

  // Show what we're about to fix
  const breakdown = await sql(`
    SELECT l.name as lab, COUNT(*)::int as cnt,
           MIN(p.scraped_at::date)::text as oldest,
           MAX(p.scraped_at::date)::text as newest
    FROM prices p JOIN labs l ON l.id = p.lab_id
    WHERE p.is_stale = true
    GROUP BY l.name ORDER BY cnt DESC
  `) as Array<{ lab: string; cnt: number; oldest: string; newest: string }>;

  console.log('Stale rows by lab:');
  for (const r of breakdown) {
    console.log(`  ${r.lab}: ${r.cnt}  (scraped ${r.oldest} – ${r.newest})`);
  }

  // Fix: all stale rows scraped on 2026-05-25 or 2026-05-26 are bootstrap artifacts
  await sql(`
    UPDATE prices SET is_stale = false
    WHERE is_stale = true
      AND scraped_at >= '2026-05-25'
  `);

  const [{ count: after }] = await sql(
    `SELECT COUNT(*)::int as count FROM prices WHERE is_stale = true`
  ) as Array<{ count: number }>;
  console.log(`\nStale after:  ${after}`);
  console.log(`Fixed:        ${before - after} rows`);

  if (after > 0) {
    const remaining = await sql(`
      SELECT l.name as lab, COUNT(*)::int as cnt,
             MIN(p.scraped_at::date)::text as oldest
      FROM prices p JOIN labs l ON l.id = p.lab_id
      WHERE p.is_stale = true
      GROUP BY l.name ORDER BY cnt DESC
    `) as Array<{ lab: string; cnt: number; oldest: string }>;
    console.log('Remaining stale (genuine old data):');
    for (const r of remaining) {
      console.log(`  ${r.lab}: ${r.cnt}  oldest=${r.oldest}`);
    }
  } else {
    console.log('✓ No stale prices remain');
  }
}

main().catch(console.error);
