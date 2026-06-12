/**
 * For every zero-price canonical, constructs a slug from the name and checks
 * HEAD requests against Rezus and Anteja. No scraping, zero cost.
 *
 * Usage: npx tsx scripts/check-missing-urls.ts
 */

import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN       = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql<T = Record<string, unknown>>(q: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as T[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/č/g, 'c').replace(/ę/g, 'e').replace(/ė/g, 'e')
    .replace(/į/g, 'i').replace(/š/g, 's').replace(/ų/g, 'u').replace(/ū/g, 'u')
    .replace(/ž/g, 'z')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function headStatus(url: string, timeoutMs = 12_000): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
    });
    return res.status;
  } catch {
    return 0; // timeout or network error
  } finally {
    clearTimeout(timer);
  }
}

async function checkBatch(
  items: { id: number; name: string; slug: string }[],
  batchSize = 8,
  delayMs = 500,
): Promise<Map<number, { rezus: number; anteja: number }>> {
  const results = new Map<number, { rezus: number; anteja: number }>();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const checks = batch.map(async item => {
      const [rezus, anteja] = await Promise.all([
        headStatus(`https://www.rezus.lt/${item.slug}`),
        headStatus(`https://www.anteja.lt/${item.slug}`),
      ]);
      return { id: item.id, rezus, anteja };
    });
    const batchResults = await Promise.all(checks);
    for (const r of batchResults) {
      results.set(r.id, { rezus: r.rezus, anteja: r.anteja });
    }

    const done = Math.min(i + batchSize, items.length);
    process.stdout.write(`\r  Checked ${done}/${items.length}...`);
    if (i + batchSize < items.length) await new Promise(r => setTimeout(r, delayMs));
  }
  process.stdout.write('\n');
  return results;
}

async function main() {
  console.log('Fetching zero-price canonicals...\n');

  const zeros = await sql<{ id: number; canonical_name_lt: string }>(
    `SELECT id, canonical_name_lt
     FROM tests t
     WHERE NOT EXISTS (SELECT 1 FROM prices WHERE test_id = t.id)
     ORDER BY canonical_name_lt`
  );

  console.log(`Found ${zeros.length} zero-price canonicals.\n`);
  console.log('Generating slugs...\n');

  const items = zeros.map(r => ({
    id: r.id,
    name: r.canonical_name_lt,
    slug: slugify(r.canonical_name_lt),
  }));

  // Show slugs for sanity check
  console.log('Sample slug mappings:');
  for (const item of items.slice(0, 8)) {
    console.log(`  "${item.name}" → "${item.slug}"`);
  }
  console.log('  ...\n');

  console.log(`Checking HEAD requests for ${items.length} items against Rezus + Anteja...\n`);
  const statuses = await checkBatch(items);

  // Categorise results
  const rezusOnly:  typeof items = [];
  const antejaOnly: typeof items = [];
  const both:       typeof items = [];
  const neither:    typeof items = [];

  for (const item of items) {
    const s = statuses.get(item.id)!;
    const rezusOk  = s.rezus === 200;
    const antejaOk = s.anteja === 200;
    if (rezusOk && antejaOk) both.push(item);
    else if (rezusOk)        rezusOnly.push(item);
    else if (antejaOk)       antejaOnly.push(item);
    else                     neither.push(item);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n=== Results ===\n');
  console.log(`  Rezus only  (200 Rezus, 404 Anteja): ${rezusOnly.length}`);
  console.log(`  Anteja only (200 Anteja, 404 Rezus): ${antejaOnly.length}`);
  console.log(`  Both 200                           : ${both.length}`);
  console.log(`  Neither (404 both)                 : ${neither.length}`);
  console.log(`  Total                              : ${items.length}\n`);

  const scrapeList = [...both, ...rezusOnly, ...antejaOnly];

  if (rezusOnly.length + both.length > 0) {
    const rzItems = [...both, ...rezusOnly];
    console.log(`\n=== Rezus pages found (${rzItems.length}) ===`);
    for (const item of rzItems) {
      const s = statuses.get(item.id)!;
      const ant = s.anteja === 200 ? ' + Anteja' : '';
      console.log(`  id=${item.id}  https://www.rezus.lt/${item.slug}${ant}`);
      console.log(`    "${item.name}"`);
    }
  }

  if (antejaOnly.length > 0) {
    console.log(`\n=== Anteja only pages found (${antejaOnly.length}) ===`);
    for (const item of antejaOnly) {
      console.log(`  id=${item.id}  https://www.anteja.lt/${item.slug}`);
      console.log(`    "${item.name}"`);
    }
  }

  if (neither.length > 0) {
    console.log(`\n=== 404 on both (${neither.length}) — truly missing or wrong slug ===`);
    for (const item of neither) {
      console.log(`  id=${item.id}  "${item.name}"  slug="${item.slug}"`);
    }
  }

  // Write scrape list for next step
  if (scrapeList.length > 0) {
    const lines = [
      '# Auto-generated scrape list for zero-price canonicals found via HEAD check',
      '# format: id\tcanonical_name\trezus_url\tanteja_url',
      ...scrapeList.map(item => {
        const s = statuses.get(item.id)!;
        const rUrl = s.rezus  === 200 ? `https://www.rezus.lt/${item.slug}` : '';
        const aUrl = s.anteja === 200 ? `https://www.anteja.lt/${item.slug}` : '';
        return `${item.id}\t${item.name}\t${rUrl}\t${aUrl}`;
      }),
    ].join('\n') + '\n';
    writeFileSync('scripts/missing-tests-scrape-list.txt', lines);
    console.log(`\nScrape list written to scripts/missing-tests-scrape-list.txt`);
  }
}

main().catch(console.error);
