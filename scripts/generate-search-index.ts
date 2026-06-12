/**
 * Generates public/test-index.json for client-side Fuse.js search.
 * Run before every next build via the "build" npm script.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import path from 'path';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface SearchEntry {
  id: number;
  name_lt: string;
  name_en: string | null;
  aliases: string[];
  category: string | null;
  min_price: number | null;
  lab_count: number;
}

async function main() {
  console.log('Generating search index...');

  // Paginate to handle >1000 tests (Supabase default limit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tests: any[] = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data: batch, error } = await db
      .from('tests')
      .select('id, canonical_name_lt, canonical_name_en, aliases, category:categories(slug), prices(price_eur, is_stale, lab_id)')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    if (!batch || batch.length === 0) break;
    tests.push(...batch);
    if (batch.length < PAGE) break;
    page++;
  }

  const entries: SearchEntry[] = [];

  for (const test of tests ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activePrices = ((test as any).prices ?? []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => !p.is_stale && Number(p.price_eur) > 0
    );
    if (activePrices.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueLabs = new Set(activePrices.map((p: any) => p.lab_id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const minPrice = Math.min(...activePrices.map((p: any) => Number(p.price_eur)));

    entries.push({
      id: test.id,
      name_lt: test.canonical_name_lt,
      name_en: test.canonical_name_en ?? null,
      aliases: (test as any).aliases ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: (test.category as any)?.slug ?? null,
      min_price: minPrice,
      lab_count: uniqueLabs.size,
    });
  }

  entries.sort((a, b) => a.name_lt.localeCompare(b.name_lt, 'lt'));

  const outputPath = path.join(process.cwd(), 'public', 'test-index.json');
  writeFileSync(outputPath, JSON.stringify(entries), 'utf8');
  console.log(`Wrote ${entries.length} entries → public/test-index.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
