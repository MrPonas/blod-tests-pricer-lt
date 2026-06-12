import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { supabaseAdmin } from '@/lib/db';

async function main() {
  const { data: candida } = await supabaseAdmin
    .from('tests')
    .select('id, canonical_name_lt')
    .ilike('canonical_name_lt', '%Candida%')
    .order('id');
  console.log('Candida tests:', JSON.stringify(candida, null, 2));

  const { data: items } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur, ai_suggestion_id')
    .in('id', [1, 2, 66, 137, 381, 387, 388, 389, 394, 397, 398, 399, 400])
    .order('id');
  console.log('Queue items:', JSON.stringify(items, null, 2));

  // Find Aldosteronas canonical
  const { data: ald } = await supabaseAdmin
    .from('tests')
    .select('id, canonical_name_lt')
    .ilike('canonical_name_lt', '%ldosteron%')
    .order('id');
  console.log('Aldosteronas tests:', JSON.stringify(ald, null, 2));
}

main().catch(console.error);
