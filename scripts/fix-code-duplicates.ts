/**
 * Merges canonical tests that are the same test but were bootstrapped with different
 * lab-specific catalog code prefixes (e.g. "A-AMYL | Alfa Amilazė" vs "AMYL Alfa-amilazės tyrimai").
 *
 * Also cleans up canonical_name_lt by stripping the code prefix, making names
 * human-readable and code-agnostic. The original name is preserved as an alias.
 *
 * Run with --dry-run to preview without changes.
 * Run with --apply to execute changes.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DRY_RUN = !process.argv.includes('--apply');

// Strip lab-specific catalog codes and common Anteja suffixes.
function stripCode(name: string): string {
  let result = name;
  if (result.includes(' | ')) result = result.split(' | ').slice(1).join(' | ');
  result = result.replace(/^[A-ZŽŠŪ\-]{1,8}\d*\s+(?=[A-ZŽŠŲ])/, '');
  result = result.replace(/\s+tyrimai$/i, '').replace(/\s+-\s+tyrimas$/i, '');
  return result.trim();
}

// These pairs strip to the same name but are actually DIFFERENT tests — do not merge.
// Format: "min_id-max_id"
const SKIP_PAIRS = new Set([
  '128-129',   // Anti-tTG IgA vs Anti-tTG IgG — different antibody subtypes
  '211-254',   // CHOL total cholesterol vs DTL (HDL) cholesterol
  '575-1014',  // RPR syphilis screening vs TPHA syphilis confirmatory
]);

// Manual merges for tests that are the same but differ in lab-specific suffixes
// (e.g. Anteja appends " tyrimai" or " - tyrimas" to names).
// Format: { winner: id, loser: id }
const MANUAL_MERGES = [
  { winner: 80,  loser: 1355 }, // "Alfa Amilazė" (Rezus) ↔ "Alfa-amilazės tyrimai" (Anteja)
  { winner: 520, loser: 1467 }, // "Pankreatinė amilazė" (Rezus) ↔ "Pankreatinė amilazė - tyrimas" (Anteja)
];

async function mergePair(winnerId: number, loserId: number) {
  const { data: winner } = await db.from('tests').select('*').eq('id', winnerId).single();
  const { data: loser } = await db.from('tests').select('*').eq('id', loserId).single();
  if (!winner || !loser) { console.log(`  Skipping — could not load ${winnerId} or ${loserId}`); return; }

  const cleanName = stripCode(winner.canonical_name_lt);
  const mergedAliases = [...new Set([
    ...winner.aliases,
    ...loser.aliases,
    winner.canonical_name_lt,
    loser.canonical_name_lt,
  ])];

  console.log(`  Merging [${loserId}] "${loser.canonical_name_lt}"`);
  console.log(`    → into [${winnerId}] "${winner.canonical_name_lt}"`);
  console.log(`    → clean name: "${cleanName}"`);

  if (DRY_RUN) return;

  // Reassign prices from loser to winner (skip if winner already has a price for that lab)
  const { data: loserPrices } = await db.from('prices').select('*').eq('test_id', loserId);
  for (const price of loserPrices ?? []) {
    const { data: existing } = await db.from('prices').select('id')
      .eq('test_id', winnerId).eq('lab_id', price.lab_id).single();
    if (!existing) {
      await db.from('prices').update({ test_id: winnerId }).eq('id', price.id);
      console.log(`    moved price lab_id=${price.lab_id} €${price.price_eur}`);
    } else {
      await db.from('prices').delete().eq('id', price.id);
      console.log(`    dropped duplicate price lab_id=${price.lab_id} (winner already has it)`);
    }
  }

  // Reassign pending_review
  await db.from('pending_review').update({ resolved_test_id: winnerId }).eq('resolved_test_id', loserId);

  // Update winner: clean name + merged aliases
  await db.from('tests').update({
    canonical_name_lt: cleanName,
    aliases: mergedAliases,
  }).eq('id', winnerId);

  // Delete loser
  await db.from('tests').delete().eq('id', loserId);
  console.log(`    deleted [${loserId}]`);
}

async function cleanName(testId: number) {
  const { data: test } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', testId).single();
  if (!test) return;
  const clean = stripCode(test.canonical_name_lt);
  if (clean === test.canonical_name_lt) return; // already clean

  console.log(`  [${testId}] "${test.canonical_name_lt}" → "${clean}"`);
  if (DRY_RUN) return;

  const updatedAliases = [...new Set([...test.aliases, test.canonical_name_lt])];
  await db.from('tests').update({
    canonical_name_lt: clean,
    aliases: updatedAliases,
  }).eq('id', testId);
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN (pass --apply to execute) ---\n');

  // Load all tests
  const { data: tests } = await db.from('tests').select('id, canonical_name_lt');
  const all = tests ?? [];

  // Group by stripped name to find exact duplicates
  const byStripped = new Map<string, typeof all>();
  for (const t of all) {
    const key = stripCode(t.canonical_name_lt).toLowerCase();
    if (!byStripped.has(key)) byStripped.set(key, []);
    byStripped.get(key)!.push(t);
  }

  const dupeGroups = [...byStripped.values()].filter(g => g.length > 1);
  console.log(`Found ${dupeGroups.length} duplicate groups after code-stripping\n`);

  let mergeCount = 0;
  for (const group of dupeGroups) {
    // Determine winner: prefer the one with more prices; on tie, prefer lower id
    const counts = await Promise.all(
      group.map(async (t) => {
        const { count } = await db.from('prices').select('*', { count: 'exact', head: true }).eq('test_id', t.id);
        return { ...t, priceCount: count ?? 0 };
      })
    );
    counts.sort((a, b) => b.priceCount - a.priceCount || a.id - b.id);
    const winner = counts[0];
    const losers = counts.slice(1);

    for (const loser of losers) {
      const pairKey = [Math.min(winner.id, loser.id), Math.max(winner.id, loser.id)].join('-');
      if (SKIP_PAIRS.has(pairKey)) {
        console.log(`Skipping (different tests): [${winner.id}] "${winner.canonical_name_lt}" ↔ [${loser.id}] "${loser.canonical_name_lt}"`);
        continue;
      }
      console.log(`\nMerge group "${stripCode(winner.canonical_name_lt)}":`);
      await mergePair(winner.id, loser.id);
      mergeCount++;
    }
  }

  // After merges, clean remaining dirty names (strip codes from standalone tests)
  console.log('\n--- Cleaning remaining code-prefixed canonical names ---');
  const { data: remaining } = await db.from('tests').select('id, canonical_name_lt, aliases');
  let cleanCount = 0;
  for (const t of remaining ?? []) {
    const clean = stripCode(t.canonical_name_lt);
    if (clean !== t.canonical_name_lt) {
      await cleanName(t.id);
      cleanCount++;
    }
  }

  // Manual merges for near-identical names (e.g. Anteja " tyrimai" suffix)
  console.log('\n--- Manual merges (near-identical names) ---');
  for (const { winner, loser } of MANUAL_MERGES) {
    const { data: w } = await db.from('tests').select('canonical_name_lt').eq('id', winner).single();
    const { data: l } = await db.from('tests').select('canonical_name_lt').eq('id', loser).single();
    if (!w || !l) { console.log(`  [${winner} or ${loser}] not found — already merged?`); continue; }
    console.log(`\nManual merge:`);
    await mergePair(winner, loser);
    mergeCount++;
  }

  console.log(`\nSummary: ${mergeCount} merges, ${cleanCount} name cleanups${DRY_RUN ? ' (dry run)' : ''}`);
}
main();
