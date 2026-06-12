import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Check test 126
  const { data: test } = await db.from('tests').select('id, canonical_name_lt, aliases').eq('id', 126).single();
  console.log('Test 126:', JSON.stringify(test, null, 2));

  // All prices for test 126
  const { data: prices } = await db.from('prices').select('lab_id, lab_test_name, price_eur, is_stale, scraped_at').eq('test_id', 126);
  console.log('\nPrices for 126:', JSON.stringify(prices, null, 2));

  // Search for any test with "tiroglobulin" in the name
  const { data: related } = await db.from('tests').select('id, canonical_name_lt, aliases').ilike('canonical_name_lt', '%tiroglobulin%');
  console.log('\nAll tiroglobulin tests:', JSON.stringify(related, null, 2));

  // Check pending_review for Anteja anti-tg
  const { data: pending } = await db.from('pending_review').select('*').ilike('raw_name', '%anti%tg%').limit(10);
  const { data: pending2 } = await db.from('pending_review').select('*').ilike('raw_name', '%tiroglobulin%').limit(10);
  console.log('\nPending anti-tg:', JSON.stringify(pending, null, 2));
  console.log('\nPending tiroglobulin:', JSON.stringify(pending2, null, 2));

  // What prices does Anteja (lab_id=2) have that relate to tiroglobulin?
  const { data: antejaPrices } = await db.from('prices').select('test_id, lab_test_name, price_eur').eq('lab_id', 2).ilike('lab_test_name', '%tiroglobulin%');
  console.log('\nAnteja tiroglobulin prices:', JSON.stringify(antejaPrices, null, 2));
}
main();
