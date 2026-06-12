/**
 * Scrapes the 7 Anteja section pages that were missing from labs.ts.
 * Does NOT mark existing Anteja prices stale — only adds new tests.
 *
 * Usage:
 *   npx tsx scripts/scrape-anteja-missing.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchPage } from '@/scrapers/lib/firecrawl';
import { parseDeterministic } from '@/scrapers/lib/parse';
import { extractPrices } from '@/scrapers/lib/extract';
import { mapAndUpsertTests } from '@/scrapers/lib/mapper';
import { getLabId, insertScrapeRun, updateScrapeRun } from '@/scrapers/lib/db';

const MISSING_SECTIONS = [
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/mikrobiologijos-tyrimai',
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/molekuline-diagnostika-pgr-metodas',
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/onkocitologiniai-tyrimai',
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/tevystes-giminystes-nustatymai',
  'https://www.anteja.lt/tyrimai/slapimo-tyrimai',
  'https://www.anteja.lt/tyrimai/koprologiniai-tyrimai',
  'https://www.anteja.lt/tyrimai/genetiniai-onkologiniai-ir-nevaisingumo-tyrimai',
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const labId = await getLabId('anteja');
  if (!labId) throw new Error('Lab "anteja" not found in DB');
  const lab = { id: labId, name: 'Anteja', slug: 'anteja' };

  const runId = await insertScrapeRun(labId);

  let totalMatched = 0;
  let totalQueued  = 0;
  let totalTests   = 0;
  let failed       = 0;

  for (let i = 0; i < MISSING_SECTIONS.length; i++) {
    const url     = MISSING_SECTIONS[i];
    const section = url.split('/').at(-1) ?? url;

    if (i > 0) await sleep(3000);

    console.log(`\n[${i + 1}/${MISSING_SECTIONS.length}] ${section}`);
    console.log(`  Fetching ${url}`);

    let markdown: string;
    try {
      markdown = await fetchPage(url);
      console.log(`  ${markdown.length} chars`);
    } catch (err) {
      console.error(`  FETCH FAILED: ${err}`);
      failed++;
      continue;
    }

    // Try deterministic Anteja parser first
    let extracted = parseDeterministic(markdown, 'anteja');

    if (extracted !== null && extracted.length > 0) {
      console.log(`  ${extracted.length} tests (deterministic parser)`);
    } else {
      if (extracted !== null) {
        console.warn(`  Deterministic parser returned 0, falling back to Claude Haiku`);
      }
      try {
        extracted = await extractPrices(markdown, 'anteja');
        console.log(`  ${extracted.length} tests (Haiku)`);
      } catch (err) {
        console.error(`  HAIKU FAILED: ${err}`);
        failed++;
        continue;
      }
    }

    if (extracted.length === 0) {
      console.warn(`  No tests found — skipping`);
      failed++;
      continue;
    }

    totalTests += extracted.length;

    const rawTests = extracted.map(t => ({
      name: t.name,
      price_eur: t.price_eur,
      url: t.url ?? url,
    }));

    const { matched, queued } = await mapAndUpsertTests(rawTests, lab);
    totalMatched += matched;
    totalQueued  += queued;

    console.log(`  → ${matched} matched, ${queued} queued`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Sections: ${MISSING_SECTIONS.length - failed} / ${MISSING_SECTIONS.length} succeeded`);
  console.log(`Tests:    ${totalTests} extracted`);
  console.log(`Mapping:  ${totalMatched} matched immediately, ${totalQueued} queued for AI worker`);

  const status = failed > 0 ? 'partial' : 'success';
  await updateScrapeRun(runId, { status, testsUpdated: totalMatched });
  console.log(`Scrape run #${runId} complete (${status})`);
}

main().catch(console.error);
