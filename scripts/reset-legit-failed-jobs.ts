/**
 * Classifies failed mapping_jobs:
 *  - non-tests (massages, ultrasounds, infusions, certs) → status='skipped'
 *  - legitimate diagnostic tests → status='pending' (worker will retry)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

const NON_TEST_PATTERNS = [
  // Physical therapy / massage
  /masaž/i, /kineziterapij/i, /teipavim/i, /hidromasaž/i,
  // Ultrasound imaging (including typo "ultragasrinis")
  /echoskopij/i, /ultragas/i,
  // IV / injection procedures
  /infuzij/i, /lašelin/i, /injekcij/i,
  // Administrative
  /pažyma/i, /konsultacij/i,
  // Misc procedures / sample collection
  /plovimas/i, /vienkartinės/i, /punkcij/i, /tepinėlio paėmimas/i,
  // Gynecology / obstetric procedures
  /ginekolog/i, /spiralės/i, /vaisiaus/i, /akušer/i,
  // Wellness
  /NAD\+/i, /aromaterapin/i, /limfodrenažo/i,
  // Named doctor services
  /gyd\./i,
];

function isNonTest(name: string): boolean {
  return NON_TEST_PATTERNS.some(re => re.test(name));
}

async function main() {
  const { data: failed, error } = await supabaseAdmin
    .from('mapping_jobs')
    .select('id, raw_name')
    .eq('status', 'failed');

  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!failed?.length) { console.log('No failed jobs found.'); return; }

  const skipIds  = failed.filter(j => isNonTest(j.raw_name)).map(j => j.id);
  const retryIds = failed.filter(j => !isNonTest(j.raw_name)).map(j => j.id);

  console.log(`Failed jobs: ${failed.length} total`);
  console.log(`  → skip (non-tests):  ${skipIds.length}`);
  console.log(`  → retry (tests):     ${retryIds.length}`);

  if (skipIds.length > 0) {
    const { error: e1 } = await supabaseAdmin
      .from('mapping_jobs')
      .update({ status: 'skipped' })
      .in('id', skipIds);
    if (e1) console.error('Skip update failed:', e1.message);
    else console.log(`\nMarked ${skipIds.length} jobs as skipped.`);
  }

  if (retryIds.length > 0) {
    const { error: e2 } = await supabaseAdmin
      .from('mapping_jobs')
      .update({ status: 'pending', error: null, finished_at: null })
      .in('id', retryIds);
    if (e2) console.error('Reset update failed:', e2.message);
    else console.log(`Reset ${retryIds.length} jobs to pending.`);
  }

  // Show sample of retry jobs
  const retryJobs = failed.filter(j => !isNonTest(j.raw_name));
  console.log('\nSample retry jobs:');
  retryJobs.slice(0, 20).forEach(j => console.log(`  "${j.raw_name}"`));
  if (retryJobs.length > 20) console.log(`  ... and ${retryJobs.length - 20} more`);
}

main().catch(console.error);
