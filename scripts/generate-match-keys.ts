/**
 * One-time migration: populate match_key for all existing tests.
 *
 * Usage:
 *   npx tsx scripts/generate-match-keys.ts          # dry run (no DB writes)
 *   npx tsx scripts/generate-match-keys.ts --apply  # write to DB
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateMatchKey } from '../lib/match-key';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const { data: tests, error } = await db
    .from('tests')
    .select('id, canonical_name_lt, match_key')
    .order('id');

  if (error) throw error;
  if (!tests?.length) { console.log('No tests found.'); return; }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Processing ${tests.length} tests...\n`);

  // Detect collisions before writing: two different tests → same key
  const keyToIds = new Map<string, number[]>();
  for (const t of tests) {
    const key = generateMatchKey(t.canonical_name_lt);
    const ids = keyToIds.get(key) ?? [];
    ids.push(t.id);
    keyToIds.set(key, ids);
  }

  const collisions = [...keyToIds.entries()].filter(([, ids]) => ids.length > 1);
  if (collisions.length > 0) {
    console.warn(`WARNING: ${collisions.length} collision(s) detected (same key for different tests):`);
    for (const [key, ids] of collisions) {
      const names = ids.map(id => tests.find(t => t.id === id)?.canonical_name_lt ?? `#${id}`);
      console.warn(`  "${key}" → IDs ${ids.join(', ')}: ${names.join(' | ')}`);
    }
    console.warn('These tests will be skipped — resolve them manually first.\n');
  }

  const collisionIds = new Set(collisions.flatMap(([, ids]) => ids));

  let populated = 0;
  let alreadySet = 0;
  let skippedCollision = 0;

  for (const t of tests) {
    if (collisionIds.has(t.id)) { skippedCollision++; continue; }

    const key = generateMatchKey(t.canonical_name_lt);

    if (t.match_key) {
      if (t.match_key === key) { alreadySet++; continue; }
      // Key changed (canonical name was updated) — overwrite
      console.log(`  UPDATE [${t.id}] "${t.canonical_name_lt}": "${t.match_key}" → "${key}"`);
    } else {
      console.log(`  SET    [${t.id}] "${t.canonical_name_lt}" → "${key}"`);
    }

    if (!DRY_RUN) {
      const { error: updateError } = await db
        .from('tests')
        .update({ match_key: key })
        .eq('id', t.id);
      if (updateError) console.error(`    Failed: ${updateError.message}`);
    }

    populated++;
  }

  console.log(`\nSummary:`);
  console.log(`  ${populated} keys ${DRY_RUN ? 'would be ' : ''}populated`);
  console.log(`  ${alreadySet} already correct`);
  console.log(`  ${skippedCollision} skipped (collision)`);
  if (DRY_RUN) console.log('\nRe-run with --apply to write to DB.');
}

main().catch(console.error);
