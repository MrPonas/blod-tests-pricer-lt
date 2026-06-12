import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: tests } = await db.from('tests').select('id, canonical_name_lt').ilike('canonical_name_lt', '%amilaz%');
  for (const t of tests ?? []) {
    const { data: prices } = await db.from('prices').select('lab_id, lab_test_name, price_eur, is_stale').eq('test_id', t.id);
    console.log(`[${t.id}] ${t.canonical_name_lt}`);
    for (const p of prices ?? []) console.log(`  lab_id=${p.lab_id} €${p.price_eur} stale=${p.is_stale} "${p.lab_test_name}"`);
  }
}
main();
