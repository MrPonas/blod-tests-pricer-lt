import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { embedText } from '@/scrapers/lib/embed';

async function main() {
  const { data: rows, error } = await supabaseAdmin
    .from('tests')
    .select('id, canonical_name_lt')
    .is('embedding', null)
    .order('id');

  if (error) { console.error('Fetch failed:', error.message); return; }
  if (!rows?.length) { console.log('No tests with null embedding. ✓'); return; }

  console.log(`Found ${rows.length} tests with null embedding:\n`);
  for (const r of rows) {
    console.log(`  id=${r.id}  "${r.canonical_name_lt}"`);
  }
  console.log('');

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const embedding = await embedText(r.canonical_name_lt);
      const { error: updateErr } = await supabaseAdmin
        .from('tests')
        .update({ embedding })
        .eq('id', r.id);
      if (updateErr) throw new Error(updateErr.message);
      console.log(`  ✓ id=${r.id}  "${r.canonical_name_lt.slice(0, 60)}"`);
      ok++;
    } catch (e) {
      console.error(`  ✗ id=${r.id}: ${e}`);
      fail++;
    }
  }

  console.log(`\n${ok} embedded, ${fail} failed`);
}

main().catch(console.error);
