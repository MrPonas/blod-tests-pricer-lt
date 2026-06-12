/**
 * Inserts 7 new categories and pushes Kita to sort_order=99 so it remains last.
 * Idempotent: uses ON CONFLICT DO NOTHING via upsert on slug.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const NEW_CATEGORIES = [
  { name_lt: 'Koaguliacija',      name_en: 'Coagulation',       slug: 'koaguliacija',     icon: '🩸', sort_order: 9  },
  { name_lt: 'Šlapimo tyrimai',   name_en: 'Urinalysis',         slug: 'slapimo-tyrimai',  icon: '🧪', sort_order: 10 },
  { name_lt: 'Mikrobiologija',    name_en: 'Microbiology',       slug: 'mikrobiologija',   icon: '🦠', sort_order: 11 },
  { name_lt: 'Mikroelementai',    name_en: 'Trace elements',     slug: 'mikroelementai',   icon: '⚗️', sort_order: 12 },
  { name_lt: 'Autoimuniniai',     name_en: 'Autoimmune',         slug: 'autoimuniniai',    icon: '🛡️', sort_order: 13 },
  { name_lt: 'PGR tyrimai',       name_en: 'PCR / Molecular',    slug: 'pgr-tyrimai',      icon: '🔬', sort_order: 14 },
  { name_lt: 'Genetiniai',        name_en: 'Genetics',           slug: 'genetiniai',       icon: '🧬', sort_order: 15 },
];

async function main() {
  // Push Kita to last
  await db.from('categories').update({ sort_order: 99 }).eq('slug', 'kita');
  console.log('Updated Kita sort_order → 99');

  for (const cat of NEW_CATEGORIES) {
    const { data, error } = await db.from('categories').upsert(cat, { onConflict: 'slug' }).select('id, name_lt, slug').single();
    if (error) { console.error(`Failed ${cat.slug}:`, error.message); continue; }
    console.log(`  id=${data.id}  slug=${data.slug}  "${data.name_lt}"`);
  }

  // Print all categories for verification
  const { data: all } = await db.from('categories').select('id, name_lt, slug, sort_order').order('sort_order');
  console.log('\nAll categories after insert:');
  for (const c of all ?? []) console.log(`  id=${c.id}  sort=${c.sort_order}  ${c.slug}  "${c.name_lt}"`);
}
main().catch(e => { console.error(e); process.exit(1); });
