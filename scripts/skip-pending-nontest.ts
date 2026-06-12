import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

const NON_TEST_PATTERNS = [
  /masaž/i, /kineziterapij/i, /teipavim/i, /hidromasaž/i,
  /echoskopij/i, /ultragas/i,
  /infuzij/i, /lašelin/i, /injekcij/i,
  /pažyma/i, /konsultacij/i,
  /plovimas/i, /vienkartinės/i, /punkcij/i, /tepinėlio paėmimas/i,
  /ginekolog/i, /spiralės/i, /vaisiaus/i, /akušer/i,
  /NAD\+/i, /aromaterapin/i, /limfodrenažo/i,
  /gyd\./i,
  /rentgeno/i,
  /terapinis gydymas/i, /lazerio terapij/i,
  /skiepas/i,
  /kineziterapeutės/i,
];

function isNonTest(name: string): boolean {
  return NON_TEST_PATTERNS.some(re => re.test(name));
}

async function main() {
  const { data: pending } = await supabaseAdmin
    .from('mapping_jobs')
    .select('id, raw_name')
    .eq('status', 'pending');

  if (!pending?.length) { console.log('No pending jobs.'); return; }

  const skipIds = pending.filter(j => isNonTest(j.raw_name)).map(j => j.id);
  const keepIds = pending.filter(j => !isNonTest(j.raw_name));

  console.log(`Pending: ${pending.length} | skip: ${skipIds.length} | keep: ${keepIds.length}`);

  if (skipIds.length > 0) {
    await supabaseAdmin.from('mapping_jobs').update({ status: 'skipped' }).in('id', skipIds);
    console.log(`Skipped ${skipIds.length} non-test jobs.`);
  }

  console.log('\nJobs that will go to worker:');
  keepIds.slice(0, 30).forEach(j => console.log(`  "${j.raw_name}"`));
  if (keepIds.length > 30) console.log(`  ... and ${keepIds.length - 30} more`);
}

main().catch(console.error);
