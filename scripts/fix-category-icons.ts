import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ICON_FIXES: [number, string][] = [
  [9,  '🩹'],  // Koaguliacija — was 🩸 (same as Bendra kraujo)
  [11, '🧫'],  // Mikrobiologija — was 🦠 (same as Infekcijos)
  [12, '⚡'],  // Mikroelementai — was ⚗️ (same as Hormonai)
  [14, '🔍'],  // PGR tyrimai — was 🔬 (same as Biochemija)
];

async function main() {
  for (const [id, icon] of ICON_FIXES) {
    const { error } = await db.from('categories').update({ icon }).eq('id', id);
    if (error) throw new Error(`id=${id}: ${error.message}`);
    console.log(`  id=${id} → ${icon}`);
  }
  console.log('Done.');
}
main().catch(e => { console.error(e); process.exit(1); });
