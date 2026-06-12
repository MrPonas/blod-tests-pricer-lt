/**
 * Scrapes the ~40 confirmed-live Rezus pages from missing-tests-scrape-list.txt.
 * Skips trace elements already done and program/package pages.
 * Regex parser only — no Haiku fallback, zero AI cost.
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
dotenv.config({ path: '.env.local' });

import { fetchPage } from '@/scrapers/lib/firecrawl';
import { parseRezusPage } from '@/scrapers/lib/rezus-parser';
import { mapAndUpsertTests } from '@/scrapers/lib/mapper';
import { getLabId } from '@/scrapers/lib/db';

// IDs to skip — already scraped or not a real individual test
const SKIP_IDS = new Set([
  93,   // Alavas    — done
  104,  // Aliuminis — done
  158,  // Auksas    — done
  160,  // Berilis   — done
  167,  // Bismutas  — done
  1075, // Vyrų sveikatos prevencijos programa — package
]);

interface ScrapeEntry { id: number; name: string; rezusUrl: string }

function parseScrapeList(path: string): ScrapeEntry[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [idStr, name, rezusUrl] = line.split('\t');
      return { id: parseInt(idStr, 10), name, rezusUrl: rezusUrl?.trim() ?? '' };
    })
    .filter(e => e.rezusUrl && !SKIP_IDS.has(e.id));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const labId = await getLabId('rezus');
  if (!labId) throw new Error('Lab "rezus" not found');
  const lab = { id: labId, name: 'Rezus', slug: 'rezus' };

  const entries = parseScrapeList('scripts/missing-tests-scrape-list.txt');
  console.log(`Scraping ${entries.length} pages (${SKIP_IDS.size} skipped).\n`);

  let parsedOk = 0, parseFail = 0, matched = 0, queued = 0;
  const failed: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { id, name, rezusUrl } = entries[i];
    const slug = rezusUrl.split('/').at(-1)!;

    // Gentle rate limiting
    if (i > 0 && i % 10 === 0) await sleep(2000);

    let markdown: string;
    try {
      markdown = await withTimeout(fetchPage(rezusUrl), 90_000, slug);
    } catch (err) {
      console.error(`  [${i+1}/${entries.length}] FETCH FAIL  ${slug}: ${err}`);
      failed.push(rezusUrl);
      parseFail++;
      continue;
    }

    const parsed = parseRezusPage(markdown);
    if (!parsed) {
      console.error(`  [${i+1}/${entries.length}] PARSE FAIL  ${slug}`);
      console.error(`    canonical: "${name}"`);
      failed.push(rezusUrl);
      parseFail++;
      continue;
    }

    parsedOk++;
    console.log(`  [${i+1}/${entries.length}] "${parsed.name}"  €${parsed.priceEur}`);

    const result = await mapAndUpsertTests(
      [{ name: parsed.name, price_eur: parsed.priceEur, url: rezusUrl }],
      lab,
    );
    matched += result.matched;
    queued  += result.queued;

    const outcome = result.matched > 0 ? 'matched' : 'queued';
    console.log(`    id=${id} → ${outcome}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Pages:   ${entries.length} total`);
  console.log(`  parsed ok:   ${parsedOk}`);
  console.log(`  parse fail:  ${parseFail}`);
  console.log(`Mapping: ${matched} matched immediately, ${queued} queued for AI worker`);
  if (failed.length) {
    console.log(`\nFailed URLs:`);
    failed.forEach(u => console.log(`  ${u}`));
  }
}

main().catch(console.error);
