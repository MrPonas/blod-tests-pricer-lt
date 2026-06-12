import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data } = await db.from('categories').select('id, slug, name_lt, icon').order('sort_order');
  for (const c of data ?? []) console.log(String(c.id).padStart(3), c.slug.padEnd(22), String(c.icon ?? 'NULL').padEnd(5), c.name_lt);
}
main().catch(e => { console.error(e); process.exit(1); });
