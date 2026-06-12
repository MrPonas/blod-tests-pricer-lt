import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const renames: Array<{id: number, name: string}> = [
  { id: 175, name: 'CA-125 Kiaušidžių vėžio žymuo' },
  { id: 177, name: 'CA-19-9 Kasos vėžio žymuo' },
  { id: 178, name: 'CA-72-4 Skrandžio vėžio žymuo' },
  { id: 254, name: 'DTL Cholesterolis (HDL)' },  // restore DTL meaning
];

async function main() {
  for (const { id, name } of renames) {
    const { data: t } = await db.from('tests').select('canonical_name_lt, aliases').eq('id', id).single();
    if (!t) { console.log(`[${id}] not found`); continue; }
    const aliases = [...new Set([...t.aliases, t.canonical_name_lt])];
    await db.from('tests').update({ canonical_name_lt: name, aliases }).eq('id', id);
    console.log(`[${id}] "${t.canonical_name_lt}" → "${name}"`);
  }
}
main();
