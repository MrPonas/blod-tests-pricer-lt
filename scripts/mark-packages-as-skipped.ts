import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

const PACKAGE_KEYWORDS = ['programa', 'paketas', 'kompleksas', 'isplestine', 'profilis'];

async function main() {
  const { count: before } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`Pending before: ${before}`);

  const { data: pending } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, raw_name')
    .eq('status', 'pending');

  if (!pending?.length) { console.log('No pending rows.'); return; }

  const lowerKeywords = PACKAGE_KEYWORDS.map(k => k.toLowerCase());
  const toSkip = pending.filter(row =>
    lowerKeywords.some(kw => row.raw_name.toLowerCase().includes(kw))
  );

  console.log(`Matched as packages: ${toSkip.length}`);

  if (toSkip.length === 0) { console.log('Nothing to skip.'); return; }

  const { error } = await supabaseAdmin
    .from('mapping_review_queue')
    .update({ status: 'skipped', ai_reasoning: 'Test package — not an individual test' })
    .in('id', toSkip.map(r => r.id));

  if (error) { console.error('Update failed:', error.message); return; }

  const { count: after } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`Pending after:  ${after}`);
  console.log(`Skipped:        ${toSkip.length}`);
}

main().catch(console.error);
