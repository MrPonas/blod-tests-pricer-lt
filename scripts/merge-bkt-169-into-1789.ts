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
  console.log('Merging canonical 169 → 1789 (keep 1789)...\n');

  // 1. Redirect test_name_mappings (none expected, but safe to run)
  await sql(`UPDATE test_name_mappings SET canonical_test_id = 1789 WHERE canonical_test_id = 169`);
  console.log('✓ test_name_mappings redirected');

  // 2. Redirect mapping_review_queue suggestions
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = 1789 WHERE ai_suggestion_id = 169`);
  console.log('✓ mapping_review_queue redirected');

  // 3. Redirect pending_review resolved_test_id
  const pr = await sql(`UPDATE pending_review SET resolved_test_id = 1789 WHERE resolved_test_id = 169`);
  console.log('✓ pending_review redirected');

  // 4. Drop conflicting price on 1789 for labs that also appear on 169
  await sql(`
    DELETE FROM prices
    WHERE test_id = 1789
      AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = 169)
  `);
  console.log('✓ conflicting prices on 1789 cleared');

  // 5. Redirect remaining 169 prices to 1789
  await sql(`UPDATE prices SET test_id = 1789 WHERE test_id = 169`);
  console.log('✓ prices redirected to 1789');

  // 6. Delete the duplicate canonical
  await sql(`DELETE FROM tests WHERE id = 169`);
  console.log('✓ canonical 169 deleted');

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\nVerifying prices for canonicals 1789 and 2067...');
  const rows = await sql(`
    SELECT t.id, t.canonical_name_lt, l.name as lab, p.price_eur
    FROM prices p
    JOIN tests t ON t.id = p.test_id
    JOIN labs l ON l.id = p.lab_id
    WHERE t.id IN (1789, 2067)
    ORDER BY t.id, l.name
  `) as Array<{ id: number; canonical_name_lt: string; lab: string; price_eur: string }>;

  if (rows.length === 0) {
    console.log('  ⚠ No rows found!');
  } else {
    let lastId = 0;
    for (const r of rows) {
      if (r.id !== lastId) {
        console.log(`\n  canonical id=${r.id} "${r.canonical_name_lt}"`);
        lastId = r.id;
      }
      console.log(`    ${r.lab}: €${r.price_eur}`);
    }
  }

  const gone = await sql(`SELECT id FROM tests WHERE id = 169`);
  console.log(`\nCanonical 169 exists: ${gone.length > 0 ? 'YES (problem!)' : 'NO ✓ (deleted)'}`);
}

main().catch(console.error);
