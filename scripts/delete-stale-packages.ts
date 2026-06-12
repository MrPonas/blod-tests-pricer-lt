/**
 * Deletes stale Rezus |KLxx| package prices from the DB.
 * These are healthcare bundles (oncology programmes, etc.) scraped from
 * visi-tyrimai that have no individual product pages — correctly excluded
 * from the sitemap scrape. Not blood tests; safe to remove.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

async function main() {
  // Find all stale Rezus prices
  const { data: stale, error } = await supabaseAdmin
    .from('prices')
    .select('id, lab_test_name, test_id')
    .eq('lab_id', (await supabaseAdmin.from('labs').select('id').eq('slug', 'rezus').single()).data!.id)
    .eq('is_stale', true);

  if (error) { console.error(error.message); process.exit(1); }
  if (!stale?.length) { console.log('No stale Rezus prices.'); return; }

  console.log(`Found ${stale.length} stale Rezus prices to delete.`);
  stale.slice(0, 5).forEach(p => console.log(`  "${p.lab_test_name}"`));
  if (stale.length > 5) console.log(`  ... and ${stale.length - 5} more`);

  const priceIds  = stale.map(p => p.id);
  const testIds   = [...new Set(stale.map(p => p.test_id))];

  // Delete prices
  const { error: e1 } = await supabaseAdmin.from('prices').delete().in('id', priceIds);
  if (e1) { console.error('Price delete failed:', e1.message); process.exit(1); }
  console.log(`Deleted ${priceIds.length} stale prices.`);

  // Delete orphaned canonical tests (no remaining prices anywhere)
  let deletedTests = 0;
  for (const testId of testIds) {
    const { count } = await supabaseAdmin
      .from('prices')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testId);

    if (count === 0) {
      await supabaseAdmin.from('test_name_mappings').delete().eq('canonical_test_id', testId);
      await supabaseAdmin.from('tests').delete().eq('id', testId);
      deletedTests++;
    }
  }
  if (deletedTests > 0) console.log(`Cleaned up ${deletedTests} orphaned canonical tests.`);
  console.log('Done.');
}

main().catch(console.error);
