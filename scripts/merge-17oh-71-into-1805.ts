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
  const KEEP = 1805;
  const DEL = 71;

  console.log(`Merging canonical ${DEL} → ${KEEP} (17-Hidroksiprogesteronas)`);

  // 1. Redirect test_name_mappings
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${KEEP} WHERE canonical_test_id = ${DEL}`);
  console.log('  ✓ test_name_mappings redirected');

  // 2. Redirect mapping_review_queue suggestions
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${KEEP} WHERE ai_suggestion_id = ${DEL}`);
  console.log('  ✓ mapping_review_queue redirected');

  // 3. Redirect pending_review
  await sql(`UPDATE pending_review SET resolved_test_id = ${KEEP} WHERE resolved_test_id = ${DEL}`);
  console.log('  ✓ pending_review redirected');

  // 4. Drop conflicting prices on keep side (Anteja already fresh on 1805)
  await sql(`
    DELETE FROM prices
    WHERE test_id = ${KEEP}
      AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${DEL})
  `);
  console.log('  ✓ conflicting prices on keep side dropped');

  // 5. Redirect prices from del to keep
  await sql(`UPDATE prices SET test_id = ${KEEP} WHERE test_id = ${DEL}`);
  console.log('  ✓ prices redirected');

  // 6. Reset is_stale on all prices for keep (Rezus row was stale)
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${KEEP}`);
  console.log('  ✓ is_stale reset to false on all prices');

  // 7. Delete the duplicate canonical
  await sql(`DELETE FROM tests WHERE id = ${DEL}`);
  console.log(`  ✓ canonical ${DEL} deleted`);

  // Verify
  console.log('\n=== Verification ===');
  const prices = await sql(`
    SELECT l.name as lab, p.price_eur, p.is_stale, p.lab_test_name
    FROM prices p JOIN labs l ON l.id = p.lab_id
    WHERE p.test_id = ${KEEP}
    ORDER BY l.name
  `) as Array<{ lab: string; price_eur: string; is_stale: boolean; lab_test_name: string }>;

  if (prices.length === 0) {
    console.log('  ⚠ No prices found!');
  } else {
    for (const p of prices) {
      console.log(`  ${p.lab}: €${p.price_eur}  stale=${p.is_stale}  raw="${p.lab_test_name}"`);
    }
  }

  const gone = await sql(`SELECT id FROM tests WHERE id = ${DEL}`);
  console.log(`\n  canonical ${DEL} still exists: ${gone.length > 0 ? 'YES (problem!)' : 'NO (good)'}`);
}

main().catch(console.error);
