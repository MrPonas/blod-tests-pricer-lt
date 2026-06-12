/**
 * Finds cases where Lab A has test X, Lab B has test Y, X and Y are ≥ 70%
 * similar, but Lab B has no price for X — the Alfa-amilazė pattern.
 *
 * Complements audit-coverage-gaps.ts (which only catches cross-lab pairs
 * where BOTH labs already have prices for the same test).
 *
 * Usage: npx tsx scripts/check-single-lab-tests.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql<T = Record<string, unknown>>(q: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as T[];
}

async function main() {
  console.log('Scanning for single-lab tests with near-duplicate at another lab (similarity ≥ 0.70)...\n');

  const rows = await sql<{
    similarity: number;
    id1: number; name1: string; lab1: string; price1: number;
    id2: number; name2: string; lab2: string; price2: number;
  }>(`
    SELECT
      round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS similarity,
      t1.id AS id1, t1.canonical_name_lt AS name1, l1.name AS lab1, p1.price_eur AS price1,
      t2.id AS id2, t2.canonical_name_lt AS name2, l2.name AS lab2, p2.price_eur AS price2
    FROM prices p1
    JOIN prices p2
      ON p1.test_id != p2.test_id
      AND p1.lab_id != p2.lab_id
    JOIN tests t1 ON t1.id = p1.test_id
    JOIN tests t2 ON t2.id = p2.test_id
    JOIN labs l1  ON l1.id = p1.lab_id
    JOIN labs l2  ON l2.id = p2.lab_id
    WHERE p1.is_stale = false
      AND p2.is_stale = false
      AND t1.embedding IS NOT NULL
      AND t2.embedding IS NOT NULL
      AND t1.id < t2.id
      AND 1 - (t1.embedding <=> t2.embedding) > 0.70
      AND NOT EXISTS (
        SELECT 1 FROM prices
        WHERE test_id = t1.id AND lab_id = p2.lab_id AND is_stale = false
      )
      AND NOT EXISTS (
        SELECT 1 FROM prices
        WHERE test_id = t2.id AND lab_id = p1.lab_id AND is_stale = false
      )
    ORDER BY similarity DESC
    LIMIT 50
  `);

  if (rows.length === 0) {
    console.log('No single-lab near-duplicates found. ✓');
    return;
  }

  // Count actionable (≥ 0.85) vs low-similarity but name-related
  const high = rows.filter(r => r.similarity >= 0.85);
  const low  = rows.filter(r => r.similarity < 0.85);

  console.log(`Found ${rows.length} pairs (≥ 0.85: ${high.length}, 0.70–0.85: ${low.length})\n`);

  if (high.length > 0) {
    console.log('=== ≥ 0.85 similarity (likely same test, mapped differently) ===');
    for (const r of high) {
      console.log(`  [${r.similarity}] id=${r.id1} "${r.name1}" (${r.lab1} €${r.price1})`);
      console.log(`            id=${r.id2} "${r.name2}" (${r.lab2} €${r.price2})`);
    }
  }

  if (low.length > 0) {
    console.log('\n=== 0.70–0.85 similarity (review manually) ===');
    for (const r of low) {
      console.log(`  [${r.similarity}] id=${r.id1} "${r.name1}" (${r.lab1} €${r.price1})`);
      console.log(`            id=${r.id2} "${r.name2}" (${r.lab2} €${r.price2})`);
    }
  }

  // Actionable exit code for CI
  if (high.length > 0) {
    console.log(`\n⚠ ${high.length} actionable pair(s) above 0.85 — run merge script.`);
    process.exit(1);
  }
}

main().catch(console.error);
