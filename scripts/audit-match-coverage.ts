// How many pairs of canonical tests exist where both have the same stripped name
// (meaning they're duplicates that were created from different labs' codes)?
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function stripCode(name: string): string {
  if (name.includes(' | ')) return name.split(' | ').slice(1).join(' | ').trim();
  return name.replace(/^[A-ZŽŠŪ\-]{1,8}\d*\s+(?=[A-ZŽŠŲ])/, '').trim();
}

async function main() {
  const { data: tests } = await db.from('tests').select('id, canonical_name_lt');
  const all = tests ?? [];

  // Build map of stripped → [tests]
  const byStripped = new Map<string, typeof all>();
  for (const t of all) {
    const key = stripCode(t.canonical_name_lt).toLowerCase();
    if (!byStripped.has(key)) byStripped.set(key, []);
    byStripped.get(key)!.push(t);
  }

  const dupes = [...byStripped.values()].filter(g => g.length > 1);
  console.log(`\nExact duplicates after code-stripping: ${dupes.length} groups`);
  for (const g of dupes) {
    console.log(`  "${stripCode(g[0].canonical_name_lt)}" ← [${g.map(t => t.id).join(', ')}]`);
    for (const t of g) console.log(`    [${t.id}] ${t.canonical_name_lt}`);
  }
}
main();
