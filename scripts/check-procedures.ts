import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { isProcedure } from '../lib/utils';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: tests } = await db.from('tests').select('id, canonical_name_lt');
  const total = tests?.length ?? 0;
  const procedures = (tests ?? []).filter(t => isProcedure(t.canonical_name_lt));
  const remaining = total - procedures.length;
  console.log(`Total: ${total}, Procedures filtered: ${procedures.length}, Remaining: ${remaining}`);

  // Find any tests that might be procedures but aren't caught
  const suspectPatterns = ['paketa', 'profil', 'program', 'kursa', 'konsult', 'vizit', 'paruošim', 'kraujo paėm'];
  console.log('\nPotential misses (not caught by isProcedure):');
  for (const pat of suspectPatterns) {
    const missed = (tests ?? []).filter(t => !isProcedure(t.canonical_name_lt) && t.canonical_name_lt.toLowerCase().includes(pat));
    if (missed.length) {
      console.log(`  "${pat}": ${missed.length} tests`);
      missed.slice(0, 3).forEach(t => console.log(`    id=${t.id} "${t.canonical_name_lt}"`));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
