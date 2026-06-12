/**
 * Scrapes 5 specific Rezus trace-element pages whose canonical entries
 * already exist in the DB. Extracts name+price via regex parser, shows
 * results, then upserts via mapper (cache → vector → hard rules).
 *
 * Expected: €0.00 cost (regex parser + vector auto-resolve, no AI).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchPage } from '@/scrapers/lib/firecrawl';
import { parseRezusPage } from '@/scrapers/lib/rezus-parser';
import { mapAndUpsertTests, type RawTest } from '@/scrapers/lib/mapper';
import { getLabId } from '@/scrapers/lib/db';

const URLS = [
  'https://www.rezus.lt/alavas',
  'https://www.rezus.lt/aliuminis',
  'https://www.rezus.lt/auksas',
  'https://www.rezus.lt/berilis',
  'https://www.rezus.lt/bismutas',
];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function main() {
  const labId = await getLabId('rezus');
  if (!labId) throw new Error('Lab "rezus" not found in DB');
  const lab = { id: labId, name: 'Rezus', slug: 'rezus' };

  // ── Phase 1: extract ──────────────────────────────────────────────────────
  console.log('=== Phase 1: extracting name + price ===\n');

  const extracted: { url: string; raw: RawTest }[] = [];
  const failed: string[] = [];

  for (const url of URLS) {
    const slug = url.split('/').at(-1)!;
    let markdown: string;
    try {
      markdown = await withTimeout(fetchPage(url), 90_000, slug);
    } catch (err) {
      console.error(`  FETCH FAILED ${slug}: ${err}`);
      failed.push(url);
      continue;
    }

    const parsed = parseRezusPage(markdown);
    if (!parsed) {
      console.error(`  PARSE FAILED ${slug} — regex parser returned null`);
      console.log(`  (first 300 chars of markdown: ${markdown.slice(0, 300).replace(/\n/g, '↵')})`);
      failed.push(url);
      continue;
    }

    console.log(`  ✓ ${slug}`);
    console.log(`    name:  "${parsed.name}"`);
    console.log(`    price: €${parsed.priceEur}${parsed.productCode ? `  code: ${parsed.productCode}` : ''}`);
    extracted.push({ url, raw: { name: parsed.name, price_eur: parsed.priceEur, url } });
  }

  if (failed.length > 0) {
    console.log(`\n${failed.length} page(s) failed extraction — aborting DB write`);
    process.exit(1);
  }

  // ── Phase 2: upsert ───────────────────────────────────────────────────────
  console.log('\n=== Phase 2: upsert via mapper ===\n');

  let totalMatched = 0;
  let totalQueued  = 0;

  for (const { url, raw } of extracted) {
    const slug = url.split('/').at(-1)!;
    const { matched, queued } = await mapAndUpsertTests([raw], lab);
    totalMatched += matched;
    totalQueued  += queued;
    const outcome = matched ? `matched → price upserted` : `queued for AI worker`;
    console.log(`  ${slug}: ${outcome}`);
  }

  console.log(`\nTotal: ${totalMatched} matched, ${totalQueued} queued`);
  if (totalQueued > 0) {
    console.log('⚠ Some were queued — run mapping worker to resolve');
  } else {
    console.log('✓ All matched via cache or vector — no AI cost');
  }
}

main().catch(console.error);
