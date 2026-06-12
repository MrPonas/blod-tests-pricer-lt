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
  // 1. Total stale count
  const [{ count: totalStale }] = await sql(
    `SELECT COUNT(*)::int as count FROM prices WHERE is_stale = true`
  ) as Array<{ count: number }>;
  console.log(`Total stale prices: ${totalStale}`);

  // 2. Stale rows where the same lab already has a fresh row on a different canonical
  //    (bootstrap duplicates left behind by merges)
  const [{ count: orphanStale }] = await sql(`
    SELECT COUNT(*)::int as count
    FROM prices stale
    WHERE stale.is_stale = true
      AND EXISTS (
        SELECT 1 FROM prices fresh
        WHERE fresh.lab_id = stale.lab_id
          AND fresh.test_id <> stale.test_id
          AND fresh.is_stale = false
          AND fresh.lab_test_name = stale.lab_test_name
      )
  `) as Array<{ count: number }>;
  console.log(`Stale rows with fresh duplicate on another canonical (same lab+name): ${orphanStale}`);

  // 2b. Broader: stale rows where same lab has ANY fresh row (same canonical or different)
  const [{ count: staleWithFreshSameLab }] = await sql(`
    SELECT COUNT(*)::int as count
    FROM prices stale
    WHERE stale.is_stale = true
      AND EXISTS (
        SELECT 1 FROM prices fresh
        WHERE fresh.lab_id = stale.lab_id
          AND fresh.is_stale = false
      )
  `) as Array<{ count: number }>;
  console.log(`Stale rows where same lab has at least one fresh row (any test): ${staleWithFreshSameLab}`);

  // 2c. Stale rows scraped today (bootstrap stale flags on fresh data)
  const [{ count: staleButFresh }] = await sql(`
    SELECT COUNT(*)::int as count
    FROM prices
    WHERE is_stale = true
      AND scraped_at >= '2026-05-26'
  `) as Array<{ count: number }>;
  console.log(`Stale rows with scraped_at >= 2026-05-26 (wrongly flagged): ${staleButFresh}`);

  // Show breakdown by lab for context
  console.log('\n=== Stale breakdown by lab ===');
  const byLab = await sql(`
    SELECT l.name as lab, COUNT(*)::int as stale_count
    FROM prices p JOIN labs l ON l.id = p.lab_id
    WHERE p.is_stale = true
    GROUP BY l.name ORDER BY stale_count DESC
  `) as Array<{ lab: string; stale_count: number }>;
  for (const r of byLab) {
    console.log(`  ${r.lab}: ${r.stale_count}`);
  }

  // Show a sample of stale-but-today rows
  if (staleButFresh > 0) {
    console.log('\n=== Sample stale rows with scraped_at today ===');
    const sample = await sql(`
      SELECT p.test_id, t.canonical_name_lt, l.name as lab,
             p.price_eur, p.scraped_at, p.lab_test_name
      FROM prices p
      JOIN tests t ON t.id = p.test_id
      JOIN labs l ON l.id = p.lab_id
      WHERE p.is_stale = true AND p.scraped_at >= '2026-05-26'
      ORDER BY p.scraped_at DESC
      LIMIT 10
    `) as Array<{ test_id: number; canonical_name_lt: string; lab: string; price_eur: string; scraped_at: string; lab_test_name: string }>;
    for (const r of sample) {
      console.log(`  [${r.test_id}] ${r.lab}: €${r.price_eur}  "${r.lab_test_name}"  scraped=${r.scraped_at.slice(0, 19)}`);
    }
  }

  // 3. Fix: set is_stale = false for all prices scraped today
  console.log(`\n=== Fixing: resetting is_stale on all prices scraped >= 2026-05-26 ===`);
  const [{ count: before }] = await sql(
    `SELECT COUNT(*)::int as count FROM prices WHERE is_stale = true`
  ) as Array<{ count: number }>;

  await sql(`
    UPDATE prices SET is_stale = false
    WHERE is_stale = true AND scraped_at >= '2026-05-26'
  `);

  const [{ count: after }] = await sql(
    `SELECT COUNT(*)::int as count FROM prices WHERE is_stale = true`
  ) as Array<{ count: number }>;

  console.log(`  Before: ${before} stale`);
  console.log(`  After:  ${after} stale`);
  console.log(`  Fixed:  ${before - after} rows`);

  // Remaining stale — show breakdown
  if (after > 0) {
    console.log('\n=== Remaining stale (older scrapes — may be genuinely outdated) ===');
    const remaining = await sql(`
      SELECT l.name as lab, COUNT(*)::int as cnt,
             MIN(p.scraped_at)::text as oldest, MAX(p.scraped_at)::text as newest
      FROM prices p JOIN labs l ON l.id = p.lab_id
      WHERE p.is_stale = true
      GROUP BY l.name ORDER BY cnt DESC
    `) as Array<{ lab: string; cnt: number; oldest: string; newest: string }>;
    for (const r of remaining) {
      console.log(`  ${r.lab}: ${r.cnt} rows  (${r.oldest.slice(0, 10)} – ${r.newest.slice(0, 10)})`);
    }
  }
}

main().catch(console.error);
