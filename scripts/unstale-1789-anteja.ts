import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { supabaseAdmin } from '@/lib/db';

async function main() {
  const { error, count } = await supabaseAdmin
    .from('prices')
    .update({ is_stale: false, scraped_at: new Date().toISOString() })
    .eq('test_id', 1789)
    .eq('lab_id', supabaseAdmin.from('labs').select('id').eq('slug', 'anteja'))
    .select('*', { count: 'exact', head: true });

  // Supabase doesn't support subquery in .eq(), so use the known lab_id directly
  // First fetch Anteja's lab_id
  const { data: lab } = await supabaseAdmin.from('labs').select('id').eq('slug', 'anteja').single();
  if (!lab) { console.error('Anteja lab not found'); return; }

  const { error: updateErr, count: updated } = await supabaseAdmin
    .from('prices')
    .update({ is_stale: false, scraped_at: new Date().toISOString() })
    .eq('test_id', 1789)
    .eq('lab_id', lab.id)
    .select('*', { count: 'exact', head: true });

  if (updateErr) { console.error('Update failed:', updateErr.message); return; }
  console.log(`✓ Cleared is_stale for test_id=1789, Anteja (lab_id=${lab.id})`);

  // Verify
  const { data: price } = await supabaseAdmin
    .from('prices')
    .select('price_eur, is_stale, scraped_at, lab_test_name')
    .eq('test_id', 1789)
    .eq('lab_id', lab.id)
    .single();
  console.log('Verified:', price);
}

main().catch(console.error);
