/**
 * Scrapes Rezus individual test pages that use prefixed slugs
 * (e.g. phos-fosforas, lt3-ft3-..., mg-magnis) — these were missed
 * by the original scraper because its slug generator produced the
 * plain name without the lab prefix.
 *
 * Regex parser only — no AI cost.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchPage } from '@/scrapers/lib/firecrawl';
import { parseRezusPage } from '@/scrapers/lib/rezus-parser';
import { mapAndUpsertTests } from '@/scrapers/lib/mapper';
import { getLabId } from '@/scrapers/lib/db';

// Rezus prefixed URLs confirmed live in sitemap (not found by simple slugification)
const URLS = [
  'https://www.rezus.lt/phos-fosforas',               // id=519  Fosforas (has Anteja, missing Rezus)
  'https://www.rezus.lt/lt3-ft3-laisvas-trijodtironinas', // id=286  Laisvas trijodtironinas
  'https://www.rezus.lt/lt4-ft4-laisvas-tiroksinas',  // id=287  Laisvas tiroksinas
  'https://www.rezus.lt/cor-kortizolis',              // id=390  Kortizolis (COR) ryte
  'https://www.rezus.lt/mg-magnis',                   // id=437  Magnis
  'https://www.rezus.lt/pth-parathormonas',           // id=562  Parathormonas
  'https://www.rezus.lt/zn-cinkas-mikroelementas',    // id=1085 Cinkas (mikroelementas)
  'https://www.rezus.lt/cu-varis-mikroelementas',     // id=236  Varis (mikroelementas)
];

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function main() {
  const labId = await getLabId('rezus');
  if (!labId) throw new Error('Lab "rezus" not found');
  const lab = { id: labId, name: 'Rezus', slug: 'rezus' };

  console.log(`=== Scraping ${URLS.length} Rezus prefixed-slug pages ===\n`);

  let parsedOk = 0, parseFail = 0, matched = 0, queued = 0;
  const failed: string[] = [];

  for (const url of URLS) {
    const slug = url.split('/').at(-1)!;

    let markdown: string;
    try {
      markdown = await withTimeout(fetchPage(url), 90_000, slug);
    } catch (err) {
      console.error(`  FETCH FAIL  ${slug}: ${err}`);
      failed.push(url);
      parseFail++;
      continue;
    }

    const parsed = parseRezusPage(markdown);
    if (!parsed) {
      console.error(`  PARSE FAIL  ${slug}`);
      console.error(`    (first 300 chars: ${markdown.slice(0, 300).replace(/\n/g, '↵')})`);
      failed.push(url);
      parseFail++;
      continue;
    }

    parsedOk++;
    console.log(`  ✓ ${slug}`);
    console.log(`    name:  "${parsed.name}"  €${parsed.priceEur}`);

    const result = await mapAndUpsertTests(
      [{ name: parsed.name, price_eur: parsed.priceEur, url }],
      lab,
    );
    matched += result.matched;
    queued  += result.queued;
    const outcome = result.matched > 0 ? `matched (id likely resolved)` : `queued for AI worker`;
    console.log(`    → ${outcome}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Pages:   ${URLS.length} total — ${parsedOk} parsed ok, ${parseFail} failed`);
  console.log(`Mapping: ${matched} matched immediately, ${queued} queued`);
  if (failed.length) {
    console.log(`\nFailed:`);
    failed.forEach(u => console.log(`  ${u}`));
  }
}

main().catch(console.error);
