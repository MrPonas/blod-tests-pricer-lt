/**
 * Promotes all unresolved pending_review items to canonical tests.
 * Run once after the first scrape to seed the tests table.
 * Subsequent scrapes will then match against these canonical tests.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateMatchKey } from '../lib/match-key';

function stripCode(name: string): string {
  let result = name;
  if (result.includes(' | ')) result = result.split(' | ').slice(1).join(' | ');
  result = result.replace(/^[A-ZŽŠŪ\-]{1,8}\d*\s+(?=[A-ZŽŠŲ])/, '');
  result = result.replace(/\s+tyrimai$/i, '').replace(/\s+-\s+tyrimas$/i, '');
  return result.trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: pending, error } = await db
    .from('pending_review')
    .select('*, lab:labs(slug)')
    .eq('is_resolved', false)
    .order('raw_name');

  if (error) throw error;
  if (!pending?.length) { console.log('No pending items.'); return; }

  console.log(`Promoting ${pending.length} pending items to canonical tests...`);

  // Deduplicate by normalized name
  const seen = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const item of pending) {
    const key = item.raw_name.trim().toLowerCase();
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    const cleanName = stripCode(item.raw_name.trim());
    const matchKey = generateMatchKey(item.raw_name.trim());

    // Insert canonical test with clean name and match_key from day one
    const { data: test, error: insertErr } = await db
      .from('tests')
      .insert({ canonical_name_lt: cleanName, match_key: matchKey, aliases: [item.raw_name.trim()] })
      .select('id')
      .single();

    if (insertErr) {
      console.error(`Failed to insert "${item.raw_name}":`, insertErr.message);
      continue;
    }

    // Insert price directly (we already have the price from pending_review)
    const labId = (item as unknown as { lab_id: number }).lab_id;
    if (item.price_eur && test?.id) {
      await db.from('prices').upsert({
        test_id: test.id,
        lab_id: labId,
        price_eur: item.price_eur,
        lab_test_name: item.raw_name,
        scraped_at: item.scraped_at,
        is_stale: false,
      }, { onConflict: 'test_id,lab_id' });
    }

    // Mark as resolved
    await db.from('pending_review').update({
      is_resolved: true,
      resolved_test_id: test?.id,
    }).eq('id', item.id);

    created++;
  }

  console.log(`Done: ${created} canonical tests created, ${skipped} duplicates skipped.`);
}

main().catch(console.error);
