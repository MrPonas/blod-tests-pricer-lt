/**
 * Merges canonical tests that have the same name (case-insensitive, trimmed).
 * Keeps the test with the most price entries; reassigns all prices/pending_review
 * from duplicates to the winner, then deletes duplicates.
 *
 * Run with --dry-run to preview without changes.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN — no changes will be made ---\n');

  const { data: tests, error } = await db
    .from('tests')
    .select('id, canonical_name_lt, aliases')
    .order('id');
  if (error) throw error;

  // Group by normalized name
  const groups = new Map<string, typeof tests>();
  for (const test of tests ?? []) {
    const key = test.canonical_name_lt.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(test);
  }

  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`Found ${dupeGroups.length} groups with duplicates`);

  let totalMerged = 0;

  for (const group of dupeGroups) {
    // Fetch price counts to pick winner
    const counts = await Promise.all(
      group.map(async (t) => {
        const { count } = await db.from('prices').select('*', { count: 'exact', head: true }).eq('test_id', t.id);
        return { ...t, priceCount: count ?? 0 };
      })
    );
    counts.sort((a, b) => b.priceCount - a.priceCount || a.id - b.id);
    const winner = counts[0];
    const losers = counts.slice(1);

    console.log(`\nMerging "${winner.canonical_name_lt}" — keeping id ${winner.id} (${winner.priceCount} prices)`);
    losers.forEach((l) => console.log(`  ← merging id ${l.id} (${l.priceCount} prices)`));

    if (!DRY_RUN) {
      for (const loser of losers) {
        // Reassign prices (skip conflicts — winner already has a price for this lab)
        const { data: loserPrices } = await db.from('prices').select('*').eq('test_id', loser.id);
        for (const price of loserPrices ?? []) {
          const { data: existing } = await db.from('prices').select('id').eq('test_id', winner.id).eq('lab_id', price.lab_id).single();
          if (!existing) {
            await db.from('prices').update({ test_id: winner.id }).eq('id', price.id);
          } else {
            await db.from('prices').delete().eq('id', price.id);
          }
        }

        // Reassign pending_review
        await db.from('pending_review').update({ resolved_test_id: winner.id }).eq('resolved_test_id', loser.id);

        // Merge aliases
        const mergedAliases = [...new Set([
          ...winner.aliases,
          ...loser.aliases,
          loser.canonical_name_lt,
        ])];
        await db.from('tests').update({ aliases: mergedAliases }).eq('id', winner.id);

        // Delete loser
        await db.from('tests').delete().eq('id', loser.id);
        totalMerged++;
      }
    } else {
      totalMerged += losers.length;
    }
  }

  console.log(`\n${DRY_RUN ? 'Would merge' : 'Merged'} ${totalMerged} duplicate tests.`);
}

main().catch(console.error);
