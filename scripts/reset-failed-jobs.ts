import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

async function main() {
  const { error } = await supabaseAdmin
    .from('mapping_jobs')
    .update({ status: 'pending', claimed_at: null, error: null, finished_at: null })
    .in('status', ['failed', 'processing']);

  if (error) { console.error('Reset failed:', error.message); process.exit(1); }

  const { count } = await supabaseAdmin
    .from('mapping_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`Reset done. Pending jobs: ${count}`);
}

main().catch(console.error);
