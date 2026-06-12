/**
 * Finds canonical tests that only have prices from ONE lab, but likely have
 * a matching test from ANOTHER lab that ended up in a different canonical.
 * 
 * Uses progressive stripping:
 * 1. Strip code prefix (CODE | or CODE space)
 * 2. Strip common suffixes (" tyrimai", " - tyrimas")
 * 3. Strip explanatory parentheticals "(long explanatory text)"
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function normalize(name: string): string {
  let s = name;
  // Strip code prefix
  if (s.includes(' | ')) s = s.split(' | ').slice(1).join(' | ');
  s = s.replace(/^[A-ZŽŠŪ\-]{1,8}\d*\s+(?=[A-ZŽŠŲ])/, '');
  // Strip common Anteja suffixes
  s = s.replace(/\s+tyrimai$/i, '').replace(/\s+-\s+tyrimas$/i, '');
  // Strip long explanatory parentheticals (20+ chars inside parens at end)
  s = s.replace(/\s+\([^)]{20,}\)$/, '');
  return s.trim().toLowerCase();
}

async function main() {
  const { data: tests } = await db.from('tests')
    .select('id, canonical_name_lt, aliases');
  
  // Get price counts per test per lab
  const { data: prices } = await db.from('prices')
    .select('test_id, lab_id, price_eur, is_stale')
    .eq('is_stale', false)
    .gt('price_eur', 0);

  // Build: testId → set of lab_ids with active prices
  const testLabs = new Map<number, Set<number>>();
  for (const p of prices ?? []) {
    if (!testLabs.has(p.test_id)) testLabs.set(p.test_id, new Set());
    testLabs.get(p.test_id)!.add(p.lab_id);
  }

  // Build normalized name → [test ids]
  const byNorm = new Map<string, number[]>();
  for (const t of tests ?? []) {
    const key = normalize(t.canonical_name_lt);
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key)!.push(t.id);
  }

  // Find groups where multiple tests have same normalized name
  const exact: Array<{norm: string, ids: number[]}> = [];
  for (const [norm, ids] of byNorm) {
    if (ids.length > 1) exact.push({ norm, ids });
  }
  
  console.log(`\n=== EXACT matches after deep normalization: ${exact.length} groups ===`);
  for (const g of exact) {
    const nameList = g.ids.map(id => {
      const t = tests?.find(x => x.id === id);
      const labs = testLabs.get(id) ?? new Set();
      return `  [${id}] "${t?.canonical_name_lt}" — labs: [${[...labs].join(',')}]`;
    });
    console.log(`"${g.norm}"`);
    nameList.forEach(n => console.log(n));
    console.log();
  }

  // Fuzzy: build Fuse on normalized names, find near-matches across single-lab tests
  const singleLabTests = [...(tests ?? [])].filter(t => {
    const labs = testLabs.get(t.id);
    return labs && labs.size === 1;
  });
  console.log(`\nSingle-lab tests: ${singleLabTests.length} (of ${tests?.length ?? 0} total)`);
  
  // Group single-lab by lab
  const byLab = new Map<number, typeof singleLabTests>();
  for (const t of singleLabTests) {
    const labs = testLabs.get(t.id)!;
    const labId = [...labs][0];
    if (!byLab.has(labId)) byLab.set(labId, []);
    byLab.get(labId)!.push(t);
  }
  for (const [labId, ts] of byLab) {
    console.log(`  Lab ${labId}: ${ts.length} single-lab tests`);
  }
}
main();
