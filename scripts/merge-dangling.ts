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

async function merge(keep: number, del: number, label: string) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
  console.log(`  ✓ keep=${keep} ← del=${del}  ${label}`);
}

async function main() {
  // Chlamydia Pneumoniae IgM capitalization duplicate (Rule 9 / normalized match)
  await merge(204, 2194, 'Chlamydia Pneumoniae IgM (capitalization variant)');
  // CMV IgM antikūnai — 1384 without suffix, 2016 with (CMV IgM) suffix
  await merge(1384, 2016, 'Antikūnai IgM prieš Citomegalo virusą vs (CMV IgM) suffix');

  const [{ stale }] = await sql<{ stale: number }>(`SELECT COUNT(*)::int as stale FROM prices WHERE is_stale = true`);
  console.log(`is_stale = true: ${stale} ${stale === 0 ? '✓' : '⚠'}`);
}

main().catch(console.error);
