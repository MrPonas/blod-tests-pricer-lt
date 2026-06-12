import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';

async function main() {
  const { data: jobs } = await supabaseAdmin
    .from('mapping_jobs')
    .select('raw_name, labs(name)')
    .eq('status', 'pending');

  if (!jobs?.length) { console.log('No pending jobs.'); return; }

  const normalized = jobs.map((j: { raw_name: string }) => normalizeTestName(j.raw_name));
  const unique = [...new Set(normalized)];

  const { data: cached } = await supabaseAdmin
    .from('test_name_mappings')
    .select('raw_name_normalized')
    .in('raw_name_normalized', unique)
    .not('canonical_test_id', 'is', null);

  const hitSet = new Set((cached ?? []).map((m: { raw_name_normalized: string }) => m.raw_name_normalized));
  const hits = normalized.filter(n => hitSet.has(n)).length;

  console.log(`Total pending jobs : ${jobs.length}`);
  console.log(`Unique normalized  : ${unique.length}`);
  console.log(`Cross-lab cache hits: ${hits} (${((hits/jobs.length)*100).toFixed(0)}%)`);
  console.log(`Would need AI      : ${jobs.length - hits}`);
}

main().catch(console.error);
