import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function getSlug(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '');
  } catch { return null; }
}

async function main() {
  const { data: prices } = await db.from('prices')
    .select('test_id, lab_id, lab_test_name, lab_test_url, price_eur, is_stale')
    .eq('is_stale', false)
    .not('lab_test_url', 'is', null);

  // Build: slug → [{lab_id, test_id, lab_test_name}]
  const bySlug = new Map<string, Array<{lab_id: number, test_id: number, name: string}>>();
  for (const p of prices ?? []) {
    const slug = getSlug(p.lab_test_url);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push({ lab_id: p.lab_id, test_id: p.test_id, name: p.lab_test_name });
  }

  // Find slugs that appear in multiple tests (different test_id, same slug)
  let conflicts = 0;
  for (const [slug, entries] of bySlug) {
    const testIds = new Set(entries.map(e => e.test_id));
    if (testIds.size > 1) {
      conflicts++;
      const labs = [...new Set(entries.map(e => `lab${e.lab_id}`))].join(', ');
      console.log(`SAME SLUG, DIFFERENT CANONICALS [${labs}]: /${slug}`);
      for (const e of entries) {
        console.log(`  test_id=${e.test_id} lab_id=${e.lab_id} "${e.name}"`);
      }
    }
  }
  console.log(`\nTotal slug conflicts (same slug → different canonical tests): ${conflicts}`);

  // How many prices have URLs stored?
  const { count: total } = await db.from('prices').select('*', { count: 'exact', head: true }).eq('is_stale', false);
  console.log(`\nPrices with URLs: ${prices?.length ?? 0} of ${total} active prices`);
}
main();
