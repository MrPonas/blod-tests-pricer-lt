import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const checks = [
    { name: 'Anti-Tg', testId: 126 },
    { name: 'Karcinoembrioninis antigenas', testId: 199 },
    { name: 'CA-125', testId: 175 },
    { name: 'Ceruloplazminas', testId: 201 },
    { name: 'Laktatdehidrogenazė', testId: 404 },
    { name: 'Kalcis', testId: 174 },
    { name: 'Natris', testId: 481 },
  ];

  for (const { name, testId } of checks) {
    const { data: t } = await db.from('tests').select('canonical_name_lt').eq('id', testId).single();
    const { data: prices } = await db.from('prices').select('lab_id, price_eur').eq('test_id', testId).eq('is_stale', false);
    const labs = prices?.map(p => `lab${p.lab_id}:€${p.price_eur}`).join(', ') ?? '—';
    console.log(`${name}: "${t?.canonical_name_lt}" | ${labs}`);
  }

  // Overall stats
  const { data: allPrices } = await db.from('prices').select('test_id, lab_id').eq('is_stale', false).gt('price_eur', 0);
  const testLabs = new Map<number, Set<number>>();
  for (const p of allPrices ?? []) {
    if (!testLabs.has(p.test_id)) testLabs.set(p.test_id, new Set());
    testLabs.get(p.test_id)!.add(p.lab_id);
  }
  const multiLab = [...testLabs.values()].filter(s => s.size >= 2).length;
  const total = testLabs.size;
  console.log(`\nTests with 2+ labs: ${multiLab} of ${total} (${Math.round(multiLab/total*100)}%)`);
}
main();
