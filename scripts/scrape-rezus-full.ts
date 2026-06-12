/**
 * Full Rezus scrape: reads sitemap.xml, fetches every test page,
 * parses name+price with the zero-cost regex parser, falls back to Haiku
 * only on parse failures, then feeds all results into mapAndUpsertTests().
 *
 * Usage:
 *   MAX_PAGES=10 npx tsx scripts/scrape-rezus-full.ts   # test run
 *   npx tsx scripts/scrape-rezus-full.ts                # full run
 *   DRY_RUN=true npx tsx scripts/scrape-rezus-full.ts   # no DB writes
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchPage } from '@/scrapers/lib/firecrawl';
import { parseRezusPage } from '@/scrapers/lib/rezus-parser';
import { extractPrices } from '@/scrapers/lib/extract';
import { mapAndUpsertTests, type RawTest } from '@/scrapers/lib/mapper';
import { getLabId, insertScrapeRun, updateScrapeRun, markLabPricesStale } from '@/scrapers/lib/db';

const MAX_PAGES = process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES, 10) : undefined;
const DRY_RUN   = process.env.DRY_RUN === 'true';

const REZUS_EXCLUDE = new Set([
  '/visi-tyrimai', '/kontaktai', '/apie-mus', '/naujienos',
  '/gydytojai', '/akcijos', '/nuolaidos', '/prisijungimas',
  '/registracija', '/duk', '/karjera', '/es-projektai',
  '/index.php', '/wp-', '/wp-content', '/wp-admin',
]);

function isRezusTestUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('rezus')) return false;
    if (u.hash || u.search) return false;
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return false;
    const slug = '/' + segments[0];
    for (const excl of REZUS_EXCLUDE) {
      if (slug.startsWith(excl)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchSitemapUrls(): Promise<string[]> {
  console.log('Fetching https://www.rezus.lt/sitemap.xml ...');
  const res = await fetch('https://www.rezus.lt/sitemap.xml', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
  });
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const locs: string[] = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    locs.push(m[1].trim());
  }
  console.log(`Sitemap: ${locs.length} total <loc> entries`);
  return locs;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

  // ── Build URL list from sitemap ───────────────────────────────────────────
  const allUrls = await fetchSitemapUrls();
  const testUrls = allUrls.filter(isRezusTestUrl);
  console.log(`After filtering: ${testUrls.length} test URLs`);

  const urls = MAX_PAGES ? testUrls.slice(0, MAX_PAGES) : testUrls;
  if (MAX_PAGES) {
    console.log(`MAX_PAGES=${MAX_PAGES}: processing first ${urls.length} pages (no stale-mark)\n`);
  }

  if (DRY_RUN) {
    console.log('DRY_RUN=true — no DB writes');
    console.log(`Would scrape ${urls.length} pages`);
    return;
  }

  // ── Mark existing Rezus prices stale (full run only) ─────────────────────
  if (!MAX_PAGES) {
    console.log('Marking existing Rezus prices as stale...');
    await markLabPricesStale(labId);
  }

  const runId = await insertScrapeRun(labId);

  let parsedCount  = 0;
  let fallbackCount = 0;
  let failedCount  = 0;
  let totalMatched = 0;
  let totalQueued  = 0;

  // ── Per-page loop ─────────────────────────────────────────────────────────
  for (let i = 0; i < urls.length; i++) {
    const url  = urls[i];
    const slug = url.split('/').at(-1) ?? url;

    // Gentle rate limiting
    if (i > 0 && i % 20 === 0) await sleep(2000);

    let markdown: string;
    try {
      markdown = await withTimeout(fetchPage(url), 90_000, slug);
    } catch (err) {
      console.error(`  [${i + 1}/${urls.length}] FETCH FAILED ${slug}: ${err}`);
      failedCount++;
      continue;
    }

    // ── Try zero-cost regex parser ──────────────────────────────────────────
    const parsed = parseRezusPage(markdown);
    let rawTests: RawTest[];

    if (parsed) {
      parsedCount++;
      rawTests = [{ name: parsed.name, price_eur: parsed.priceEur, url }];
      if (MAX_PAGES) {
        console.log(`  [${i + 1}/${urls.length}] "${parsed.name}" €${parsed.priceEur} (parser)`);
      }
    } else {
      // ── Haiku fallback ───────────────────────────────────────────────────
      fallbackCount++;
      try {
        const extracted = await extractPrices(markdown, 'rezus');
        rawTests = extracted
          .filter(t => t.price_eur > 0)
          .map(t => ({ name: t.name, price_eur: t.price_eur, url }));
        if (MAX_PAGES) {
          if (rawTests.length > 0) {
            rawTests.forEach(t =>
              console.log(`  [${i + 1}/${urls.length}] "${t.name}" €${t.price_eur} (haiku fallback)`)
            );
          } else {
            console.log(`  [${i + 1}/${urls.length}] ${slug}: haiku returned 0 tests`);
          }
        }
      } catch (err) {
        console.error(`  [${i + 1}/${urls.length}] HAIKU FAILED ${slug}: ${err}`);
        failedCount++;
        continue;
      }
    }

    if (rawTests.length === 0) {
      if (MAX_PAGES) console.log(`  [${i + 1}/${urls.length}] ${slug}: no tests extracted`);
      failedCount++;
      continue;
    }

    const { matched, queued } = await mapAndUpsertTests(rawTests, lab);
    totalMatched += matched;
    totalQueued  += queued;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`Pages:   ${urls.length} total`);
  console.log(`  parsed by regex:  ${parsedCount}`);
  console.log(`  haiku fallback:   ${fallbackCount}`);
  console.log(`  failed/empty:     ${failedCount}`);
  console.log(`Mapping: ${totalMatched} matched immediately, ${totalQueued} queued for AI worker`);

  const status = failedCount > urls.length * 0.1 ? 'partial' : 'success';
  await updateScrapeRun(runId, { status, testsUpdated: totalMatched });

  if (!MAX_PAGES) {
    console.log(`\nScrape run #${runId} complete (${status})`);
  }
}

main().catch(console.error);
